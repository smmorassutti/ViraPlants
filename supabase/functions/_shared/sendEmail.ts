// supabase/functions/_shared/sendEmail.ts
//
// Shared helper for sending transactional email via Resend's REST API.
// Used by: invite-caretaker (and any future Edge Function that sends mail).
//
// Uses raw fetch instead of the Resend SDK to keep the Deno deps lean and
// avoid version drift between local and deployed environments.
//
// Required Edge Function secret: RESEND_API_KEY
//   Set via: supabase secrets set RESEND_API_KEY=re_...

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'Vira <hello@viraplants.com>';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string; // Optional plain-text fallback. Resend auto-generates if omitted.
}

export interface SendEmailResult {
  id: string;
}

export class SendEmailError extends Error {
  constructor(
    message: string,
    public readonly code: 'missing_api_key' | 'send_failed' | 'invalid_response',
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'SendEmailError';
  }
}

/**
 * Send a transactional email via Resend.
 *
 * Throws SendEmailError on any failure — callers should catch and translate
 * to user-facing error codes (e.g. 'email_send_failed' in the invite flow).
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');

  if (!apiKey) {
    throw new SendEmailError(
      'RESEND_API_KEY is not set in Edge Function secrets',
      'missing_api_key',
    );
  }

  const body: Record<string, unknown> = {
    from: FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    html: params.html,
  };

  if (params.text) {
    body.text = params.text;
  }

  let response: Response;

  try {
    response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (networkError) {
    throw new SendEmailError(
      'Network error reaching Resend API',
      'send_failed',
      undefined,
      networkError,
    );
  }

  if (!response.ok) {
    let errorDetails: unknown;
    try {
      errorDetails = await response.json();
    } catch {
      errorDetails = await response.text();
    }
    throw new SendEmailError(
      `Resend API returned ${response.status}`,
      'send_failed',
      response.status,
      errorDetails,
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (parseError) {
    throw new SendEmailError(
      'Failed to parse Resend API response',
      'invalid_response',
      response.status,
      parseError,
    );
  }

  if (
    typeof json !== 'object' ||
    json === null ||
    typeof (json as Record<string, unknown>).id !== 'string'
  ) {
    throw new SendEmailError(
      'Resend API response missing email id',
      'invalid_response',
      response.status,
      json,
    );
  }

  return { id: (json as { id: string }).id };
}
