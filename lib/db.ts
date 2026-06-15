import Dexie, { Table } from 'dexie';

export interface TelemetryData {
  id?: number;
  topic: string;
  payload: any;
  timestamp: number;
}

class RobotLocalDB extends Dexie {
  syncQueue!: Table<TelemetryData>; 

  constructor() {
    super('RobotLocalDB');
    // Định nghĩa bảng syncQueue với khóa chính là id tự tăng
    this.version(1).stores({
      syncQueue: '++id, topic, timestamp' // Các field có thể index để query
    });
  }
}

export const db = new RobotLocalDB();
