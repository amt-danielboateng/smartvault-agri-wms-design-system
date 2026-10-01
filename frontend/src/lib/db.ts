import Dexie, { type Table } from "dexie";

export interface IntakeTransaction {
  id?: number;
  farmerId: string;
  commodity: string;
  weightKg: number;
  moisturePercent: number;
  warehouseId: string;
  timestamp: number;
  synced: boolean;
  receiptHash?: string;
}

export interface SensorReading {
  id?: number;
  siloId: string;
  temperatureC: number;
  humidityPercent: number;
  timestamp: number;
}

class SmartVaultDB extends Dexie {
  intakeTransactions!: Table<IntakeTransaction>;
  sensorReadings!: Table<SensorReading>;

  constructor() {
    super("smartvault-agri-wms");
    this.version(1).stores({
      intakeTransactions: "++id, farmerId, warehouseId, synced, timestamp",
      sensorReadings: "++id, siloId, timestamp",
    });
  }
}

export const db = new SmartVaultDB();
