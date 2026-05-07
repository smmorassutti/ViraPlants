export type GardenRole = 'owner' | 'caretaker';

export interface Garden {
  gardenId: string;
  gardenOwnerId: string;
  gardenOwnerDisplayName: string;
  gardenRole: GardenRole;
  gardenExpiresAt: string | null;
}
