/**
 * BLE module — kết nối trực tiếp tới ESP32 PowerSwitch & Battery.
 * Dùng song song với MQTT, không phụ thuộc Pi5/Internet (theo §6 tài liệu).
 *
 * ⚠️ CẦN XÁC NHẬN VỚI FIRMWARE TRƯỚC KHI DEPLOY THẬT:
 *   - SERVICE / CMD_CHAR / STATUS_CHAR / EVENT_CHAR (UUID)
 *   - AUTH_TOKEN
 *   - Thứ tự field trong Status (18 byte) và Event (6 byte)
 *   - Danh sách opcode, danh sách event code
 * Các giá trị dưới đây lấy từ tài liệu kỹ thuật do đội firmware cung cấp,
 * coi là placeholder cho tới khi đối chiếu trực tiếp với config.h thật.
 */

import { BleClient } from '@capacitor-community/bluetooth-le';
import { Preferences } from '@capacitor/preferences';

/* ================================
   GATT CONTRACT (đối chiếu firmware)
================================ */

export const SERVICE     = 'a1b2c3d4-0000-1000-8000-00805f9b34fb';
export const CMD_CHAR    = 'a1b2c3d4-0001-1000-8000-00805f9b34fb';
export const STATUS_CHAR = 'a1b2c3d4-0002-1000-8000-00805f9b34fb';
export const EVENT_CHAR  = 'a1b2c3d4-0003-1000-8000-00805f9b34fb';
export const AUTH_TOKEN  = 0xA17C9E21;

const SAVED_ID_KEY = 'ble_device_id';

/* ================================
   TYPES
================================ */

export type PowerState = 0 | 1 | 2 | 3; // OFF, ON, WAIT_PI, POST_ACK
export type PiStatus = 0 | 1 | 2 | 3 | 4; // unknown, starting, ready, shutting_down, offline

export interface BleStatusPayload {
  soc: number;
  voltageV: number;
  currentA: number;
  powerW: number;
  ocvV: number;
  cellV: number;
  powerState: PowerState;
  charging: boolean;
  latchRaw: boolean;
  piStatus: PiStatus;
  uptimeS: number;
}

export interface BleEventPayload {
  code: number;
  name: string;
  soc: number;
  uptimeS: number;
}

export const EVENT_NAMES = [
  'boot', 'button_on', 'button_shutdown', 'power_off', 'http_on',
  'http_shutdown', 'http_force_off', 'ble_on', 'ble_shutdown',
  'ble_force_off', 'ble_cmd_rejected', 'charger_connected',
  'charger_disconnected', 'soc_critical', 'soc_low', 'shutdown_request',
  'pong',
];

export const OPCODE = {
  ON: 0x01,
  SHUTDOWN: 0x02,
  FORCE_OFF: 0x03,
} as const;

/* ================================
   PARSE
================================ */

export function parseStatus(v: DataView): BleStatusPayload {
  const flags = v.getUint8(12); // giải các thông số của esp gửi , vì nó gửi 1 dãy 18bit
  return {
    soc: v.getUint8(0),
    voltageV: v.getUint16(1, true) / 1000,
    currentA: v.getInt16(3, true) / 1000,
    powerW: v.getUint16(5, true) / 1000,
    ocvV: v.getUint16(7, true) / 1000,
    cellV: v.getUint16(9, true) / 1000,
    powerState: v.getUint8(11) as PowerState,
    charging: (flags & 0x01) !== 0,
    latchRaw: (flags & 0x02) !== 0,
    piStatus: v.getUint8(13) as PiStatus,
    uptimeS: v.getUint32(14, true),
  };
}

export function parseEvent(v: DataView): BleEventPayload {
  const code = v.getUint8(0);
  return {
    code,
    name: EVENT_NAMES[code] ?? 'unknown',
    soc: v.getUint8(1),
    uptimeS: v.getUint32(2, true),
  };
}

/* ================================
   CONNECTION LIFECYCLE // để lưu ble lại nếu trước đó đã kết nối 1 lần rồi
================================ */

let connectedId: string | null = null;
let initialized = false;

export async function bleInit() {
  if (initialized) return;
  initialized = true;
  await BleClient.initialize({ androidNeverForLocation: true });
}

function scanOnce(): Promise<string> {
  console.log('[BLE] scanOnce() bắt đầu quét, lọc theo SERVICE =', SERVICE);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.warn('[BLE] scanOnce() TIMEOUT sau 15s — không tìm thấy thiết bị khớp SERVICE UUID');
      BleClient.stopLEScan().catch(() => {});
      reject(new Error('BLE scan timeout: không tìm thấy ESP32'));
    }, 15000);

    BleClient.requestLEScan({ services: [SERVICE] }, (result) => {
      console.log('[BLE] scanOnce() TÌM THẤY thiết bị:', result.device.deviceId, result.device.name);
      clearTimeout(timeout);
      BleClient.stopLEScan().catch(() => {});
      resolve(result.device.deviceId);
    }).catch((err) => {
      console.error('[BLE] scanOnce() requestLEScan lỗi:', err);
      reject(err);
    });
  });
}

export async function bleConnect(
  onStatus: (s: BleStatusPayload) => void,
  onEvent: (e: BleEventPayload) => void,
  onDisconnected: () => void,
) {
  console.log('[BLE] Bắt đầu bleConnect()...');
  await bleInit();
  console.log('[BLE] bleInit() xong.');

  const saved = (await Preferences.get({ key: SAVED_ID_KEY })).value;
  console.log('[BLE] deviceId đã lưu trước đó:', saved ?? '(chưa có, sẽ scan mới)');

  const deviceId = saved ?? (await scanOnce());
  console.log('[BLE] deviceId dùng để connect:', deviceId);

  if (!saved) {
    await Preferences.set({ key: SAVED_ID_KEY, value: deviceId });
  }

  try {
    console.log('[BLE] Đang connect()...');
    await BleClient.connect(deviceId, onDisconnected);
    console.log('[BLE] connect() thành công.');
  } catch (err) {
    console.warn('[BLE] connect() lần 1 lỗi, thử disconnect rồi connect lại:', err);
    // Quirk đã biết: session cũ còn sót có thể làm connect() đầu tiên fail
    // dù thực tế chưa có kết nối nào. Thử disconnect rồi connect lại.
    await BleClient.disconnect(deviceId).catch(() => {});
    await BleClient.connect(deviceId, onDisconnected);
    console.log('[BLE] connect() lần 2 thành công.');
  }

  console.log('[BLE] Đang startNotifications STATUS_CHAR...');
  await BleClient.startNotifications(deviceId, SERVICE, STATUS_CHAR, (v) =>
    onStatus(parseStatus(v)));
  console.log('[BLE] startNotifications STATUS_CHAR xong.');

  console.log('[BLE] Đang startNotifications EVENT_CHAR...');
  await BleClient.startNotifications(deviceId, SERVICE, EVENT_CHAR, (v) =>
    onEvent(parseEvent(v)));
  console.log('[BLE] startNotifications EVENT_CHAR xong.');

  connectedId = deviceId;
  console.log('[BLE] bleConnect() hoàn tất, connectedId =', connectedId);
}

export async function bleDisconnect() {
  if (connectedId) {
    await BleClient.disconnect(connectedId).catch(() => {});
    connectedId = null;
  }
}

export function isBleConnected() {
  return connectedId !== null;
}

/* ================================
   COMMAND
================================ */

export async function bleSendCommand(opcode: number) {
  if (!connectedId) throw new Error('BLE chưa kết nối tới ESP32');
  const buf = new Uint8Array(5);
  buf[0] = opcode;
  new DataView(buf.buffer).setUint32(1, AUTH_TOKEN, true);
  await BleClient.write(connectedId, SERVICE, CMD_CHAR, new DataView(buf.buffer));
}