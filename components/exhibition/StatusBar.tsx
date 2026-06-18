'use client';

import { Battery, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRobotMQTT, RobotMode } from '@/hooks/useRobotMQTT';

const MODE_CONFIG: Record<NonNullable<RobotMode>, { icon: string; cls: string }> = {
  IDLE:     { icon: '😴', cls: 'text-slate-400'  },
  PAUSED:   { icon: '⏸',  cls: 'text-amber-300'  },
  WAITING:  { icon: '⏳', cls: 'text-blue-300'   },
  EXECUTING: { icon: '🚀', cls: 'text-green-400'  },
  NAV_BUSY: { icon: '🚀', cls: 'text-green-400'  },
  DOCKING:  { icon: '🔌', cls: 'text-cyan-300'   },
  RESTING:  { icon: '💤', cls: 'text-indigo-300' },
  CHARGING: { icon: '⚡', cls: 'text-yellow-300' },
};

export function StatusBar() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const { isConnected, battery, robotMode } = useRobotMQTT();

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

  const modeCfg = robotMode ? MODE_CONFIG[robotMode] : null;

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
          <div className="flex items-center gap-1 bg-secondary/50 border border-border/30 rounded-full px-2 py-0.5">
            <Battery className={`w-3 h-3 ${battery !== null && battery <= 20 ? 'text-red-400' : 'text-green-400'}`} />
            <span className="text-xs font-semibold text-foreground">
              {battery !== null ? `${battery.toFixed(0)}%` : '--%'}
            </span>
          </div>
          {/* <div className="flex items-center gap-1 bg-secondary/50 border border-border/30 rounded-full px-2 py-0.5">
            <Users className="w-3 h-3 text-blue-400" />
            <span className="text-xs font-semibold text-foreground">142</span>
          </div> */}
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
    </div>
  );
}