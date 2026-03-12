export type ConnectionType = 'manual' | 'vira_pot';

export interface Reminder {
  id?: string;
  plantId?: string;
  type?: 'water' | 'fertilize' | 'custom';
  scheduledAt?: string;
  isActive?: boolean;
  timezone?: string;
  repeatIntervalDays?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CareEvent {
  id?: string;
  plantId?: string;
  type?: 'water' | 'fertilize' | 'other';
  occurredAt?: string;
  notes?: string;
  source?: 'manual' | 'vira_pot';
  createdAt?: string;
  updatedAt?: string;
}

export interface Profile {
  id?: string;
  userId?: string;
  name?: string;
  defaultLocation?: string;
  timezone?: string;
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

