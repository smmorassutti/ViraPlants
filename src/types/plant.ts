export type ConnectionType = 'manual' | 'vira_pot';

export interface Reminder {
  id?: string;
  plantId?: string;
  userId?: string;
  type?: 'water' | 'fertilize' | 'repot' | 'prune' | 'custom';
  dueDate?: string;
  completed?: boolean;
  createdAt?: string;
}

export interface CareEvent {
  id?: string;
  plantId?: string;
  userId?: string;
  type?: 'water' | 'fertilize' | 'repot' | 'prune' | 'photo_update';
  /** @deprecated Use createdAt. Kept for local compatibility — not persisted to DB. */
  occurredAt?: string;
  source?: 'manual' | 'vira_pot' | 'auto';
  notes?: string;
  createdAt?: string;
}

export interface Profile {
  id?: string;
  displayName?: string;
  avatarUrl?: string;
  location?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Plant {
  id: string;
  userId?: string;
  name?: string;
  nickname?: string;
  location?: string;
  orientation?: string;
  potSize?: string;
  photoUrl?: string;
  health?: string;
  careNotes?: string;
  notes?: string;
  waterFrequencyDays?: number;
  fertilizeFrequencyDays?: number;
  connectionType: ConnectionType;
  viraPotId?: string | null;
  createdAt: string;
  updatedAt: string;
  reminders: Reminder[];
  careEvents: CareEvent[];
}

/** Input type for addPlant — core fields are auto-populated by the store */
export type PlantInput = Omit<Partial<Plant>, 'id' | 'createdAt' | 'updatedAt' | 'careEvents' | 'reminders'> & {
  connectionType?: ConnectionType;
};
