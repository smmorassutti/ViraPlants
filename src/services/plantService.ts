import {supabase} from './supabase';
import type {Plant, PlantInput, CareEvent} from '../types/plant';

// ── Row ↔ Type mappers ──

type PlantRow = {
  id: string;
  user_id: string;
  nickname: string;
  species: string | null;
  location: string | null;
  orientation: string | null;
  pot_size: string | null;
  photo_url: string | null;
  health: string | null;
  connection_type: string;
  vira_pot_id: string | null;
  water_frequency_days: number | null;
  fertilize_frequency_days: number | null;
  care_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CareEventRow = {
  id: string;
  plant_id: string;
  user_id: string;
  type: string;
  source: string;
  notes: string | null;
  created_at: string;
};

const rowToPlant = (row: PlantRow, careEvents: CareEvent[] = []): Plant => ({
  id: row.id,
  userId: row.user_id,
  nickname: row.nickname,
  name: row.species ?? undefined,
  location: row.location ?? undefined,
  orientation: row.orientation ?? undefined,
  potSize: row.pot_size ?? undefined,
  photoUrl: row.photo_url ?? undefined,
  health: row.health ?? undefined,
  connectionType: (row.connection_type as Plant['connectionType']) || 'manual',
  viraPotId: row.vira_pot_id,
  waterFrequencyDays: row.water_frequency_days ?? undefined,
  fertilizeFrequencyDays: row.fertilize_frequency_days ?? undefined,
  careNotes: row.care_notes ?? undefined,
  notes: row.notes ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  careEvents,
  reminders: [],
});

const rowToCareEvent = (row: CareEventRow): CareEvent => ({
  id: row.id,
  plantId: row.plant_id,
  userId: row.user_id,
  type: row.type as CareEvent['type'],
  source: row.source as CareEvent['source'],
  notes: row.notes ?? undefined,
  createdAt: row.created_at,
});

// ── CRUD ──

export const fetchPlants = async (userId: string): Promise<Plant[]> => {
  const {data: plantRows, error: plantError} = await supabase
    .from('plants')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', {ascending: false});

  if (plantError) throw plantError;
  if (!plantRows || plantRows.length === 0) return [];

  const plantIds = plantRows.map(p => p.id);

  const {data: eventRows, error: eventError} = await supabase
    .from('care_events')
    .select('*')
    .in('plant_id', plantIds)
    .order('created_at', {ascending: false});

  if (eventError) throw eventError;

  const eventsByPlant = new Map<string, CareEvent[]>();
  for (const row of eventRows || []) {
    const events = eventsByPlant.get(row.plant_id) || [];
    events.push(rowToCareEvent(row));
    eventsByPlant.set(row.plant_id, events);
  }

  return plantRows.map(row =>
    rowToPlant(row, eventsByPlant.get(row.id) || []),
  );
};

export const createPlant = async (
  input: PlantInput,
  userId: string,
): Promise<Plant> => {
  const {data, error} = await supabase
    .from('plants')
    .insert({
      user_id: userId,
      nickname: input.nickname || 'My Plant',
      species: input.name || null,
      location: input.location || null,
      orientation: input.orientation || null,
      pot_size: input.potSize || null,
      photo_url: input.photoUrl || null,
      health: input.health || null,
      connection_type: input.connectionType || 'manual',
      water_frequency_days: input.waterFrequencyDays || null,
      fertilize_frequency_days: input.fertilizeFrequencyDays || null,
      care_notes: input.careNotes || null,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToPlant(data, []);
};

export const updatePlantRemote = async (
  id: string,
  updates: Partial<Plant>,
): Promise<void> => {
  const row: Record<string, unknown> = {};
  if (updates.nickname !== undefined) row.nickname = updates.nickname;
  if (updates.name !== undefined) row.species = updates.name;
  if (updates.location !== undefined) row.location = updates.location;
  if (updates.orientation !== undefined) row.orientation = updates.orientation;
  if (updates.potSize !== undefined) row.pot_size = updates.potSize;
  if (updates.photoUrl !== undefined) row.photo_url = updates.photoUrl;
  if (updates.health !== undefined) row.health = updates.health;
  if (updates.connectionType !== undefined) row.connection_type = updates.connectionType;
  if (updates.waterFrequencyDays !== undefined) row.water_frequency_days = updates.waterFrequencyDays;
  if (updates.fertilizeFrequencyDays !== undefined) row.fertilize_frequency_days = updates.fertilizeFrequencyDays;
  if (updates.careNotes !== undefined) row.care_notes = updates.careNotes;
  if (updates.notes !== undefined) row.notes = updates.notes;

  if (Object.keys(row).length === 0) return;

  const {error} = await supabase.from('plants').update(row).eq('id', id);
  if (error) throw error;
};

export const deletePlant = async (id: string): Promise<void> => {
  const {error} = await supabase.from('plants').delete().eq('id', id);
  if (error) throw error;
};

export const addCareEvent = async (
  plantId: string,
  userId: string,
  type: CareEvent['type'],
  source: CareEvent['source'] = 'manual',
): Promise<CareEvent> => {
  const {data, error} = await supabase
    .from('care_events')
    .insert({
      plant_id: plantId,
      user_id: userId,
      type,
      source,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToCareEvent(data);
};
