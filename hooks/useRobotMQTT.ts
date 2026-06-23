import { useState, useEffect, useCallback } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { Network } from '@capacitor/network';
import { db } from '@/lib/db';
import {
  bleInit,
  bleConnect,
  bleSendCommand,
  isBleConnected,
  OPCODE,
  type BleStatusPayload,
  type BleEventPayload,
  type PowerState,
} from '@/lib/ble';

/* ================================
   TYPES
================================ */

export interface RobotStatePayload {
  time: number;
  state: string;
}

export interface RobotPosePayload {
  time: number;
  x: number;
  y: number;
  yaw: number;
}

export interface RobotFeedbackPayload {
  command_id: string;
  status: string;
}

export type RobotMode =
  | 'IDLE'
  | 'PAUSED'
  | 'WAITING'
  | 'NAV_BUSY'
    | 'EXECUTING'
  | 'DOCKING'
  | 'RESTING'
  | 'CHARGING'
  | null;

export type DrawerJamStatus = 'ok' | 'retrying' | 'jammed';

/* ================================
   GLOBAL MQTT SINGLETON
================================ */

let client: MqttClient | null = null;
let isInitialized = false;

/* ================================
   GLOBAL SHARED STATE
================================ */

type Listener = () => void; // kiểu: hàm không tham số, không trả về gì

const listeners = new Set<Listener>(); // danh sách các hàm đó

const globalState = {
  isConnected: false, // Trạng thái kết nối MQTT
  robotStatus: null as string | null,
  robotMode: 'IDLE' as RobotMode,
  pose: null as RobotPosePayload | null,
  feedback: null as RobotFeedbackPayload | null,
  isInteractionPaused: false, // Đang pause do user tương tác?
  resumeCountdown: 0,     // Đếm ngược tự resume (giây)
  drawerOpen: false,
  isManualPaused: false,  // User bấm pause thủ công?
  drawerJamStatus: 'ok' as DrawerJamStatus,
  drawerJamId: null as number | null,

  // ── BLE: nguồn chính cho pin + điều khiển nguồn ──
  // battery giờ lấy từ BLE (soc), không còn lấy từ MQTT robot/battery/soc nữa.
  battery: null as number | null,
  bleConnected: false,
  powerState: null as PowerState | null, // 0=OFF 1=ON 2=WAIT_PI 3=POST_ACK
  bleStatus: null as BleStatusPayload | null,
  lastBleEvent: null as BleEventPayload | null,
  powerCommandPending: false, // đang chờ phản hồi sau khi gửi lệnh ON/OFF
   isLocked: false,  // ← NEW: đang chờ chạm lần 2
};

function notifyAll() {
  listeners.forEach(listener => listener()); // yêu cầu render lại các phần tử trong listener
}

/* ================================
   BLE INIT
================================ */

let bleInitialized = false;

async function initBLE() {
  if (bleInitialized) return;
  bleInitialized = true;

  try {
    await bleInit();
    await bleConnect(
      // onStatus
      (status: BleStatusPayload) => {
        globalState.battery = status.soc;
        globalState.powerState = status.powerState;
        globalState.bleStatus = status;
        globalState.bleConnected = true;
        // Có status mới về tức là lệnh ON/OFF trước đó (nếu có) đã có phản
        // hồi rõ ràng từ phần cứng — không cần giữ "pending" nữa.
        globalState.powerCommandPending = false;
        notifyAll();
      },
      // onEvent
      (event: BleEventPayload) => {
        globalState.lastBleEvent = event;
        globalState.powerCommandPending = false;

        if (event.name === 'ble_cmd_rejected') {
          console.error('🚫 BLE: lệnh bị từ chối — auth token sai, kiểm tra lại AUTH_TOKEN trong lib/ble.ts khớp với firmware');
        } else {
          console.log(`🔔 BLE event: ${event.name} (soc=${event.soc}%, uptime=${event.uptimeS}s)`);
        }
        notifyAll();
      },
      // onDisconnected
      () => {
        globalState.bleConnected = false;
        console.warn('🔌 BLE: ESP32 đã ngắt kết nối');
        notifyAll();
      },
    );

    globalState.bleConnected = true;
    notifyAll();
    console.log('⚡ BLE Connected tới ESP32 PowerSwitch');
  } catch (err) {
    globalState.bleConnected = false;
    console.error('❌ BLE init/connect lỗi:', err);
    notifyAll();
  }
}

/* ================================
   MQTT INIT
================================ */

async function initMQTT() {
  if (isInitialized) return;
  isInitialized = true;
  // const brokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER 
  // ?? 'wss://b85b204370d243129a46f5b35f9db2a9.s1.eu.hivemq.cloud:8884/mqtt';
  // const brokerUrl = 'ws://localhost:9001';
  const brokerUrl = 'ws://192.168.4.1:9001'; // pi5
  //  const brokerUrl = 'ws://172.24.36.100:9001';
client = mqtt.connect(brokerUrl, {
      username: process.env.NEXT_PUBLIC_MQTT_USER ?? 'Tuandang',
      password: process.env.NEXT_PUBLIC_MQTT_PASS ?? 'Tuan123@',
      reconnectPeriod: 3000,
      connectTimeout: 5000,
      keepalive: 10,
    });

  let hasInternet = true;

  Network.getStatus().then(status => {
    hasInternet = status.connected;
  });

  Network.addListener('networkStatusChange', status => {
    hasInternet = status.connected;
    console.log(`📡 Internet: ${hasInternet ? 'Online' : 'Offline'}`);
  });

  client.on('connect', () => {
    console.log('⚡ MQTT Connected');
    globalState.isConnected = true;
    notifyAll();

    const topics = [
      'robot/battery/soc', // không còn dùng để hiển thị (xem §BLE), giữ subscribe phòng khi cần đối chiếu/debug
      'robot/state/state', // docking,charging
      'robot/state/pose',
      'robot/state/service_feedback', // succeeded
      'robot/drawer/state',
    ];

    topics.forEach(topic => { // Lặp qua từng topic
      client?.subscribe(topic, err => {
        if (err) console.error(`❌ Subscribe lỗi ${topic}`, err);
      });
    });
  });

  client.on('message', (topic, message) => {
    const payload = message.toString();

    try {
      let parsedPayload: any;

      if (topic === 'robot/battery/soc') {
        // Pin giờ lấy từ BLE (xem initBLE/onStatus). Giữ lại parse ở đây
        // chỉ để log/đối chiếu khi cần debug, KHÔNG ghi vào globalState.battery nữa.
        const batteryValue = parseFloat(payload);
        parsedPayload = batteryValue;
      }

        else if (topic === 'robot/state/state') {
          let stateStr: string | null = null;
          try {
            const parsed = JSON.parse(payload);
            // Thử lấy từ cấu trúc lồng { data: { state } }
            if (parsed?.data?.state) {
              stateStr = parsed.data.state;
            } else if (parsed?.state) {
              stateStr = parsed.state;
            }
          } catch {
            stateStr = payload; // fallback plain string
          }

          if (stateStr) {
            console.log('🔍 stateStr:', stateStr, '| upper:', stateStr.toUpperCase());
            globalState.robotStatus = stateStr;
            const VALID_MODES: RobotMode[] = [
              'IDLE', 'PAUSED', 'WAITING', 'EXECUTING', 'DOCKING', 'RESTING', 'CHARGING', 'NAV_BUSY'
            ];
            const upper = stateStr.toUpperCase() as RobotMode; // viết hoa
            globalState.robotMode = VALID_MODES.includes(upper) ? upper : null; //điều_kiện ? giá_trị_nếu_true : giá_trị_nếu_false; đúng thì lưu
            console.log('🔍 robotMode set to:', globalState.robotMode);
          }
        }

        else if (topic === 'robot/state/pose') {
          try {
            const parsed = JSON.parse(payload);
            const inner = parsed?.data ?? parsed; // ← lấy inner.data nếu có
            if (typeof inner.x === 'number') {
              globalState.pose = {
                time: inner.time ?? parsed.ts ?? 0,
                x: inner.x, // chạy vào x lấy giá trị { "x": 1.2, "y": 3.4, "yaw": 0.5 }
                y: inner.y,
                yaw: inner.yaw,
              };
            }
          } catch {
            console.error('❌ Parse pose lỗi');
          }
        }

        else if (topic === 'robot/state/service_feedback') {
          try {
            const parsed = JSON.parse(payload);
            const inner = parsed?.data ?? parsed;
            const data: RobotFeedbackPayload = {
              command_id: inner.command_id,
              status: inner.status,
            };
            if (data.status) {
              globalState.feedback = data;
            }
          } catch (err) {
            console.error('❌ Parse service_feedback lỗi', err);
          }
        }

      else if (topic === 'robot/drawer/state') {
        parsedPayload = payload;

        // Parse jam status
        try {
          const data = JSON.parse(payload) as { drawer: number; state: string };
          if (data.state === 'JAM-RETRYING') {
            globalState.drawerJamStatus = 'retrying';
            globalState.drawerJamId = data.drawer;
            console.warn(`⚠️ Ngăn ${data.drawer} đang bị kẹt, Pi5 đang retry...`);
          } else if (data.state === 'JAMMED') {
            globalState.drawerJamStatus = 'jammed';
            globalState.drawerJamId = data.drawer;
            console.warn(`🚨 Ngăn ${data.drawer} bị kẹt nghiêm trọng!`);
          } else if (data.state === 'CLOSED') {
            // Phục hồi bình thường khi đóng thành công
            globalState.drawerJamStatus = 'ok';
            globalState.drawerJamId = null;
          }
        } catch {
          // JSON không hợp lệ — fallback regex, không xử lý jam ở đây
        }

        window.dispatchEvent(new CustomEvent('drawer_state', { detail: payload })); // cho robot inventory nghe window.addEventListener('drawer_state', handleDrawerState);
      }

      notifyAll();

      if (!hasInternet) {
        db.syncQueue.add({
          topic,
          payload: parsedPayload,
          timestamp: Date.now(),
        }).catch(err => console.error('❌ DB lỗi', err));
      }

    } catch (err) {
      console.error(`❌ MQTT parse lỗi ${topic}`, err);
    }
  });

  client.on('offline', () => {
    console.warn('⚠️ MQTT Offline');
    globalState.isConnected = false;
    notifyAll();
  });

  client.on('close', () => {
    console.warn('🔌 MQTT Closed');
    globalState.isConnected = false;
    notifyAll();
  });

  client.on('error', err => {
    console.error('❌ MQTT Error', err);
    globalState.isConnected = false;
    notifyAll();
  });
}

/* ================================
   GLOBAL INTERACTION PAUSE
================================ */

let interactionInitialized = false;
let resumeTimeout: NodeJS.Timeout;
let countdownInterval: NodeJS.Timeout;
let isPaused = false;
let interactedAfterDrawer = false;
let isNavigating = false;

function startResumeTimer() {
  clearTimeout(resumeTimeout);
  clearInterval(countdownInterval);
  globalState.resumeCountdown = 30;
  notifyAll();

  countdownInterval = setInterval(() => {
    globalState.resumeCountdown--;
    notifyAll();
    if (globalState.resumeCountdown <= 0) clearInterval(countdownInterval);
  }, 1000);

resumeTimeout = setTimeout(() => {
  if (!client || !client.connected) return;
  if (globalState.isManualPaused) return;

  isPaused = false;
  globalState.isInteractionPaused = false;
  globalState.resumeCountdown = 0;
  clearInterval(countdownInterval);

  if (globalState.drawerOpen) {
    console.log('⏸ Timer 30s hết, ngăn vẫn mở → chờ Pi5 gửi CLOSED');
    notifyAll();
    return;
  }

  client.publish('robot/cmd/resume', JSON.stringify({}));
  globalState.isLocked = true; // ← giữ nguyên: lock lại sau khi tự resume
  notifyAll();
  console.log('▶️ AUTO RESUME sau 30s → lock lại');
}, 30000);
}

function initInteractionPause() {
  if (interactionInitialized) return;
  interactionInitialized = true;

    const handleInteraction = (e: MouseEvent | TouchEvent) => {
      if (!client || !client.connected) return;
      // if (isNavigating) return;

      // Đang lock → chạm này là lần đầu: unlock
      if (globalState.isLocked) {
        globalState.isLocked = false;
        notifyAll();
        console.log('🔓 UNLOCK');
      }

      // AutoPause: chỉ pause nếu robot đang ở trạng thái hoạt động (đang chạy/chờ)
      const mode = globalState.robotMode;
      const shouldPause = mode === 'WAITING' || mode === 'EXECUTING' || mode === 'NAV_BUSY';

      if (shouldPause) {
        if (!isPaused) {
          isPaused = true;
          globalState.isInteractionPaused = true;
          client.publish('robot/cmd/pause', JSON.stringify({}));
          console.log('🛑 AUTO PAUSE');
        }
        startResumeTimer(); // reset lại 30s mỗi lần chạm trong khi robot đang pause
      }
    };

  window.addEventListener('touchstart', handleInteraction);
  window.addEventListener('mousedown', handleInteraction);
}

/* ================================
   HOOK
================================ */

export const useRobotMQTT = () => {
  const [, forceUpdate] = useState({}); //const [tên_biến, hàm_cập_nhật] = useState(giá_trị_ban_đầu);

  useEffect(() => {
    initMQTT();
    initBLE(); // BLE chạy song song với MQTT, kết nối ngay từ đầu (không chờ MQTT lỗi mới kết nối)
    initInteractionPause(); // 2. Kích hoạt tính năng tự động Pause khi user chạm màn hình

    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const publishCommand = useCallback(
    (topic: string, payload: any) => {
      if (!client || !client.connected) {
        console.warn('⚠️ MQTT chưa kết nối');
        return;
      }

      // Chặn mọi lệnh khi ngăn đang bị kẹt (trừ lệnh khẩn cấp cancel/estop)
      const ALLOWED_WHEN_JAMMED = ['robot/cmd/cancel_request', 'robot/cmd/estop'];
      if (
        globalState.drawerJamStatus !== 'ok' &&
        !ALLOWED_WHEN_JAMMED.includes(topic)
      ) {
        console.warn(`🚫 Lệnh bị chặn do ngăn đang JAM: ${topic}`);
        return;
      }

      const message = typeof payload === 'string' ? payload : JSON.stringify(payload); 
      //điều_kiện ? giá_trị_1 : giá_trị_2
      client.publish(topic, message, err => {
        if (err) console.error(`❌ Publish lỗi ${topic}`, err);
        else console.log(`📤 ${topic}`, payload);
      });
    },
    []
  );

  /**
   * Gửi lệnh đóng/mở nguồn qua BLE (không qua MQTT — đây là mục đích chính
   * của BLE: hoạt động được cả khi mất mạng/WiFi tới Pi5).
   * Toggle thông minh: tự dựa vào powerState hiện tại để quyết định gửi
   * opcode ON hay SHUTDOWN. Nếu chưa biết powerState (null, chưa có status
   * lần nào), mặc định coi là đang OFF → gửi lệnh ON.
   */
  const togglePower = useCallback(async () => {
    if (!isBleConnected()) {
      console.warn('⚠️ BLE chưa kết nối — không thể gửi lệnh nguồn');
      return;
    }

    const currentlyOn = globalState.powerState === 1; // 1 = ON
    const opcode = currentlyOn ? OPCODE.SHUTDOWN : OPCODE.ON;

    globalState.powerCommandPending = true;
    notifyAll();

    try {
      await bleSendCommand(opcode);
      console.log(`📤 BLE: đã gửi lệnh ${currentlyOn ? 'SHUTDOWN' : 'ON'}, chờ event/status phản hồi...`);
    } catch (err) {
      globalState.powerCommandPending = false;
      console.error('❌ BLE gửi lệnh nguồn lỗi:', err);
      notifyAll();
    }
  }, []);

  return {
    isConnected: globalState.isConnected,
    battery: globalState.battery,
    robotStatus: globalState.robotStatus,
    robotMode: globalState.robotMode,
    pose: globalState.pose,
    feedback: globalState.feedback,
    isInteractionPaused: globalState.isInteractionPaused,
    resumeCountdown: globalState.resumeCountdown,
    drawerJamStatus: globalState.drawerJamStatus,
    drawerJamId: globalState.drawerJamId,
     isLocked: globalState.isLocked, // ← NEW
    publishCommand,

    // BLE / Power
    bleConnected: globalState.bleConnected,
    powerState: globalState.powerState,
    bleStatus: globalState.bleStatus,
    lastBleEvent: globalState.lastBleEvent,
    powerCommandPending: globalState.powerCommandPending,
    togglePower,
  };
};

/* ================================
   EXPORTED HELPERS
================================ */

export function forceSetPaused() {
  isPaused = true;
  globalState.isInteractionPaused = true;
  startResumeTimer();
  notifyAll();
  console.log('🛑 forceSetPaused → timer 10s bắt đầu');
}

export function forceSetPausedManual() {
  isPaused = true;
  globalState.isInteractionPaused = true;
  clearTimeout(resumeTimeout);
  clearInterval(countdownInterval);
  globalState.resumeCountdown = 0;
  notifyAll();
  console.log('🛑 MANUAL PAUSE — không tự resume');
}

export function forceResumeInteraction() {
  isPaused = false;
  globalState.isInteractionPaused = false;
  globalState.resumeCountdown = 0;
  clearTimeout(resumeTimeout);
  clearInterval(countdownInterval);
  notifyAll();
}

export function setDrawerOpen(open: boolean) {
  globalState.drawerOpen = open;
  if (open) {
    interactedAfterDrawer = false;
  }
}

export function getInteractedAfterDrawer() {
  return interactedAfterDrawer;
}

export function setNavigating(value: boolean) {
  isNavigating = value;
  console.log(`🗺️ Navigating mode: ${value}`);
}

export function getIsPaused() {
  return isPaused;
}

export function setManualPaused(value: boolean) {
  globalState.isManualPaused = value;
}

export function getIsManualPaused() {
  return globalState.isManualPaused;
}

export function getRobotMode() {
  return globalState.robotMode;
}
export function getDrawerOpen() {
  return globalState.drawerOpen;
}

export function lockScreen() {
  globalState.isLocked = true;
  notifyAll();
  console.log('🔒 lockScreen');
}

export function resetLock() {
  globalState.isLocked = false;
  notifyAll();
  console.log('🔓 resetLock');
}