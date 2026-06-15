'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, Locate, Navigation, MapPin, RotateCcw, ChevronDown, Maximize, Trash2, GripVertical } from 'lucide-react';
import { Reorder } from 'framer-motion';
import { useRobotMQTT, forceSetPausedManual, setNavigating, setManualPaused, getDrawerOpen } from '@/hooks/useRobotMQTT';

// ═══════════════════════════════════════════════════════════════════════════════
//  MAP CONFIG — my_vietduc_3b_map.pgm (1135x350px)
//  resolution: 0.05 m/px | origin: [0, 0, 0] (góc trái dưới)
// ═══════════════════════════════════════════════════════════════════════════════
const MAP_RES   = 0.05;
const MAP_OX    = 0.0;
const MAP_OY    = 0.0;
const MAP_PX_W  = 1135;
const MAP_PX_H  = 350;
const DISPLAY_S = 5;
const MAP_W = MAP_PX_W * DISPLAY_S;
const MAP_H = MAP_PX_H * DISPLAY_S;

function rosToDisplay(rx: number, ry: number) {
  const px = (rx - MAP_OX) / MAP_RES;
  const py = MAP_PX_H - (ry - MAP_OY) / MAP_RES;
  return { x: px * DISPLAY_S, y: py * DISPLAY_S };
}

// function displayToRos(dx: number, dy: number) {
//   const px = dx / DISPLAY_S;
//   const py = dy / DISPLAY_S;
//   return { x: px * MAP_RES + MAP_OX, y: (MAP_PX_H - py) * MAP_RES + MAP_OY };
// }

const BOOTHS = [
  { id: 'DOCK',  name: 'Dock',        ros_x: 6.62135, ros_y: 6.52340, color: '#f97316', icon: '🔌', desc: 'Trạm sạc robot' },
  { id: 'WC',    name: 'Nhà vệ sinh', ros_x: 7.76175, ros_y: 8.68889, color: '#06b6d4', icon: '🚻', desc: 'Nhà vệ sinh' },
  { id: 'R1',    name: 'Phòng 1',     ros_x: 14.0532, ros_y: 8.76577, color: '#ef4444', icon: '🏪', desc: 'Gian hàng phòng 1' },
  { id: 'R2',    name: 'Phòng 2',     ros_x: 17.0131, ros_y: 6.67717, color: '#f59e0b', icon: '🏪', desc: 'Gian hàng phòng 2' },
  { id: 'R3',    name: 'Phòng 3',     ros_x: 18.7271, ros_y: 8.76577, color: '#22c55e', icon: '🏪', desc: 'Gian hàng phòng 3' },
  { id: 'R4',    name: 'Phòng 4',     ros_x: 24.8787, ros_y: 8.76577, color: '#3b82f6', icon: '🏪', desc: 'Gian hàng phòng 4' },
  { id: 'R5',    name: 'Phòng 5',     ros_x: 26.3214, ros_y: 6.67717, color: '#8b5cf6', icon: '🏪', desc: 'Gian hàng phòng 5' },
  { id: 'R6',    name: 'Phòng 6',     ros_x: 36.6769, ros_y: 8.76577, color: '#ec4899', icon: '🏪', desc: 'Gian hàng phòng 6' },
  { id: 'R7',    name: 'Phòng 7',     ros_x: 41.8303, ros_y: 8.76577, color: '#14b8a6', icon: '🏪', desc: 'Gian hàng phòng 7' },
  { id: 'R8',    name: 'Phòng 8',     ros_x: 41.5576, ros_y: 6.67717, color: '#eab308', icon: '🏪', desc: 'Gian hàng phòng 8' },
].map(b => ({ ...b, ...rosToDisplay(b.ros_x, b.ros_y) }));

const ROBOT_START_ROS = { x: 2.0, y: 7.6 };

// ═══════════════════════════════════════════════════════════════════════════════
//  CANVAS DRAW HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
// function drawCorridor(ctx: CanvasRenderingContext2D, scale: number) {
//   const W = MAP_W, H = MAP_H;
//   ctx.fillStyle = '#0d1829';
//   ctx.beginPath();
//   (ctx as any).roundRect(0, 0, W, H, 20);
//   ctx.fill();

//   ctx.strokeStyle = 'rgba(56,189,248,0.04)';
//   ctx.lineWidth = 0.8 / scale;
//   for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
//   for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

//   ctx.shadowColor = 'rgba(56,189,248,0.35)';
//   ctx.shadowBlur = 8 / scale;
//   ctx.strokeStyle = 'rgba(56,189,248,0.6)';
//   ctx.lineWidth = 2.5 / scale;
//   ctx.beginPath(); ctx.moveTo(20, 20); ctx.lineTo(W - 20, 20); ctx.stroke();
//   ctx.beginPath(); ctx.moveTo(20, H - 20); ctx.lineTo(W - 20, H - 20); ctx.stroke();
//   ctx.lineWidth = 2 / scale;
//   ctx.beginPath(); ctx.moveTo(20, 20); ctx.lineTo(20, H - 20); ctx.stroke();
//   ctx.beginPath(); ctx.moveTo(W - 20, 20); ctx.lineTo(W - 20, H - 20); ctx.stroke();
//   ctx.shadowBlur = 0;

//   ctx.strokeStyle = 'rgba(56,189,248,0.13)';
//   ctx.lineWidth = 1 / scale;
//   ctx.setLineDash([12 / scale, 8 / scale]);
//   ctx.beginPath(); ctx.moveTo(20, H / 2); ctx.lineTo(W - 20, H / 2); ctx.stroke();
//   ctx.setLineDash([]);

//   ctx.strokeStyle = 'rgba(56,189,248,0.18)';
//   ctx.lineWidth = 1 / scale;
//   ctx.beginPath(); (ctx as any).roundRect(0, 0, W, H, 20); ctx.stroke();

//   const br = 18, bt = 3;
//   ctx.strokeStyle = '#38bdf8';
//   ctx.lineWidth = bt / scale;
//   ctx.shadowColor = 'rgba(56,189,248,0.7)';
//   ctx.shadowBlur = 5 / scale;
//   for (const [cx, cy, sx, sy] of [[0,0,1,1],[W,0,-1,1],[0,H,1,-1],[W,H,-1,-1]] as [number,number,number,number][]) {
//     ctx.beginPath();
//     ctx.moveTo(cx + sx * br, cy);
//     ctx.lineTo(cx, cy);
//     ctx.lineTo(cx, cy + sy * br);
//     ctx.stroke();
//   }
//   ctx.shadowBlur = 0;

//   ctx.fillStyle = 'rgba(56,189,248,0.25)';
//   ctx.font = `${9 / scale}px monospace`;
//   ctx.textAlign = 'center';
//   for (let ros_x = 0; ros_x <= 55; ros_x += 5) {
//     const dx = rosToDisplay(ros_x, 0).x;
//     ctx.fillText(ros_x + 'm', dx, H - 5);
//     ctx.strokeStyle = 'rgba(56,189,248,0.2)';
//     ctx.lineWidth = 0.8 / scale;
//     ctx.beginPath(); ctx.moveTo(dx, H - 16); ctx.lineTo(dx, H - 20); ctx.stroke();
//   }
// }

function drawPath(
  ctx: CanvasRenderingContext2D, scale: number,
  from: { x: number; y: number }, to: { x: number; y: number },
  fromRos: { x: number; y: number }, toRos: { x: number; y: number },
  dashOffset: number
) {
  ctx.strokeStyle = 'rgba(56,189,248,0.55)';
  ctx.lineWidth = 2.5 / scale;
  ctx.setLineDash([8 / scale, 5 / scale]);
  ctx.lineDashOffset = -dashOffset / scale;
  ctx.shadowColor = 'rgba(56,189,248,0.4)';
  ctx.shadowBlur = 4 / scale;
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.shadowBlur = 0;

  const dist = Math.hypot(toRos.x - fromRos.x, toRos.y - fromRos.y);
  const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
  const label = dist.toFixed(1) + 'm';
  ctx.font = `${9 / scale}px monospace`;
  const fw = ctx.measureText(label).width;
  const pw = fw + 10 / scale, ph = 14 / scale;
  ctx.fillStyle = 'rgba(7,12,24,0.88)';
  ctx.strokeStyle = 'rgba(56,189,248,0.3)';
  ctx.lineWidth = 0.5 / scale;
  ctx.beginPath(); (ctx as any).roundRect(mx - pw / 2, my - ph / 2, pw, ph, 3 / scale); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, mx, my);
  ctx.textBaseline = 'alphabetic';
}

function drawBooths(ctx: CanvasRenderingContext2D, scale: number, selectedId: string | null, navStatus: NavStatus) {
  for (const b of BOOTHS) {
    const isSel = b.id === selectedId;

// ── THÊM: làm mờ booth không được chọn khi đang di chuyển
    const isMoving = navStatus === 'moving' || navStatus === 'queued';
    const shouldDim = isMoving && !isSel; // đang đi + không phải điểm đến → mờ

    const r = 13 / scale;
     ctx.globalAlpha = shouldDim ? 0.3 : 1.0; // THÊM  // ← mờ 30% hoặc bình thường

    if (isSel) {
      ctx.beginPath(); ctx.arc(b.x, b.y, r * 2, 0, Math.PI * 2);
      ctx.strokeStyle = b.color + '40'; ctx.lineWidth = 1.5 / scale; ctx.stroke();
    }
    ctx.shadowColor = b.color;
    ctx.shadowBlur = isSel ? 18 / scale : 7 / scale;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fillStyle = isSel ? b.color : b.color + 'cc'; ctx.fill();
    ctx.strokeStyle = '#070c18'; ctx.lineWidth = 2.5 / scale; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = `${12 / scale}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.icon, b.x, b.y + 0.5 / scale);
    ctx.strokeStyle = b.color + '70'; ctx.lineWidth = 1.5 / scale;
    ctx.beginPath(); ctx.moveTo(b.x, b.y + r + 1 / scale); ctx.lineTo(b.x, b.y + r + 9 / scale); ctx.stroke();
    ctx.font = `${9 / scale}px sans-serif`;
    const fw = ctx.measureText(b.name).width;
    const pw = fw + 10 / scale, ph = 14 / scale;
    const labelY = b.y + r + 9 / scale;
    ctx.fillStyle = 'rgba(7,12,24,0.92)';
    ctx.strokeStyle = isSel ? b.color + '60' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5 / scale;
    ctx.beginPath(); (ctx as any).roundRect(b.x - pw / 2, labelY, pw, ph, 3 / scale); ctx.fill(); ctx.stroke();
    ctx.fillStyle = isSel ? '#fff' : '#cbd5e1';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.name, b.x, labelY + ph / 2);
    ctx.textBaseline = 'alphabetic';
  }
   ctx.globalAlpha = 1.0; // ← reset về bình thường sau khi vẽ xong
}

function drawRobot(
  ctx: CanvasRenderingContext2D, scale: number,
  pos: { x: number; y: number }, rosPos: { x: number; y: number },
  pulseT: number, status: 'idle' | 'moving' | 'arrived' | 'queued' | 'canceling' | 'planning'
) {
  const r = 16 / scale;
  const color = status === 'arrived' ? '#22c55e' : status === 'canceling' ? '#ef4444' : '#fbbf24';
  for (let i = 0; i < 2; i++) {
    const progress = (pulseT + i * 0.5) % 1;
    const pr = r * (1 + progress * 1.6);
    const alpha = 0.45 * (1 - progress);
    ctx.beginPath(); ctx.arc(pos.x, pos.y, pr, 0, Math.PI * 2);
    ctx.strokeStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
    ctx.lineWidth = 1 / scale; ctx.stroke();
  }
  ctx.shadowColor = color; ctx.shadowBlur = 20 / scale;
  ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = '#070c18'; ctx.lineWidth = 2.5 / scale; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.font = `${14 / scale}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🤖', pos.x, pos.y + 0.5 / scale);
  const coord = `(${rosPos.x.toFixed(2)}, ${rosPos.y.toFixed(2)})`;
  ctx.font = `${8 / scale}px monospace`;
  const fw = ctx.measureText(coord).width;
  const pw = fw + 10 / scale, ph = 14 / scale;
  const ly = pos.y + r + 6 / scale;
  ctx.fillStyle = 'rgba(7,12,24,0.92)';
  ctx.strokeStyle = color + '50'; ctx.lineWidth = 0.5 / scale;
  ctx.beginPath(); (ctx as any).roundRect(pos.x - pw / 2, ly, pw, ph, 3 / scale); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(coord, pos.x, ly + ph / 2);
  ctx.textBaseline = 'alphabetic';
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════════════════
type NavStatus = 'idle' | 'planning' | 'moving' | 'canceling' | 'queued' | 'arrived';
type RouteItem = { id: string; x: number; y: number; ros_x: number; ros_y: number; boothId: string; boothName: string; commandId?: string };

// ── [THÊM MỚI] State cho dialog khi lệnh FAILED ──
type FailedDialogState = {
  failedBoothName: string;   // tên điểm bị failed để hiển thị
  remainingQueue: RouteItem[]; // queue còn lại sau khi xóa điểm failed
} | null;

const STATUS_DOT: Record<NavStatus, string> = {
  idle:      'bg-slate-500',
  planning:  'bg-yellow-400 animate-pulse',
  moving:    'bg-green-400 animate-pulse',
  canceling: 'bg-red-400 animate-pulse',
  queued:    'bg-yellow-400 animate-pulse',
  arrived:   'bg-green-400',
};

function getStatusText(status: NavStatus, navMessage: string): string {
  switch (status) {
    case 'idle':      return 'Sẵn sàng · Chọn gian hàng hoặc chạm bản đồ';
    case 'planning':  return 'Đang lên lộ trình...';
    case 'moving':    return `Đang di chuyển ....`;
    case 'canceling': return navMessage || 'Đang dừng robot...';
    case 'queued':    return navMessage || 'Đang chờ thực thi...';
    case 'arrived':   return '✓ Đã đến đích!';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export function ExhibitionMap() {
  const { pose, feedback, publishCommand } = useRobotMQTT();

  const [scale, setScale]           = useState(0.2);
  const [offset, setOffset]         = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const clickOrigin                 = useRef({ x: 0, y: 0 });
  const dragStart                   = useRef({ x: 0, y: 0 });
  const mapContainerRef             = useRef<HTMLDivElement>(null);
  const canvasRef                   = useRef<HTMLCanvasElement>(null);
  const animRef                     = useRef<number>(0);
  const pulseRef                    = useRef(0);

  const mapImageRef = useRef<HTMLImageElement | null>(null);


  const [robotPos, setRobotPos] = useState(rosToDisplay(ROBOT_START_ROS.x, ROBOT_START_ROS.y));
  const [robotRos, setRobotRos] = useState(ROBOT_START_ROS);

  const [goalPos, setGoalPos]             = useState<{ x: number; y: number } | null>(null);
  const [goalRos, setGoalRos]             = useState<{ x: number; y: number } | null>(null);
  const [selectedBooth, setSelectedBooth] = useState<string | null>(null);
  const [navStatus, setNavStatus]         = useState<NavStatus>('idle');
  const [navMessage, setNavMessage]       = useState('');
  const [showBoothList, setShowBoothList] = useState(false);
  // const [eta, setEta]                     = useState(0);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

    // ── [THÊM MỚI] State dialog FAILED ──
    const [failedDialog, setFailedDialog] = useState<FailedDialogState>(null);

    const [isModalOpen, setIsModalOpen]       = useState(false);  // Sidebar lộ trình đang mở không — false = ẩn, true = hiện.
    const [routeQueue, setRouteQueue]         = useState<RouteItem[]>([]);
    const [isManualPaused, setIsManualPaused] = useState(false); // đổi màu nút pause
    const routeQueueRef = useRef(routeQueue);
    useEffect(() => { routeQueueRef.current = routeQueue; }, [routeQueue]);  // routeQueue thay đổi => useeffect chạy => routequeue.current đúng
    useEffect(() => { setNavigating(isModalOpen); }, [isModalOpen]); // để quyết định có autopause không, nếu isModalOpen = false mới cho

            useEffect(() => {
              const img = new Image();
              img.src = '/my_vietduc_3b_map.png';

              img.onload = () => {
                mapImageRef.current = img;
              };
            }, []);

    const stateRef = useRef({ robotPos, robotRos, goalPos, goalRos, selectedBooth, navStatus, scale, offset });
    useEffect(() => {
      stateRef.current = { robotPos, robotRos, goalPos, goalRos, selectedBooth, navStatus, scale, offset };
    }, [robotPos, robotRos, goalPos, goalRos, selectedBooth, navStatus, scale, offset]);

  // ─── Canvas render loop ───
  useEffect(() => {
    function loop() {
      pulseRef.current = (pulseRef.current + 0.016) % 1;
      const canvas = canvasRef.current;
      const container = mapContainerRef.current;
      if (!canvas || !container) { animRef.current = requestAnimationFrame(loop); return; }
      const W = container.clientWidth, H = container.clientHeight;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const ctx = canvas.getContext('2d');  // hàm vẽ 2D của canvas
      if (!ctx) { animRef.current = requestAnimationFrame(loop); return; }
      const { robotPos, robotRos, goalPos, goalRos, selectedBooth, navStatus, scale, offset } = stateRef.current;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(scale, scale);
      if (mapImageRef.current) {
          ctx.drawImage(   //// vẽ ảnh bản đồ
            mapImageRef.current,
            0,
            0,
            MAP_W,
            MAP_H
          );}
        // } else {
        //   drawCorridor(ctx, scale);
        // }
      if (goalPos && goalRos) drawPath(ctx, scale, robotPos, goalPos, robotRos, goalRos, pulseRef.current * 13); //// Chỉ vẽ đường path khi CÓ điểm đến
      drawBooths(ctx, scale, selectedBooth, navStatus); // vẽ đường đi
      drawRobot(ctx, scale, robotPos, robotRos, pulseRef.current, navStatus); // vẽ robot  lên bản đồ với 6 tham số:
      ctx.restore();
      animRef.current = requestAnimationFrame(loop);
    }
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  useEffect(() => {
    if (!pose) return;
    setRobotPos(rosToDisplay(pose.x, pose.y)); // chuyển tọa độ ROS (mét) → tọa độ pixel trên canvas
    setRobotRos({ x: pose.x, y: pose.y }); // dùng để hiển thị label (14.05, 8.76) bên dưới robot, lưu tọa độ thật 
  }, [pose]);

  // useEffect(() => {
  //   if (navStatus !== 'moving' || eta <= 0) return;
  //   const t = setTimeout(() => setEta(e => Math.max(0, e - 1)), 1000);
  //   return () => clearTimeout(t);
  // }, [navStatus, eta]);

  useEffect(() => {
    if (!feedback) return;
    const { status, command_id } = feedback; // status     = 'SUCCEEDED' / 'FAILED' / 'EXECUTING'... // command_id = 'nav_1717123456_0' (ID lệnh Pi5 đang phản hồi)
    const isValid = routeQueueRef.current.some(item => item.commandId === command_id); // CHECK id, isValid sẽ trả về TRUE nếu có ID khớp
    if (!isValid && status !== 'NAV_UNAVAILABLE') return;

    switch (status) {
      case 'SUCCEEDED':
        setNavMessage('aaaaaaaaaaa');
        setRouteQueue(prev => {
          const remaining = prev.filter(item => item.commandId !== command_id); // Xóa lệnh vừa SUCCEEDED khỏi queue
          if (remaining.length === 0) {
            setSelectedBooth(null); setGoalPos(null); setGoalRos(null); setNavStatus('arrived');
          } else {
            setGoalPos({ x: remaining[0].x, y: remaining[0].y });
            setGoalRos({ x: remaining[0].ros_x, y: remaining[0].ros_y });
            setSelectedBooth(remaining[0].boothId);
            setNavStatus('moving');
          }
          return remaining;
        });
        break;

      case 'EXECUTING':
        setNavMessage(''); setNavStatus('moving');
        setRouteQueue(prev => {
          const current = prev.find(item => item.commandId === command_id) ?? prev[0];
          if (current) {
            setGoalPos({ x: current.x, y: current.y });
            setGoalRos({ x: current.ros_x, y: current.ros_y });
            setSelectedBooth(current.boothId);
            // const dRos = Math.hypot(current.ros_x - (pose?.x ?? 0), current.ros_y - (pose?.y ?? 0));
            // setEta(Math.ceil(dRos / 0.5));
          }
          return prev;
        });
        break;

      case 'NAV_BUSY':
        setNavMessage(''); setNavStatus('moving');
        setRouteQueue(prev => {
          const current = prev.find(item => item.commandId === command_id) ?? prev[0];
          if (current) {
            setGoalPos({ x: current.x, y: current.y });
            setGoalRos({ x: current.ros_x, y: current.ros_y });
            setSelectedBooth(current.boothId);
            // const dRos = Math.hypot(current.ros_x - (pose?.x ?? 0), current.ros_y - (pose?.y ?? 0));
            // setEta(Math.ceil(dRos / 0.5));
          }
          return prev;
        });
        break;

      case 'CANCELING':  setNavStatus('canceling'); setNavMessage('Đang dừng robot...'); break;

      case 'CANCELED':
        setNavStatus('idle'); setGoalPos(null); setGoalRos(null);
        // setSelectedBooth(null); setEta(0); setIsManualPaused(false); setNavMessage('');
        setShowCancelDialog(true);
        break;

      case 'ACCEPTED':            setNavStatus('queued'); setNavMessage('Robot đã nhận lệnh, đang chuẩn bị...'); break;
      case 'QUEUED_WHILE_PAUSED': setNavStatus('queued'); setNavMessage('Robot đang tạm dừng, chờ tiếp tục...'); break;
      case 'PREEMPTED':           setNavStatus('queued'); setNavMessage('Task bị ngắt, đang xếp lại hàng...'); break;
      case 'PREEMPTED_BY_DOCK':   setNavStatus('queued'); setNavMessage('Robot về sạc pin, task sẽ tiếp tục sau...'); break;
      case 'PAUSED':              setNavStatus('queued'); setNavMessage('Task bị tạm dừng bởi operator...'); break;

      // ── [SỬA] FAILED — xóa điểm failed, hỏi user thay vì alert() ──
      case 'FAILED': {
        setRouteQueue(prev => {
          const failedItem = prev.find(item => item.commandId === command_id);
          const remaining  = prev.filter(item => item.commandId !== command_id);

          // Cập nhật goal sang điểm tiếp theo (nếu có) để bản đồ không bị trống
          if (remaining.length > 0) {
            setGoalPos({ x: remaining[0].x, y: remaining[0].y });
            setGoalRos({ x: remaining[0].ros_x, y: remaining[0].ros_y });
            setSelectedBooth(remaining[0].boothId);
            setNavStatus('queued'); // robot đang tự chạy lệnh tiếp theo
          } else {
            setGoalPos(null); setGoalRos(null);
            setSelectedBooth(null); setNavStatus('idle');
          }

          // Hiện dialog thông báo
          setFailedDialog({
            failedBoothName: failedItem?.boothName ?? 'Điểm không xác định',
            remainingQueue: remaining,
          });

          return remaining;
        });
        break;
      }

      case 'REJECTED':
        setNavStatus('idle'); setRouteQueue([]); setGoalPos(null); setGoalRos(null); setSelectedBooth(null);
        setNavMessage('Lệnh bị từ chối (robot đang sạc hoặc E-stop)');
        break;

      case 'NAV_UNAVAILABLE':
        setNavStatus('idle'); setRouteQueue([]); setGoalPos(null); setGoalRos(null); setSelectedBooth(null);
        setNavMessage('Navigation không khả dụng!');
        break;
    }
  }, [feedback]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const mx = (e.clientX - rect.left - offset.x) / scale;
    const my = (e.clientY - rect.top  - offset.y) / scale;
    for (const b of BOOTHS) {
      if (Math.hypot(mx - b.x, my - b.y) < 20 / scale) { addToRoute(b); break; }
    }
  }, [isDragging, offset, scale]);

  const handleDown = (e: React.MouseEvent | React.TouchEvent) => {
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(false);
    clickOrigin.current = { x: cx, y: cy };
    dragStart.current = { x: cx - offset.x, y: cy - offset.y };
  };
  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if ('buttons' in e && e.buttons !== 1) return;
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    if (Math.hypot(cx - clickOrigin.current.x, cy - clickOrigin.current.y) > 5) {
      setIsDragging(true);
      setOffset({ x: cx - dragStart.current.x, y: cy - dragStart.current.y });
    }
  };
  const handleUp = () => { setTimeout(() => setIsDragging(false), 80); };

  const startRoute = useCallback(() => {
    const queue = routeQueueRef.current;
    if (queue.length === 0) return;
    setIsManualPaused(false); setManualPaused(false);
    setNavMessage('Đang gửi lệnh...'); setNavStatus('queued');
    setGoalPos({ x: queue[0].x, y: queue[0].y });
    setGoalRos({ x: queue[0].ros_x, y: queue[0].ros_y });
    setSelectedBooth(queue[0].boothId);
    const resumeTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null };
    const queueWithIds = queue.map((goal, idx) => {
      const commandId = `nav_${Date.now()}_${idx}`;
      setTimeout(() => {
        publishCommand('robot/cmd/service_request', {
          command_id: commandId,
          data: { x: goal.ros_x, y: goal.ros_y, yaw: 0, customer_id: 'tablet', timeout_sec: 10, return_to_patrol: false, priority: 5, speed_limit_ms: 0.5 },
        });
      }, idx * 150);
      return { ...goal, commandId };
    });
    setRouteQueue(queueWithIds);
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => {
      publishCommand('robot/cmd/resume', {});
    }, queue.length * 150 + 200);
  }, [publishCommand]);

  const togglePause = () => {
    if (getDrawerOpen()) { // ← dùng getter thay vì globalState
    console.log('ngăn đang mở → không resume');
    setIsManualPaused(false);
    setManualPaused(false);
    return;}
   if (isManualPaused) {
      publishCommand('robot/cmd/resume', {}); setIsManualPaused(false); setManualPaused(false);
    } else {
      publishCommand('robot/cmd/pause', {}); forceSetPausedManual(); setIsManualPaused(true); setManualPaused(true);
    }
  };
  const cancelNav = () => publishCommand('robot/cmd/cancel_request', { command_id: '*' });

  const addToRoute = (booth: typeof BOOTHS[0]) => {
    if (!isModalOpen) setIsModalOpen(true);
    setRouteQueue(prev => {
      if (prev[prev.length - 1]?.boothId === booth.id) return prev;
      return [...prev, { id: Math.random().toString(36).substr(2, 9), x: booth.x, y: booth.y, ros_x: booth.ros_x, ros_y: booth.ros_y, boothId: booth.id, boothName: booth.name }];
    });
  };
  const removeFromRoute = (index: number) => setRouteQueue(prev => prev.filter((_, i) => i !== index));

  const focusRobot = () => {
    const container = mapContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setOffset({ x: rect.width / 2 - robotPos.x * scale, y: rect.height / 2 - robotPos.y * scale });
  };
  const adjustZoom = (d: number) => setScale(s => Math.min(Math.max(0.1, s + d), 2));
  const resetMap   = () => { setScale(0.2); setOffset({ x: 0, y: 0 }); };

  const isNavActive  = ['moving', 'canceling', 'queued'].includes(navStatus);
  const infoEtaText  = navStatus === 'arrived' ? '✓ Đã đến' : navStatus === 'canceling' ? 'Dừng' : navStatus === 'queued' ? 'Chờ...' : 'Đang đi...';
  const infoEtaColor = navStatus === 'arrived' ? 'text-green-400' : navStatus === 'canceling' ? 'text-red-400' : navStatus === 'queued' ? 'text-yellow-400' : 'text-blue-400';

  return (
    <div className={isModalOpen
      ? 'fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md p-4 md:p-6 flex flex-col md:flex-row gap-4'
      : 'relative w-full h-full bg-[#070c18] rounded-2xl overflow-hidden border border-sky-500/20 shadow-2xl flex flex-col'
    }>
      <div className="relative flex-1 w-full h-full rounded-2xl overflow-hidden border border-sky-500/15 shadow-2xl flex flex-col bg-[#070c18] shrink-0"
        onClick={(e) => { if (!isModalOpen && !isDragging && !(e.target as HTMLElement).closest('button')) setIsModalOpen(true); }}>

        {/* HEADER */}
        <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
          <div className="p-3 bg-gradient-to-b from-[#070c18]/97 via-[#070c18]/80 to-transparent">
            <div className="flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/22 flex items-center justify-center text-sky-400 text-sm font-bold">◈</div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">Navigation Map</h2>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[navStatus]}`} />
                    {getStatusText(navStatus, navMessage)}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 bg-white/[0.03] p-1 rounded-lg border border-white/[0.07] backdrop-blur-md">
                <button className="p-1.5 text-slate-500 hover:text-white hover:bg-white/[0.07] rounded transition-colors" onClick={() => adjustZoom(0.05)}><ZoomIn className="w-3.5 h-3.5" /></button>
                <button className="p-1.5 text-slate-500 hover:text-white hover:bg-white/[0.07] rounded transition-colors" onClick={focusRobot}><Locate className="w-3.5 h-3.5" /></button>
                <button className="p-1.5 text-slate-500 hover:text-white hover:bg-white/[0.07] rounded transition-colors" onClick={() => adjustZoom(-0.05)}><ZoomOut className="w-3.5 h-3.5" /></button>
                <div className="w-px bg-white/[0.07] mx-0.5" />
                <button className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 rounded transition-colors" onClick={resetMap}><Maximize className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <div className="mt-2 pointer-events-auto">
              <button onClick={() => setShowBoothList(!showBoothList)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[11px] text-slate-400 font-medium hover:bg-white/[0.07] transition backdrop-blur-md">
                <MapPin className="w-3 h-3 text-sky-400" />
                Chọn điểm đến ({BOOTHS.length})
                <ChevronDown className={`w-3 h-3 transition-transform ${showBoothList ? 'rotate-180' : ''}`} />
              </button>
              {showBoothList && (
                <div className="mt-1.5 grid grid-cols-4 gap-1.5 max-h-[200px] overflow-y-auto p-2 bg-[#070c18]/97 rounded-xl border border-white/[0.08] backdrop-blur-xl shadow-2xl">
                  {BOOTHS.map(b => (
                    <button key={b.id}
                      onClick={() => { addToRoute(b); setShowBoothList(false); }}
                      className={`px-2 py-2 rounded-lg text-left transition-all active:scale-95 border ${selectedBooth === b.id ? 'bg-white/10 border-white/20' : 'bg-white/[0.03] border-transparent hover:bg-white/[0.06]'}`}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.color, boxShadow: `0 0 4px ${b.color}` }} />
                        <span className="text-[10px] font-bold text-white truncate">{b.name}</span>
                      </div>
                      <div className="text-[8px] text-slate-500 truncate">{b.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isNavActive && (
              <button onClick={cancelNav}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 border border-red-500/25 rounded-lg text-[11px] text-red-300 font-semibold hover:bg-red-500/25 transition pointer-events-auto">
                <RotateCcw className="w-3 h-3" /> Huỷ điều hướng
              </button>
            )}
          </div>
        </div>

        {/* CANVAS */}
        <div ref={mapContainerRef}
          className="flex-1 w-full h-full overflow-hidden relative select-none"
          style={{
            background: '#070c18',
            backgroundImage: 'linear-gradient(rgba(56,189,248,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,0.035) 1px,transparent 1px)',
            backgroundSize: '32px 32px',
          }}
          onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}
          onTouchStart={handleDown} onTouchMove={handleMove} onTouchEnd={handleUp}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onClick={handleCanvasClick}
          />
        </div>

        {/* BOTTOM INFO BAR */}
        {(['moving','arrived','queued','canceling'] as NavStatus[]).includes(navStatus) && selectedBooth && (() => {
          const booth = BOOTHS.find(b => b.id === selectedBooth);
          if (!booth) return null;
          return (
            <div className="absolute bottom-0 left-0 right-0 z-30 p-3 bg-gradient-to-t from-[#070c18]/97 to-transparent pointer-events-none">
              <div className="bg-[#0d1829]/90 backdrop-blur-xl rounded-xl p-3 border border-sky-500/15 shadow-2xl pointer-events-auto flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: `${booth.color}15`, border: `1px solid ${booth.color}35` }}>
                  {booth.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white">{booth.name}</div>
                  <div className="text-[10px] text-slate-500">{navMessage || booth.desc}</div>
                </div>
                <div className="text-right">
                  <div className={`text-[11px] font-bold ${infoEtaColor}`}>{infoEtaText}</div>
                  <div className="text-[9px] text-slate-600">
                    {navStatus === 'arrived' ? 'Hoàn thành' : navStatus === 'queued' ? 'Queued' : 'ETA'}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* SIDEBAR */}
      {isModalOpen && (
        <div className="w-full md:w-80 h-full bg-[#0a0f1e] border border-sky-500/15 rounded-2xl p-4 flex flex-col shadow-2xl shrink-0 z-10 overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sky-400" />
              Lộ trình tuần tra
            </h3>
            <button onClick={() => setIsModalOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] text-slate-400 hover:text-white hover:bg-white/[0.1] transition">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {routeQueue.length === 0 ? (
              <div className="text-center text-slate-600 text-sm mt-10 p-4 border border-dashed border-slate-700/50 rounded-xl">
                Chưa có điểm đến nào.<br /><br />Hãy chạm vào các điểm trên bản đồ để thêm vào lộ trình.
              </div>
            ) : (
              <Reorder.Group axis="y" values={routeQueue} onReorder={setRouteQueue} className="space-y-2">
                {routeQueue.map((item, idx) => (
                  <Reorder.Item key={item.id} value={item}
                    className="bg-white/[0.04] border border-white/[0.05] p-3 rounded-xl flex items-center gap-3 relative overflow-hidden group touch-none cursor-grab active:cursor-grabbing">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-sky-500" />
                    <div className="flex items-center text-slate-600 hover:text-slate-300"><GripVertical className="w-5 h-5" /></div>
                    <div className="w-6 h-6 rounded-full bg-sky-500/15 text-sky-400 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{item.boothName}</div>
                      <div className="text-[10px] text-slate-600 font-mono">({item.ros_x.toFixed(2)}, {item.ros_y.toFixed(2)})</div>
                    </div>
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); removeFromRoute(idx); }}
                      disabled={isNavActive}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                        isNavActive ? 'opacity-30 cursor-not-allowed' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95'
                      }`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            )}
          </div>

          <div className="pt-4 border-t border-white/[0.07] mt-2">
            {navStatus === 'idle' || navStatus === 'arrived' ? (
              <>
                <div className="flex justify-between text-xs text-slate-500 mb-3">
                  <span>Tổng số điểm:</span>
                  <span className="font-bold text-white">{routeQueue.length}</span>
                </div>
                <button onClick={startRoute} disabled={routeQueue.length === 0}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2">
                  <Navigation className="w-4 h-4" /> Bắt đầu di chuyển
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <button onClick={togglePause}
                  className={`flex-1 py-3.5 rounded-xl text-[13px] font-bold text-white transition-all flex items-center justify-center gap-1.5 ${
                    isManualPaused ? 'bg-green-600 hover:bg-green-500' : 'bg-amber-500 hover:bg-amber-400'
                  }`}>
                  {isManualPaused ? '▶ Tiếp tục' : '⏸ Tạm dừng'}
                </button>
                <button onClick={cancelNav}
                  className="flex-1 py-3.5 rounded-xl text-[13px] font-bold text-red-300 bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 transition-all flex items-center justify-center gap-1.5">
                  <RotateCcw className="w-4 h-4" /> Huỷ lộ trình
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CANCEL DIALOG */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0a0f1e] border border-sky-500/15 rounded-2xl p-6 shadow-2xl w-80 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Đã dừng lộ trình</div>
                <div className="text-[11px] text-slate-500">Robot đang chờ lệnh tiếp theo</div>
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
              <div className="text-[10px] text-slate-500 mb-2">Còn {routeQueue.length} điểm chưa đến:</div>
              <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                {routeQueue.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-sky-500/15 text-sky-400 text-[9px] font-bold flex items-center justify-center shrink-0">{idx + 1}</div>
                    <span className="text-[11px] text-white truncate">{item.boothName}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setShowCancelDialog(false); startRoute(); }}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 transition-all flex items-center justify-center gap-2">
                <Navigation className="w-4 h-4" /> Tiếp tục từ điểm hiện tại
              </button>
              <button onClick={() => { setShowCancelDialog(false); setRouteQueue([]); }}
                className="w-full py-3 rounded-xl text-sm font-bold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 transition-all flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" /> Xóa lộ trình
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── [THÊM MỚI] FAILED DIALOG ── */}
      {failedDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0a0f1e] border border-red-500/20 rounded-2xl p-6 shadow-2xl w-80 flex flex-col gap-4">

            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center text-xl">
                ⚠️
              </div>
              <div>
                <div className="text-sm font-bold text-white">Không thể đến điểm</div>
                <div className="text-[11px] text-red-400 font-medium">{failedDialog.failedBoothName}</div>
              </div>
            </div>

            {/* Nội dung */}
            {failedDialog.remainingQueue.length > 0 ? (
              <>
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.05]">
                  <div className="text-[10px] text-slate-500 mb-2">
                    Robot sẽ tự di chuyển đến điểm tiếp theo:
                  </div>
                  <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                    {failedDialog.remainingQueue.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-sky-500/15 text-sky-400 text-[9px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </div>
                        <span className="text-[11px] text-white truncate">{item.boothName}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {/* Tiếp tục — robot tự chạy, chỉ đóng dialog */}
                  <button
                    onClick={() => setFailedDialog(null)}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 transition-all flex items-center justify-center gap-2">
                    <Navigation className="w-4 h-4" /> Tiếp tục lộ trình
                  </button>
                  {/* Huỷ tất cả */}
                  <button
                    onClick={() => {
                      setFailedDialog(null);
                      cancelNav();
                      setRouteQueue([]);
                      setGoalPos(null); setGoalRos(null);
                      setSelectedBooth(null); setNavStatus('idle');
                    }}
                    className="w-full py-3 rounded-xl text-sm font-bold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 transition-all flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" /> Huỷ toàn bộ lộ trình
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Không còn điểm nào */}
                <p className="text-[12px] text-slate-400 text-center">
                  Không còn điểm nào trong lộ trình.
                </p>
                <button
                  onClick={() => setFailedDialog(null)}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-slate-700 hover:bg-slate-600 transition-all">
                  Đóng
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}