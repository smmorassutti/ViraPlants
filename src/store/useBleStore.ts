import {create} from 'zustand';
import type {ViraPot, BleConnectionState} from '../types/ble';

type BleState = {
  pots: ViraPot[];
  connectionState: BleConnectionState;
  connectedPotId: string | null;
};

type BleActions = {
  setPots: (pots: ViraPot[]) => void;
  setConnectionState: (state: BleConnectionState) => void;
  setConnectedPot: (potId: string | null) => void;
};

type BleStore = BleState & BleActions;

export const useBleStore = create<BleStore>(set => ({
  pots: [],
  connectionState: 'disconnected',
  connectedPotId: null,

  setPots: pots => set({pots}),
  setConnectionState: connectionState => set({connectionState}),
  setConnectedPot: connectedPotId => set({connectedPotId}),
}));
