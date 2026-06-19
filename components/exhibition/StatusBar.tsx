'use client';

import { Battery, Power, Loader2, Lock, Delete, Bluetooth } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRobotMQTT, RobotMode } from '@/hooks/useRobotMQTT';

const MODE_CONFIG: Record<NonNullable<RobotMode>, { icon: string; cls: string }> = {
  IDLE:      { icon: '😴', cls: 'text-slate-400'  },
  PAUSED:    { icon: '⏸',  cls: 'text-amber-300'  },
  WAITING:   { icon: '⏳', cls: 'text-blue-300'   },
  EXECUTING: { icon: '🚀', cls: 'text-green-400'  },
  NAV_BUSY:  { icon: '🚀', cls: 'text-green-400'  },
  DOCKING:   { icon: '🔌', cls: 'text-cyan-300'   },
  RESTING:   { icon: '💤', cls: 'text-indigo-300' },
  CHARGING:  { icon: '⚡', cls: 'text-yellow-300' },
};

const POWER_PIN = '1234'; // ← đổi PIN ở đây

export function StatusBar() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  // ── PIN dialog ──
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput]           = useState('');
  const [pinError, setPinError]           = useState(false);

  // ── Confirm OFF dialog ──
  const [showOffConfirm, setShowOffConfirm] = useState(false);

  const {
    isConnected, battery, robotMode,
    bleConnected, powerState, powerCommandPending, togglePower,
  } = useRobotMQTT();

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = mounted && now
    ? now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '--:--:--';
  const dateStr = mounted && now
    ? now.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' })
    : '---';

  const modeCfg   = robotMode ? MODE_CONFIG[robotMode] : null;
  const isPowerOn = powerState === 1;
  const powerBusy = powerCommandPending || powerState === 2 || powerState === 3;

  /* ── Bấm nút nguồn → mở PIN dialog ── */
  const handleTogglePower = () => {
    if (powerBusy) return;
    setPinInput('');
    setPinError(false);
    setShowPinDialog(true);
  };

  /* ── Nhập số PIN ── */
  const handlePinKey = (key: string) => {
    if (pinInput.length >= 4) return;
    const next = pinInput + key;
    setPinInput(next);
    setPinError(false);

    if (next.length === 4) {
      if (next === POWER_PIN) {
        setShowPinDialog(false);
        setPinInput('');
        if (isPowerOn) {
          setShowOffConfirm(true);
        } else {
          togglePower();
        }
      } else {
        setPinError(true);
        setTimeout(() => {
          setPinInput('');
          setPinError(false);
        }, 600);
      }
    }
  };

  const handlePinDelete = () => {
    setPinInput(p => p.slice(0, -1));
    setPinError(false);
  };

  const confirmTurnOff = () => {
    setShowOffConfirm(false);
    togglePower();
  };

  return (
    <div className="w-full bg-gradient-to-r from-primary/20 via-transparent to-primary/10 border-b border-border/50 px-4 py-1.5">
      <div className="flex items-center justify-between gap-2">

        {/* Logo + Name */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white text-xs flex-shrink-0">
            🤖
          </div>
          <div className="leading-none">
            <span className="text-xs font-bold text-foreground">Robot Tiếp Thị</span>
            <span className="text-xs text-muted-foreground ml-1">· Future Consumer Expo 2026</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-1.5 flex-shrink-0">

          {/* Pin */}
          <div className="flex items-center gap-1 bg-secondary/50 border border-border/30 rounded-full px-2 py-0.5">
            <Battery className={`w-3 h-3 ${battery !== null && battery <= 20 ? 'text-red-400' : 'text-green-400'}`} />
            <span className="text-xs font-semibold text-foreground">
              {battery !== null ? `${battery.toFixed(0)}%` : '--%'}
            </span>
          </div>

          {/* BLE indicator */}
          <div
            className="flex items-center gap-1 bg-secondary/50 border border-border/30 rounded-full px-2 py-0.5"
            title={bleConnected ? 'BLE đã kết nối ESP32' : 'BLE chưa kết nối'}
          >
            <Bluetooth className={`w-3 h-3 ${bleConnected ? 'text-blue-400' : 'text-slate-500'}`} />
            <span className={`text-xs font-semibold ${bleConnected ? 'text-blue-400' : 'text-slate-500'}`}>
              {bleConnected ? 'BLE' : 'BLE...'}
            </span>
          </div>

          {/* Nút nguồn — PIN bảo vệ, luôn bấm được (trừ khi đang busy) */}
          <button
            onClick={handleTogglePower}
            disabled={powerBusy}
            title={isPowerOn ? 'Tắt nguồn robot' : 'Mở nguồn robot'}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 border transition-colors ${
              powerBusy
                ? 'bg-secondary/50 border-border/30 text-amber-300 cursor-wait'
                : isPowerOn
                  ? 'bg-green-500/15 border-green-500/30 text-green-400 hover:bg-green-500/25'
                  : 'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25'
            }`}
          >
            {powerBusy
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Power className="w-3 h-3" />
            }
            <span className="text-xs font-semibold">
              {powerBusy ? '...' : isPowerOn ? 'ON' : 'OFF'}
            </span>
          </button>

        </div>

        {/* Clock + Date + RobotMode */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {modeCfg ? (
            <span className={`text-xs font-semibold uppercase tracking-wider ${modeCfg.cls}`}>
              {modeCfg.icon} {robotMode}
            </span>
          ) : (
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">— N/A</span>
          )}
          <span className="text-sm font-bold text-green-400 tabular-nums">{timeStr}</span>
          <span className="text-xs text-muted-foreground">{dateStr}</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}
            title={isConnected ? 'Đã kết nối Broker' : 'Mất kết nối'}
          />
        </div>

      </div>

      {/* ── PIN Dialog ── */}
      {showPinDialog && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#0d1829] border border-white/10 rounded-2xl p-6 w-72 shadow-2xl">

            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 mx-auto">
              <Lock className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-white text-center mb-1">Nhập PIN</h3>
            <p className="text-slate-500 text-xs text-center mb-5">Xác thực để điều khiển nguồn</p>

            {/* Chấm hiển thị PIN */}
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border-2 transition-all duration-150 ${
                    pinInput.length > i
                      ? pinError
                        ? 'bg-red-500 border-red-500'
                        : 'bg-blue-400 border-blue-400'
                      : 'bg-transparent border-slate-600'
                  }`}
                />
              ))}
            </div>

            {/* Bàn phím số */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {['1','2','3','4','5','6','7','8','9'].map(k => (
                <button
                  key={k}
                  onClick={() => handlePinKey(k)}
                  className="py-3 rounded-xl bg-white/[0.06] text-white text-lg font-semibold hover:bg-white/[0.12] active:scale-95 transition"
                >
                  {k}
                </button>
              ))}
              <div />
              <button
                onClick={() => handlePinKey('0')}
                className="py-3 rounded-xl bg-white/[0.06] text-white text-lg font-semibold hover:bg-white/[0.12] active:scale-95 transition"
              >
                0
              </button>
              <button
                onClick={handlePinDelete}
                className="py-3 rounded-xl bg-white/[0.06] text-slate-400 hover:bg-white/[0.12] active:scale-95 transition flex items-center justify-center"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={() => { setShowPinDialog(false); setPinInput(''); }}
              className="w-full py-2.5 rounded-xl bg-white/[0.04] text-slate-400 text-sm hover:bg-white/[0.08] transition"
            >
              Huỷ
            </button>

            {pinError && (
              <p className="text-red-400 text-xs text-center mt-3">PIN không đúng</p>
            )}
          </div>
        </div>
      )}

      {/* ── Confirm OFF Dialog ── */}
      {showOffConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#0d1829] border border-red-500/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 mx-auto">
              <Power className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-white text-center mb-2">Tắt nguồn robot?</h3>
            <p className="text-slate-400 text-sm text-center mb-6">
              Robot sẽ thực hiện quy trình tắt an toàn (graceful shutdown).
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowOffConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-white/[0.05] text-white text-sm font-bold hover:bg-white/[0.1] transition"
              >
                Huỷ
              </button>
              <button
                onClick={confirmTurnOff}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition shadow-lg shadow-red-500/20"
              >
                Tắt nguồn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
