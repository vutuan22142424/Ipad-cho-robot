'use client';

import { StatusBar } from '@/components/exhibition/StatusBar';
import { ExhibitionMap } from '@/components/exhibition/ExhibitionMap';
import { ChatBot } from '@/components/exhibition/ChatBot';
import { EventInfo } from '@/components/exhibition/EventInfo';
import { RobotInventory } from '@/components/exhibition/RobotInventory';

import { useRobotMQTT, RobotMode } from '@/hooks/useRobotMQTT';

const MODE_CONFIG: Record<NonNullable<RobotMode>, { icon: string; cls: string }> = {
  IDLE:     { icon: '😴', cls: 'text-slate-300' },
  PAUSED:   { icon: '⏸',  cls: 'text-amber-300' },
  WAITING:  { icon: '⏳', cls: 'text-blue-300'  },
  EXECUTING: { icon: '🚀', cls: 'text-green-400' },
  NAV_BUSY: { icon: '🚀', cls: 'text-green-400' },
  DOCKING:  { icon: '🔌', cls: 'text-cyan-300'  },
  RESTING:  { icon: '💤', cls: 'text-indigo-300' },
  CHARGING: { icon: '⚡', cls: 'text-yellow-300' },
};

export default function Home() {
  const { isInteractionPaused, resumeCountdown, robotMode } = useRobotMQTT();

  const modeCfg = robotMode ? MODE_CONFIG[robotMode] : null;

  return (
    <div
      className="h-screen w-full bg-background text-foreground dark overflow-hidden flex flex-col select-none"
      onDragStart={e => e.preventDefault()}
    >

      {/* DEBUG OVERLAY */}
      {/* <div className="fixed top-120 left-4 z-[9999]">
        <div className="bg-black/70 text-white px-4 py-2 rounded-xl border border-white/10 backdrop-blur-md text-sm shadow-lg">
          <div>
            Pause:
            <span className={`ml-2 font-bold ${isInteractionPaused ? 'text-red-400' : 'text-green-400'}`}>
              {isInteractionPaused ? 'YES' : 'NO'}
            </span>
          </div>
          <div>
            Resume in:
            <span className="ml-2 font-bold text-cyan-400">{resumeCountdown}s</span>
          </div>
          <div>
            Mode:
            <span className={`ml-2 font-bold ${modeCfg ? modeCfg.cls : 'text-slate-500'}`}>
              {modeCfg ? `${modeCfg.icon} ${robotMode}` : '— N/A'}
            </span>
          </div>
        </div>
      </div> */}

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
    </div>
  );
}
