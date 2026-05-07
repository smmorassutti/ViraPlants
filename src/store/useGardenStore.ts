import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {Garden} from '../types/garden';
import {listMyGardens} from '../services/gardenService';

type GardenState = {
  ownGardenId: string | null;
  activeGardenId: string | null;
  gardens: Garden[];
  isLoading: boolean;
};

type GardenActions = {
  loadGardens: (currentUserId: string) => Promise<void>;
  setActiveGarden: (gardenId: string) => void;
  clearOnSignOut: () => void;
};

type GardenStore = GardenState & GardenActions;

export const useGardenStore = create<GardenStore>()(
  persist(
    (set, get) => ({
      ownGardenId: null,
      activeGardenId: null,
      gardens: [],
      isLoading: false,

      loadGardens: async currentUserId => {
        set({isLoading: true});
        try {
          const gardens = await listMyGardens();
          const ownGardenId = currentUserId;
          const persisted = get().activeGardenId;
          const stillValid =
            !!persisted && gardens.some(g => g.gardenId === persisted);
          set({
            gardens,
            ownGardenId,
            activeGardenId: stillValid ? persisted : ownGardenId,
            isLoading: false,
          });
        } catch (err) {
          console.warn('[useGardenStore] loadGardens failed', err);
          set({isLoading: false});
        }
      },

      setActiveGarden: gardenId => set({activeGardenId: gardenId}),

      clearOnSignOut: () =>
        set({
          ownGardenId: null,
          activeGardenId: null,
          gardens: [],
          isLoading: false,
        }),
    }),
    {
      name: 'vira:activeGardenId',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({activeGardenId: state.activeGardenId}),
    },
  ),
);
