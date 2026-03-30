import {create} from 'zustand';
import type {Plant, PlantInput, CareEvent, Profile} from '../types/plant';
import * as plantService from '../services/plantService';
import {
  scheduleWateringNotification,
  cancelWateringNotification,
} from '../services/notificationService';
import {useAuthStore} from './useAuthStore';

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
  loadPlants: () => Promise<void>;
  addPlant: (plant: PlantInput) => Promise<Plant>;
  updatePlant: (id: string, updates: Partial<Plant>) => void;
  removePlant: (id: string) => void;

  // Care events
  logCareEvent: (plantId: string, event: CareEvent) => void;
  markWatered: (plantId: string) => void;
  markFertilized: (plantId: string) => void;
};

type PlantStore = PlantStoreState & PlantStoreActions;

const getUserId = (): string | null => {
  return useAuthStore.getState().user?.id ?? null;
};

const generateTempId = () =>
  `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Throttle care events: ignore duplicate type+plantId within 5 seconds
const CARE_EVENT_THROTTLE_MS = 5000;
const lastCareEventTimes = new Map<string, number>();

export const usePlantStore = create<PlantStore>((set, get) => ({
  plants: [],
  profile: null,
  hasOnboarded: false,

  // ── Profile ──
  setProfile: (profile) => set({profile}),
  setHasOnboarded: (value) => set({hasOnboarded: value}),

  // ── Plants ──
  setPlants: (plants) => set({plants}),

  loadPlants: async () => {
    const userId = getUserId();
    if (!userId) return;
    try {
      const remotePlants = await plantService.fetchPlants(userId);
      // Merge: keep optimistic temp plants that haven't synced yet
      set((state) => {
        const tempPlants = state.plants.filter((p) => p.id.startsWith('temp-'));
        return {plants: [...remotePlants, ...tempPlants]};
      });
    } catch (error) {
      console.warn('Failed to load plants:', error);
    }
  },

  addPlant: async (input) => {
    const userId = getUserId();
    const now = new Date().toISOString();

    // Optimistic local plant with temp ID
    const tempPlant: Plant = {
      ...input,
      id: generateTempId(),
      connectionType: input.connectionType || 'manual',
      createdAt: now,
      updatedAt: now,
      careEvents: [],
      reminders: [],
    };
    set((state) => ({plants: [...state.plants, tempPlant]}));

    if (!userId) return tempPlant;

    try {
      const remotePlant = await plantService.createPlant(input, userId);
      // Replace temp plant with the real one from Supabase
      set((state) => ({
        plants: state.plants.map((p) =>
          p.id === tempPlant.id ? remotePlant : p,
        ),
      }));
      scheduleWateringNotification(remotePlant).catch(() => {});
      return remotePlant;
    } catch (error) {
      console.warn('Failed to sync plant to Supabase:', error);
      return tempPlant;
    }
  },

  updatePlant: (id, updates) => {
    // Save for rollback
    const prev = get().plants;

    // Optimistic local update
    set((state) => ({
      plants: state.plants.map((p) =>
        p.id === id
          ? {...p, ...updates, updatedAt: new Date().toISOString()}
          : p,
      ),
    }));

    // Sync to Supabase with rollback on failure
    plantService.updatePlantRemote(id, updates).catch((error) => {
      console.warn('Failed to sync plant update to Supabase:', error);
      set({plants: prev});
    });
  },

  removePlant: (id) => {
    // Save for rollback
    const prev = get().plants;

    // Optimistic local removal
    set((state) => ({
      plants: state.plants.filter((p) => p.id !== id),
    }));
    cancelWateringNotification(id).catch(() => {});

    // Sync to Supabase
    plantService.deletePlant(id).catch((error) => {
      console.warn('Failed to sync plant deletion to Supabase:', error);
      // Rollback on failure
      set({plants: prev});
    });
  },

  // ── Care Events ──
  logCareEvent: (plantId, event) => {
    // Deduplicate: ignore same event type for same plant within throttle window
    const throttleKey = `${plantId}:${event.type}`;
    const lastTime = lastCareEventTimes.get(throttleKey) ?? 0;
    if (Date.now() - lastTime < CARE_EVENT_THROTTLE_MS) return;
    lastCareEventTimes.set(throttleKey, Date.now());

    const userId = getUserId();
    const now = new Date().toISOString();

    const tempEvent: CareEvent = {
      ...event,
      id: event.id || generateTempId(),
      plantId,
      occurredAt: now,
      source: event.source || 'manual',
      createdAt: now,
    };

    // Optimistic local update
    set((state) => ({
      plants: state.plants.map((p) =>
        p.id === plantId
          ? {...p, careEvents: [...p.careEvents, tempEvent]}
          : p,
      ),
    }));

    // Sync to Supabase
    if (userId && event.type) {
      plantService
        .addCareEvent(plantId, userId, event.type, event.source || 'manual')
        .then((remoteEvent) => {
          // Replace temp event with remote one
          set((state) => ({
            plants: state.plants.map((p) =>
              p.id === plantId
                ? {
                    ...p,
                    careEvents: p.careEvents.map((e) =>
                      e.id === tempEvent.id ? remoteEvent : e,
                    ),
                  }
                : p,
            ),
          }));
        })
        .catch((error) => {
          console.warn('Failed to sync care event to Supabase:', error);
        });
    }
  },

  markWatered: (plantId) => {
    const {logCareEvent} = get();
    logCareEvent(plantId, {type: 'water'});

    const plant = get().plants.find((p) => p.id === plantId);
    if (plant) {
      const now = new Date().toISOString();
      const updatedPlant = {
        ...plant,
        careEvents: [
          ...plant.careEvents,
          {type: 'water' as const, createdAt: now},
        ],
      };
      cancelWateringNotification(plantId)
        .then(() => scheduleWateringNotification(updatedPlant))
        .catch(() => {});
    }
  },

  markFertilized: (plantId) => {
    const {logCareEvent} = get();
    logCareEvent(plantId, {type: 'fertilize'});
  },
}));
