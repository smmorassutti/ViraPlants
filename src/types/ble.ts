export interface ViraPot {
  id: string;
  name: string;
  rssi: number;
  isConnected: boolean;
  batteryLevel: number | null;
  reservoirLevel: number | null;
}

export interface WateringSchedule {
  frequencyDays: number;
  timeOfDay: string;
  amountMl: number;
}

export type BleConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';

export interface BleError {
  code: 'scan_failed' | 'connect_failed' | 'write_failed' | 'read_failed';
  message: string;
}
