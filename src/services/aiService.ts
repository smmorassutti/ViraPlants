// AI Service — calls the analyze-plant Edge Function
// Returns: { name, health, careNotes, waterFrequencyDays, fertilizeFrequencyDays, cacheHit?, warning? }

import {SUPABASE_FUNCTIONS_URL} from '../config/env';
import {supabase} from './supabase';

export interface AnalyzeContext {
  light?: string;
  location?: string;
  userSpeciesGuess?: string;
}

export interface AnalyzeResult {
  name: string;
  health: string;
  careNotes: string;
  waterFrequencyDays: number;
  fertilizeFrequencyDays: number;
  cacheHit?: boolean;
  warning?: string;
}

export interface AnalyzeError {
  error: string;
  message: string;
}

export async function analyzePlant(params: {
  imageUrl: string;
  context?: AnalyzeContext;
}): Promise<AnalyzeResult> {
  const {
    data: {session},
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new AnalysisError('unauthorized', 'Not signed in. Please log in and try again.');
  }

  const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/analyze-plant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      imageUrl: params.imageUrl,
      context: params.context,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as AnalyzeError;
    throw new AnalysisError(
      errorData.error || 'unknown',
      errorData.message || 'Something went wrong. Please try again.',
    );
  }

  if (
    typeof data.name !== 'string' ||
    typeof data.careNotes !== 'string' ||
    typeof data.waterFrequencyDays !== 'number' ||
    typeof data.fertilizeFrequencyDays !== 'number'
  ) {
    throw new AnalysisError('invalid_response', 'Received an unexpected response. Please try again.');
  }

  return data as AnalyzeResult;
}

export class AnalysisError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AnalysisError';
  }
}
