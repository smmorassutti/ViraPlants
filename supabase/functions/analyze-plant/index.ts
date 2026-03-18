// analyze-plant Edge Function
// Accepts: { imageUrl: string, context?: { light?, location?, userSpeciesGuess? } }
// Returns: { name, health, careNotes, waterFrequencyDays, fertilizeFrequencyDays }
// Auth: JWT from Authorization header, validated via supabase.auth.getUser()
// Rate limit: 10 analyses per user per 24h (tracked on profiles table)
// Note: Rate limit check-then-increment is not atomic. Concurrent requests can
// slightly exceed the limit. Acceptable for pre-launch beta; upgrade to a Postgres
// function with UPDATE ... RETURNING for production scale.
//
// Vision prompt notes:
// - Tested with common houseplants, succulents, herbs, blurry photos, non-plant images
// - JSON-only output with explicit "no markdown" instruction prevents parsing failures
// - "not_a_plant" error case handled as structured JSON response from Vision
// - Confidence levels guide user-facing warnings
// - Prompt trimmed to only fields the client uses (species ID, care schedule, summary)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VISION_MODEL = 'claude-sonnet-4-20250514';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const SYSTEM_PROMPT = `You are a plant identification expert. Analyze the provided plant photo and return a JSON object with the following structure. Return ONLY valid JSON, no markdown, no backticks, no preamble.

If the image does not contain a plant, return ONLY: { "error": "not_a_plant", "message": "This image does not appear to contain a plant. Please upload a clear photo of your plant." }

Otherwise, return:

{
  "speciesIdentification": {
    "commonName": "string",
    "scientificName": "string",
    "confidence": "high" | "medium" | "low",
    "alternativePossibilities": ["string"]
  },
  "careSchedule": {
    "waterFrequencyDays": number,
    "fertilizeFrequencyDays": number
  },
  "careSummary": "string (2-3 sentences of practical care advice)"
}`;

interface AnalyzeRequest {
  imageUrl: string;
  context?: {
    light?: string;
    location?: string;
    userSpeciesGuess?: string;
  };
}

interface VisionResponse {
  speciesIdentification: {
    commonName: string;
    scientificName: string;
    confidence: 'high' | 'medium' | 'low';
    alternativePossibilities?: string[];
  };
  careSchedule: {
    waterFrequencyDays: number;
    fertilizeFrequencyDays: number;
  };
  careSummary: string;
}

interface VisionErrorResponse {
  error: 'not_a_plant';
  message: string;
}

interface AnalyzeResponse {
  name: string;
  health: string;
  careNotes: string;
  waterFrequencyDays: number;
  fertilizeFrequencyDays: number;
  cacheHit?: boolean;
  warning?: string;
}

// ── Map Vision response to client schema ──
function mapVisionToClientResponse(vision: VisionResponse): AnalyzeResponse {
  const { speciesIdentification, careSchedule, careSummary } = vision;
  const displayName = `${speciesIdentification.commonName} (${speciesIdentification.scientificName})`;

  const response: AnalyzeResponse = {
    name: displayName,
    health: 'Healthy',
    careNotes: careSummary,
    waterFrequencyDays: careSchedule.waterFrequencyDays,
    fertilizeFrequencyDays: careSchedule.fertilizeFrequencyDays,
    cacheHit: false,
  };

  if (speciesIdentification.confidence === 'low') {
    response.warning = `Identification confidence is low. The plant might also be: ${
      speciesIdentification.alternativePossibilities?.join(', ') || 'unknown'
    }. Please verify the species manually.`;
  }

  return response;
}

// ── Validate parsed Vision response has required fields ──
function isValidVisionResponse(data: unknown): data is VisionResponse {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;

  if (!d.speciesIdentification || typeof d.speciesIdentification !== 'object') return false;
  const si = d.speciesIdentification as Record<string, unknown>;
  if (typeof si.commonName !== 'string' || typeof si.scientificName !== 'string') return false;
  if (!['high', 'medium', 'low'].includes(si.confidence as string)) return false;

  if (!d.careSchedule || typeof d.careSchedule !== 'object') return false;
  const cs = d.careSchedule as Record<string, unknown>;
  if (typeof cs.waterFrequencyDays !== 'number' || typeof cs.fertilizeFrequencyDays !== 'number') return false;

  if (typeof d.careSummary !== 'string') return false;

  return true;
}

function isNotAPlantError(data: unknown): data is VisionErrorResponse {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.error === 'not_a_plant';
}

// ── Sanitize user input for PostgREST filter ──
function sanitizeForFilter(input: string): string {
  return input.toLowerCase().trim().replace(/[,().]/g, '');
}

// ── Truncate context fields to prevent prompt abuse ──
function truncate(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value.slice(0, max);
}

// ── Convert ArrayBuffer to base64 without stack overflow ──
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(''));
}

// ── Call Claude Vision ──
async function callVision(
  anthropic: Anthropic,
  imageBase64: string,
  mediaType: string,
  context?: AnalyzeRequest['context'],
): Promise<VisionResponse> {
  let userMessage = 'Please identify this plant and provide care information.';
  if (context) {
    const parts: string[] = [];
    if (context.light) parts.push(`Light conditions: ${truncate(context.light, 200)}`);
    if (context.location) parts.push(`Location: ${truncate(context.location, 200)}`);
    if (context.userSpeciesGuess) parts.push(`The user thinks it might be: ${truncate(context.userSpeciesGuess, 200)}`);
    if (parts.length > 0) {
      userMessage += ` The user describes their environment as: ${parts.join('. ')}. This may help refine your care recommendations.`;
    }
  }

  const message = await anthropic.messages.create({
    model: VISION_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          { type: 'text', text: userMessage },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b: { type: string }) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Vision');
  }

  const parsed = JSON.parse((textBlock as { type: 'text'; text: string }).text);

  if (isNotAPlantError(parsed)) {
    throw new NotAPlantError(parsed.message);
  }

  if (!isValidVisionResponse(parsed)) {
    throw new Error('Invalid response structure from Vision');
  }

  return parsed;
}

class NotAPlantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotAPlantError';
  }
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed', message: 'Only POST requests are accepted.' }, 405);
  }

  try {
    // ── Validate required env vars ──
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
      return jsonResponse({ error: 'internal', message: 'Service is misconfigured.' }, 500);
    }

    // ── Auth: extract and validate JWT ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'unauthorized', message: 'Missing or invalid Authorization header.' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: 'unauthorized', message: 'Invalid or expired token.' }, 401);
    }

    // ── Rate limiting: 10 analyses per 24h ──
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('analysis_count, analysis_reset_at')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return jsonResponse({ error: 'internal', message: 'Could not verify rate limit.' }, 500);
    }

    const now = new Date();
    let analysisCount = profile?.analysis_count ?? 0;
    const resetAt = profile?.analysis_reset_at ? new Date(profile.analysis_reset_at) : null;

    // Reset counter if 24h window has passed
    if (!resetAt || now >= resetAt) {
      analysisCount = 0;
    }

    if (analysisCount >= 10) {
      return jsonResponse({
        error: 'rate_limited',
        message: "You've reached the daily limit for plant analysis. Try again tomorrow.",
      }, 429);
    }

    // ── Parse and validate request body ──
    let body: AnalyzeRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'bad_request', message: 'Request body must be valid JSON.' }, 400);
    }

    if (!body.imageUrl || typeof body.imageUrl !== 'string') {
      return jsonResponse({ error: 'bad_request', message: 'imageUrl is required and must be a string.' }, 400);
    }

    // Validate imageUrl starts with the Supabase Storage URL
    if (!body.imageUrl.startsWith(supabaseUrl + '/storage/')) {
      return jsonResponse({ error: 'bad_request', message: 'imageUrl must be a valid Supabase Storage URL.' }, 400);
    }

    // ── Species cache check ──
    // If user provided a species guess, check the cache first
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not configured — species cache writes will be skipped');
    }
    const serviceSupabase = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey)
      : null;

    if (body.context?.userSpeciesGuess) {
      const guess = sanitizeForFilter(body.context.userSpeciesGuess);
      if (guess.length > 0) {
        const { data: cached } = await supabase
          .from('species_cache')
          .select('data, common_name, scientific_name')
          .or(`common_name.ilike.${guess},scientific_name.ilike.${guess}`)
          .limit(1)
          .single();

        if (cached?.data && isValidVisionResponse(cached.data)) {
          const response = mapVisionToClientResponse(cached.data as VisionResponse);
          response.cacheHit = true;
          return jsonResponse(response as unknown as Record<string, unknown>, 200);
        }
      }
    }

    // ── Increment rate limit counter ──
    const newResetAt = !resetAt || now >= resetAt
      ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
      : resetAt.toISOString();

    await supabase
      .from('profiles')
      .update({
        analysis_count: analysisCount + 1,
        analysis_reset_at: newResetAt,
      })
      .eq('id', user.id);

    // ── Fetch image and convert to base64 ──
    let imageBase64: string;
    let mediaType: string;
    try {
      const imageResponse = await fetch(body.imageUrl);
      if (!imageResponse.ok) {
        return jsonResponse({ error: 'bad_request', message: 'Could not fetch the image. The URL may be expired or invalid.' }, 400);
      }

      // Validate content type
      mediaType = imageResponse.headers.get('content-type') || 'image/jpeg';
      if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
        return jsonResponse({ error: 'bad_request', message: 'Unsupported image format. Please upload a JPEG, PNG, GIF, or WebP image.' }, 400);
      }

      // Validate image size
      const contentLength = imageResponse.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
        return jsonResponse({ error: 'bad_request', message: 'Image is too large. Please upload an image under 5MB.' }, 400);
      }

      const buffer = await imageResponse.arrayBuffer();
      if (buffer.byteLength > MAX_IMAGE_BYTES) {
        return jsonResponse({ error: 'bad_request', message: 'Image is too large. Please upload an image under 5MB.' }, 400);
      }

      imageBase64 = arrayBufferToBase64(buffer);
    } catch (fetchErr) {
      console.error('Image fetch error:', fetchErr);
      return jsonResponse({ error: 'bad_request', message: 'Failed to download the plant photo.' }, 400);
    }

    // ── Call Claude Vision ──
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      return jsonResponse({ error: 'internal', message: 'AI service is not configured.' }, 500);
    }

    const anthropic = new Anthropic({ apiKey });

    let visionResult: VisionResponse;
    try {
      visionResult = await callVision(anthropic, imageBase64, mediaType, body.context);
    } catch (firstErr) {
      if (firstErr instanceof NotAPlantError) {
        return jsonResponse({ error: 'not_a_plant', message: firstErr.message }, 422);
      }

      // Retry once (non-deterministic output may succeed on second attempt)
      console.warn('First Vision call failed, retrying:', firstErr);
      try {
        visionResult = await callVision(anthropic, imageBase64, mediaType, body.context);
      } catch (retryErr) {
        if (retryErr instanceof NotAPlantError) {
          return jsonResponse({ error: 'not_a_plant', message: retryErr.message }, 422);
        }
        console.error('Vision retry failed:', retryErr);
        return jsonResponse({ error: 'analysis_failed', message: 'Could not analyze this photo. Please try again with a clearer image.' }, 422);
      }
    }

    // ── Cache the Vision result ──
    // Uses service role client to bypass RLS (species_cache is read-only for users)
    // TODO: Add cache TTL if species data quality improves over time
    if (serviceSupabase) {
      const scientificName = visionResult.speciesIdentification.scientificName.toLowerCase().trim();
      const commonName = visionResult.speciesIdentification.commonName.toLowerCase().trim();

      serviceSupabase
        .from('species_cache')
        .upsert(
          {
            scientific_name: scientificName,
            common_name: commonName,
            data: visionResult,
          },
          { onConflict: 'scientific_name' },
        )
        .then(({ error: cacheErr }) => {
          if (cacheErr) console.warn('Species cache write failed:', cacheErr);
        });
    }

    // ── Map to client schema and return ──
    const response = mapVisionToClientResponse(visionResult);

    return jsonResponse(response as unknown as Record<string, unknown>, 200);
  } catch (err) {
    console.error('Unexpected error:', err);

    // Anthropic API errors surface as 502 to the client
    if (err instanceof Anthropic.APIError) {
      return jsonResponse({ error: 'vision_unavailable', message: 'Plant analysis service is temporarily unavailable. Please try again.' }, 502);
    }

    return jsonResponse({ error: 'internal', message: 'An unexpected error occurred.' }, 500);
  }
});
