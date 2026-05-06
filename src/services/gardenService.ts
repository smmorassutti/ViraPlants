import {supabase} from './supabase';
import type {Garden, GardenRole} from '../types/garden';

interface GetMyGardensRow {
  garden_id: string;
  garden_owner_id: string;
  garden_owner_display_name: string;
  garden_role: GardenRole;
  garden_expires_at: string | null;
}

const rowToGarden = (row: GetMyGardensRow): Garden => ({
  gardenId: row.garden_id,
  gardenOwnerId: row.garden_owner_id,
  gardenOwnerDisplayName: row.garden_owner_display_name,
  gardenRole: row.garden_role,
  gardenExpiresAt: row.garden_expires_at,
});

export const listMyGardens = async (): Promise<Garden[]> => {
  const {data, error} = await supabase.rpc('get_my_gardens');
  if (error) {
    console.warn('[gardenService] listMyGardens failed', error);
    throw error;
  }
  return ((data ?? []) as GetMyGardensRow[]).map(rowToGarden);
};
