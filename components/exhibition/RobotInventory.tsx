import { useState, useEffect, useRef, useCallback } from 'react';
import { useRobotMQTT, setDrawerOpen, forceSetPaused, getInteractedAfterDrawer, getRobotMode, getIsManualPaused, DrawerJamStatus } from '@/hooks/useRobotMQTT';

function rgba(hex: string, alpha: number): string { // chuyển từ hex sang rgb để chỉnh trong suốt
  const clean = hex.replace('#', '').slice(0, 6);
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const DRAWERS = [
  { id: 1, name: 'ĐỒ UỐNG',   color: '#f85b00', top: '56%', left: '12%',   right: '15%' },
  { id: 2, name: 'ĐỒ ĂN NHẸ', color: '#00ff33', top: '40%', left: '13%',   right: '16%' },
  { id: 3, name: 'CATALOGUE',  color: '#4c00fe', top: '23%', left: '13.5%', right: '16%' },
];

export function RobotInventory() {
  const { publishCommand, drawerJamStatus, drawerJamId } = useRobotMQTT();
  const [openDrawer, setOpenDrawer] = useState<number | null>(null);
  const openDrawerRef = useRef<number | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    openDrawerRef.current = openDrawer;
  }, [openDrawer]);

  // Khi JAM được phục hồi (CLOSED) → reset openDrawer nếu còn đang hiện
  useEffect(() => {
    if (drawerJamStatus === 'ok' && openDrawerRef.current !== null) { // lúc này sẽ báo là kẹt ngăn nào đó 
      setOpenDrawer(null);
      openDrawerRef.current = null;
      setDrawerOpen(false);
    }
  }, [drawerJamStatus]);

  const handleClosed = useCallback((drawerId: number) => {  // hàm sử lý khi đóng ngăn
    setDrawerOpen(false);
    setOpenDrawer(null);
    openDrawerRef.current = null;

    const mode = getRobotMode();
    if (mode !== 'WAITING' && mode !== 'EXECUTING'&& mode !== 'NAV_BUSY') {
      console.log(`✅ Drawer ${drawerId} đóng → robot đứng yên, không resume`);
      return;
    }

    if (getIsManualPaused()) {
      console.log(`✅ Drawer ${drawerId} đóng → đang manual pause, không resume`);
      return;
    }

    if (getInteractedAfterDrawer()) {
      console.log(`✅ Drawer ${drawerId} đóng → có tương tác, autopause tự resume sau 10s`);
    } else {
      setTimeout(() => {
        if (getInteractedAfterDrawer()) return;
        publishCommand('robot/cmd/resume', {});
        console.log(`✅ Drawer ${drawerId} đóng → không tương tác, resume sau 5s`);
      }, 5000);
    }
  }, [publishCommand]); // bên trong sài hàm gì thì ghi lại, ko đổi tên

  useEffect(() => {
    const handleDrawerState = (e: CustomEvent) => {
      const msg = e.detail as string;

      try {
        const data = JSON.parse(msg) as { drawer: number; state: string };         //// msg ví dụ: {"drawer":2,"state":"CLOSED"}
        console.log('📩 Nhận drawer state:', data, '| openDrawer:', openDrawerRef.current);

        if (data.state === 'CLOSED' && data.drawer === openDrawerRef.current) {
          handleClosed(data.drawer);
        }
        // JAM states được xử lý trong useRobotMQTT, không cần xử lý ở đây
      } catch {
        try { // xử lý lần nữa nếu pi5 gửi dữ liệu hời hợt (drawer:2 state:CLOSED)
          const drawerMatch = msg.match(/drawer\s*:\s*(\d+)/);
          const stateMatch = msg.match(/state\s*:\s*(\w+)/);

          if (drawerMatch && stateMatch) {
            const drawer = parseInt(drawerMatch[1]);
            const state = stateMatch[1];
            console.log('📩 Parse thủ công:', { drawer, state }, '| openDrawer:', openDrawerRef.current);

            if (state === 'CLOSED' && drawer === openDrawerRef.current) {
              handleClosed(drawer);
            }
          }
        } catch {
          console.log('❌ Không xử lý được message:', msg);
        }
      }
    };

    window.addEventListener('drawer_state', handleDrawerState as EventListener);
    return () => window.removeEventListener('drawer_state', handleDrawerState as EventListener);
  }, [handleClosed]);

  const toggleDrawer = (id: number) => {  // hàm mở ngăn
    if (openDrawerRef.current === id) return; // đã mở ngăn rồi, ko mở nữa
    // Không cho mở ngăn khi đang JAM
    if (drawerJamStatus !== 'ok') return;

    setOpenDrawer(id);  // React re-render, highlight ngăn đang mở
    openDrawerRef.current = id; // ref để các useEffect khác đọc sync
    setDrawerOpen(true);     // báo globalState biết ngăn đang mở

    const mode = getRobotMode();
    if (mode === 'WAITING' || mode === 'EXECUTING' || mode === 'NAV_BUSY') {
      forceSetPaused();
      publishCommand('robot/cmd/pause', {});
    }

    publishCommand('robot/drawer/cmd', { drawer: id, cmd: 'OPEN' });

    setTimeout(() => {
      itemRefs.current[id - 1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);

    console.log(`📦 Mở ngăn ${id} → chờ {"drawer":${id},"state":"CLOSED"}`);
  };

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm flex h-full w-full bg-slate-900/40 relative border border-slate-700/50">

      {/* ── JAM OVERLAY ── */}
      {drawerJamStatus === 'jammed' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm rounded-2xl">
          <div className="text-4xl mb-3">🚨</div>
          <div className="text-sm font-bold text-red-400 mb-1">Ngăn {drawerJamId} bị kẹt nghiêm trọng</div>
          <div className="text-[11px] text-slate-400 text-center px-6">Vui lòng gọi kỹ thuật viên xử lý</div>
          <div className="mt-4 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-300 font-mono">
            JAMMED — Chờ Pi5 xử lý...
          </div>
        </div>
      )}

      {/* ── JAM RETRYING BANNER ── */}
      {drawerJamStatus === 'retrying' && (
        <div className="absolute top-2 left-2 right-2 z-40 flex items-center gap-2 px-3 py-2 bg-amber-500/20 border border-amber-500/30 rounded-xl backdrop-blur-sm">
          <span className="text-base animate-spin">⚙️</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-amber-300">Ngăn {drawerJamId} đang bị kẹt</div>
            <div className="text-[9px] text-amber-400/70">Pi5 đang tự xử lý, vui lòng chờ...</div>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        </div>
      )}

      <div className="flex-1 relative flex justify-center items-center overflow-hidden py-4 pl-2">
        <div className="relative h-full aspect-[430/920] max-h-[350px] lg:max-h-full">
          <img
            src="/robot.png"
            alt="Robot"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none drop-shadow-xl"
          />

          {DRAWERS.map(drawer => (
            <div
              key={drawer.id}
              onClick={() => toggleDrawer(drawer.id)}
              className={`absolute flex items-center justify-center transition-all duration-300 ${
                drawerJamStatus !== 'ok'
                  ? 'cursor-not-allowed opacity-50'
                  : openDrawer === drawer.id
                    ? 'animate-pulse cursor-pointer'
                    : 'hover:scale-[1.02] cursor-pointer'
              }`}
              style={{
                top: drawer.top, height: '14%',
                left: drawer.left, right: drawer.right,
                background: openDrawer === drawer.id
                  ? rgba(drawer.color, 0.58)
                  : rgba(drawer.color, 0.21),
                boxShadow: openDrawer === drawer.id
                  ? `0 0 45px ${rgba(drawer.color, 0.82)}, inset 0 0 30px ${rgba(drawer.color, 0.6)}`
                  : `0 0 20px ${rgba(drawer.color, 0.19)}, inset 0 0 10px ${rgba(drawer.color, 0.25)}`,
                border: openDrawer === drawer.id
                  ? `3px solid ${drawer.color}`
                  : `2px solid ${rgba(drawer.color, 0.7)}`,
                zIndex: openDrawer === drawer.id ? 20 : 10,
              }}
            >
              {openDrawer !== drawer.id && drawerJamStatus === 'ok' && (
                <div className="absolute inset-0 hover:bg-white/10 transition-colors" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="w-[45%] max-w-[220px] bg-slate-800/80 border-l border-white/10 p-2.5 sm:p-4 flex flex-col flex-shrink-0 backdrop-blur-md z-30">
        <div className="flex items-start sm:items-center bg-blue-500/10 border border-blue-500/20 sm:px-2.5 sm:py-2 rounded-lg mb-2 sm:mb-3 flex-shrink-0 shadow-inner">
          <span className="text-[12px] leading-none mt-0.5 sm:mt-0">👈</span>
          <span className="text-[9px] sm:text-[10.5px] text-blue-200 font-medium leading-tight">
            Chạm để mở ngăn
          </span>
        </div>

        <div
          className="flex pl-1 sm:pl-2 flex-col gap-2.5 overflow-y-auto pr-1 flex-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {DRAWERS.map((drawer, index) => {
            const isOpen = openDrawer === drawer.id;
            const isJammedDrawer = drawerJamStatus !== 'ok' && drawerJamId === drawer.id;
            return (
              <div
                key={drawer.id}
                ref={el => { itemRefs.current[index] = el; }}
                className={`rounded-xl p-2.5 border transition-all duration-300 ${
                  isOpen ? 'shadow-lg scale-[1.02]' : 'hover:brightness-110'
                }`}
                style={{
                  borderColor: isJammedDrawer
                    ? '#f59e0b'
                    : isOpen ? drawer.color : rgba(drawer.color, 0.25),
                  background: isJammedDrawer
                    ? 'rgba(245,158,11,0.08)'
                    : isOpen ? rgba(drawer.color, 0.13) : rgba(drawer.color, 0.06),
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${isOpen || isJammedDrawer ? 'animate-pulse' : ''}`}
                    style={{
                      background: isJammedDrawer ? '#f59e0b' : drawer.color,
                      boxShadow: isOpen ? `0 0 8px ${drawer.color}` : isJammedDrawer ? '0 0 8px #f59e0b' : 'none',
                    }}
                  />
                  <span className="text-[11px] font-bold text-white whitespace-nowrap">
                    {drawer.name}
                  </span>
                </div>

                {isOpen && !isJammedDrawer && (
                  <div
                    className="mt-1 w-full py-1.5 rounded-lg font-bold text-[7.5px] text-white uppercase text-center shadow-md"
                    style={{
                      background: drawer.color,
                      boxShadow: `0 2px 10px ${rgba(drawer.color, 0.31)}`,
                    }}
                  >
                    ĐANG MỞ — CHỜ ĐÓNG LẠI...
                  </div>
                )}

                {isJammedDrawer && drawerJamStatus === 'retrying' && (
                  <div className="mt-1 w-full py-1.5 rounded-lg font-bold text-[7.5px] text-amber-300 uppercase text-center bg-amber-500/20 border border-amber-500/30">
                    ⚙️ ĐANG THỬ LẠI...
                  </div>
                )}

                {isJammedDrawer && drawerJamStatus === 'jammed' && (
                  <div className="mt-1 w-full py-1.5 rounded-lg font-bold text-[7.5px] text-red-300 uppercase text-center bg-red-500/20 border border-red-500/30">
                    🚨 BỊ KẸT — GỌI KỸ THUẬT
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
