// AI Service — calls the analyze-plant Edge Function via supabase.functions.invoke()
// Returns: { name, health, careNotes, waterFrequencyDays, fertilizeFrequencyDays, cacheHit?, warning? }

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

export async function analyzePlant(params: {
  imageUrl: string;
  context?: AnalyzeContext;
}): Promise<AnalyzeResult> {
  const {data, error} = await supabase.functions.invoke('analyze-plant', {
    body: {
      imageUrl: params.imageUrl,
      context: params.context,
    },
  });

  if (error) {
    // FunctionsHttpError contains the response body from the Edge Function
    const errorBody = typeof error.context === 'object' ? error.context : null;
    const code = errorBody?.error || error.message || 'unknown';
    const message = errorBody?.message || error.message || 'Something went wrong. Please try again.';
    throw new AnalysisError(code, message);
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
