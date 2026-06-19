'use client';

import { StatusBar } from '@/components/exhibition/StatusBar';
import { ExhibitionMap } from '@/components/exhibition/ExhibitionMap';
import { ChatBot } from '@/components/exhibition/ChatBot';
import { EventInfo } from '@/components/exhibition/EventInfo';
import { RobotInventory } from '@/components/exhibition/RobotInventory';
import { Power } from 'lucide-react';

import { useRobotMQTT, RobotMode } from '@/hooks/useRobotMQTT';
import { useState, useEffect } from 'react';

const MODE_CONFIG: Record<NonNullable<RobotMode>, { icon: string; cls: string }> = {
  IDLE:      { icon: '😴', cls: 'text-slate-300'  },
  PAUSED:    { icon: '⏸',  cls: 'text-amber-300'  },
  WAITING:   { icon: '⏳', cls: 'text-blue-300'   },
  EXECUTING: { icon: '🚀', cls: 'text-green-400'  },
  NAV_BUSY:  { icon: '🚀', cls: 'text-green-400'  },
  DOCKING:   { icon: '🔌', cls: 'text-cyan-300'   },
  RESTING:   { icon: '💤', cls: 'text-indigo-300' },
  CHARGING:  { icon: '⚡', cls: 'text-yellow-300' },
};

const FORCE_OFF_EVENTS = ['power_off', 'http_force_off', 'ble_force_off'];

export default function Home() {
  const { isInteractionPaused, resumeCountdown, robotMode, lastBleEvent } = useRobotMQTT();
  const [showForceOffAlert, setShowForceOffAlert] = useState(false);

  useEffect(() => {
    if (!lastBleEvent) return;
    if (FORCE_OFF_EVENTS.includes(lastBleEvent.name)) {
      setShowForceOffAlert(true);
    }
  }, [lastBleEvent]);

  const modeCfg = robotMode ? MODE_CONFIG[robotMode] : null;

  return (
    <div
      className="h-screen w-full bg-background text-foreground dark overflow-hidden flex flex-col select-none"
      onDragStart={e => e.preventDefault()}
    >

      <div className="flex-shrink-0">
        <StatusBar />
      </div>

      <div className="px-4 py-4 flex-1 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">

          <div className="lg:col-span-2 flex flex-col gap-4 h-full min-h-0">
            <div className="flex-1 min-h-0">
              <ExhibitionMap />
            </div>
            <div className="flex-shrink-0">
              <ChatBot />
            </div>
          </div>

          <div className="h-full flex flex-col gap-4 overflow-hidden">
            <div className="flex-shrink-0">
              <EventInfo />
            </div>
            <div className="flex-1 min-h-0 bg-slate-800/20 rounded-2xl p-2 border border-white/5">
              <RobotInventory />
            </div>
          </div>

        </div>
      </div>

      {/* Alert cắt điện khẩn cấp */}
      {showForceOffAlert && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#0d1829] border border-amber-500/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 mx-auto">
              <Power className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-white text-center mb-2">
              Robot bị cắt điện khẩn cấp
            </h3>
            <p className="text-slate-400 text-sm text-center mb-1">
              Nguồn điện đã bị ngắt ngay lập tức.
            </p>
            <p className="text-slate-500 text-xs text-center mb-6">
              Event:{' '}
              <span className="text-amber-400 font-mono">{lastBleEvent?.name}</span>
              {' '}· Pin:{' '}
              <span className="text-amber-400">{lastBleEvent?.soc}%</span>
            </p>
            <button
              onClick={() => setShowForceOffAlert(false)}
              className="w-full py-3 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

    </div>
  );
}