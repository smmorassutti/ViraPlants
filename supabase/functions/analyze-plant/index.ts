// analyze-plant Edge Function
// Accepts: { imageUrl: string, context?: { light?, location?, userSpeciesGuess? } }
// Returns: { name, health, careNotes, waterFrequencyDays, fertilizeFrequencyDays }
// Auth: JWT from Authorization header, validated via supabase.auth.getUser()
// Rate limit: 10 analyses per user per 24h (tracked on profiles table)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AnalyzeRequest {
  imageUrl: string;
  context?: {
    light?: string;
    location?: string;
    userSpeciesGuess?: string;
  };
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

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed', message: 'Only POST requests are accepted.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    // ── Auth: extract and validate JWT ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Missing or invalid Authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'unauthorized', message: 'Invalid or expired token.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Rate limiting: 10 analyses per 24h ──
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('analysis_count, analysis_reset_at')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: 'internal', message: 'Could not verify rate limit.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const now = new Date();
    let analysisCount = profile?.analysis_count ?? 0;
    const resetAt = profile?.analysis_reset_at ? new Date(profile.analysis_reset_at) : null;

    // Reset counter if 24h window has passed
    if (!resetAt || now >= resetAt) {
      analysisCount = 0;
    }

    if (analysisCount >= 10) {
      return new Response(
        JSON.stringify({
          error: 'rate_limited',
          message: "You've reached the daily limit for plant analysis. Try again tomorrow.",
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Parse and validate request body ──
    let body: AnalyzeRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'bad_request', message: 'Request body must be valid JSON.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!body.imageUrl || typeof body.imageUrl !== 'string') {
      return new Response(
        JSON.stringify({ error: 'bad_request', message: 'imageUrl is required and must be a string.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate imageUrl starts with the Supabase Storage URL
    if (!body.imageUrl.startsWith(supabaseUrl + '/storage/')) {
      return new Response(
        JSON.stringify({ error: 'bad_request', message: 'imageUrl must be a valid Supabase Storage URL.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
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

    // ── Placeholder response (will be replaced by Vision call in Task 2) ──
    const response: AnalyzeResponse = {
      name: 'Pothos (Epipremnum aureum)',
      health: 'Healthy',
      careNotes: 'Water when the top inch of soil feels dry, roughly once a week. Prefers bright indirect light but tolerates low light well. Feed monthly during the growing season.',
      waterFrequencyDays: 7,
      fertilizeFrequencyDays: 30,
      cacheHit: false,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'internal', message: 'An unexpected error occurred.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
