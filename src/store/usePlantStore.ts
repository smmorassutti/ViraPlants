import { create } from 'zustand';
import type { Plant, PlantInput, CareEvent, Profile } from '../types/plant';

type PlantStoreState = {
  plants: Plant[];
  profile: Profile | null;
  hasOnboarded: boolean;
};

type PlantStoreActions = {
  // Profile
  setProfile: (profile: Profile) => void;
  setHasOnboarded: (value: boolean) => void;

  // Plants
  setPlants: (plants: Plant[]) => void;
  addPlant: (plant: PlantInput) => void;
  updatePlant: (id: string, updates: Partial<Plant>) => void;
  removePlant: (id: string) => void;

  // Care events
  logCareEvent: (plantId: string, event: CareEvent) => void;
  markWatered: (plantId: string) => void;
  markFertilized: (plantId: string) => void;
};

type PlantStore = PlantStoreState & PlantStoreActions;

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const usePlantStore = create<PlantStore>((set, get) => ({
  plants: [],
  profile: null,
  hasOnboarded: false,

  // ── Profile ──
  setProfile: (profile) => set({ profile }),
  setHasOnboarded: (value) => set({ hasOnboarded: value }),

  // ── Plants ──
  setPlants: (plants) => set({ plants }),

  addPlant: (input) => {
    const now = new Date().toISOString();
    const newPlant: Plant = {
      ...input,
      id: generateId(),
      connectionType: input.connectionType || 'manual',
      createdAt: now,
      updatedAt: now,
      careEvents: [],
      reminders: [],
    };
    set((state) => ({ plants: [...state.plants, newPlant] }));
  },

  updatePlant: (id, updates) => {
    set((state) => ({
      plants: state.plants.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ),
    }));
  },

  removePlant: (id) => {
    set((state) => ({
      plants: state.plants.filter((p) => p.id !== id),
    }));
  },

  // ── Care Events ──
  logCareEvent: (plantId, event) => {
    const careEvent: CareEvent = {
      ...event,
      id: event.id || generateId(),
      plantId,
      occurredAt: event.occurredAt || new Date().toISOString(),
      source: event.source || 'manual',
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      plants: state.plants.map((p) =>
        p.id === plantId
          ? { ...p, careEvents: [...p.careEvents, careEvent] }
          : p
      ),
    }));
  },

  markWatered: (plantId) => {
    const { logCareEvent } = get();
    logCareEvent(plantId, { type: 'water' });
  },

  markFertilized: (plantId) => {
    const { logCareEvent } = get();
    logCareEvent(plantId, { type: 'fertilize' });
  },
}));

