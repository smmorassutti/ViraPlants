import type {ViraPot, WateringSchedule} from '../types/ble';

/** BLE service for Vira Pot communication. Phase 2 implementation required. */
export const bleService = {
  /** Scan for nearby Vira Pots via BLE advertisement. Phase 2. */
  startScan(_onDiscover: (pot: ViraPot) => void): void {
    console.log('BLE scan not yet implemented');
  },

  /** Stop an active BLE scan. Phase 2. */
  stopScan(): void {
    console.log('BLE stopScan not yet implemented');
  },

  /** Connect to a Vira Pot by its BLE peripheral ID. Phase 2. */
  async connect(_potId: string): Promise<void> {
    throw new Error('BLE not yet implemented');
  },

  /** Disconnect from a connected Vira Pot. Phase 2. */
  async disconnect(_potId: string): Promise<void> {
    throw new Error('BLE not yet implemented');
  },

  /** Write a watering schedule to the pot's GATT characteristic. Phase 2. */
  async sendWateringSchedule(
    _potId: string,
    _schedule: WateringSchedule,
  ): Promise<void> {
    throw new Error('BLE not yet implemented');
  },

  /** Read the reservoir level from the pot's GATT characteristic. Phase 2. */
  async getReservoirLevel(_potId: string): Promise<number> {
    return 0;
  },

  /** Read the battery level from the pot's GATT characteristic. Phase 2. */
  async getBatteryLevel(_potId: string): Promise<number> {
    return 0;
  },
};
