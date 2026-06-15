// 'use client';

// import React, { useState, useEffect, useRef } from 'react';
// import { ZoomIn, ZoomOut, Locate, Maximize } from 'lucide-react';

// // ═══════════════════════════════════════════════════════════════════════════════
// //  MAP CONFIG — giống ExhibitionMap gốc
// // ═══════════════════════════════════════════════════════════════════════════════
// const MAP_RES   = 0.05;
// const MAP_OX    = 0.082;
// const MAP_OY    = -2.884;
// const MAP_PX_W  = 902;
// const MAP_PX_H  = 163;
// const DISPLAY_S = 3;
// const MAP_W = MAP_PX_W * DISPLAY_S;
// const MAP_H = MAP_PX_H * DISPLAY_S;

// function rosToDisplay(rx: number, ry: number) {
//   const px = (rx - MAP_OX) / MAP_RES;
//   const py = MAP_PX_H - (ry - MAP_OY) / MAP_RES;
//   return { x: px * DISPLAY_S, y: py * DISPLAY_S };
// }

// // ═══════════════════════════════════════════════════════════════════════════════
// //  BOOTHS
// // ═══════════════════════════════════════════════════════════════════════════════
// const BOOTHS = [
//   { id: 'Q1', name: 'Quầy 1', ros_x: 7.00,  ros_y:  3.00, color: '#ef4444', desc: 'Gian hàng 1' },
//   { id: 'Q2', name: 'Quầy 2', ros_x: 10.07, ros_y: -0.41, color: '#f97316', desc: 'Gian hàng 2' },
//   { id: 'Q3', name: 'Quầy 3', ros_x: 11.89, ros_y:  2.94, color: '#22c55e', desc: 'Gian hàng 3' },
//   { id: 'Q4', name: 'Quầy 4', ros_x: 17.78, ros_y:  2.62, color: '#3b82f6', desc: 'Gian hàng 4' },
//   { id: 'Q5', name: 'Quầy 5', ros_x: 18.64, ros_y: -1.11, color: '#8b5cf6', desc: 'Gian hàng 5' },
//   { id: 'Q6', name: 'Quầy 6', ros_x: 23.37, ros_y:  2.56, color: '#06b6d4', desc: 'Gian hàng 6' },
//   { id: 'Q7', name: 'Quầy 7', ros_x: 34.15, ros_y:  2.18, color: '#ec4899', desc: 'Gian hàng 7' },
//   { id: 'Q8', name: 'Quầy 8', ros_x: 34.00, ros_y: -1.30, color: '#eab308', desc: 'Gian hàng 8' },
// ].map(b => ({ ...b, ...rosToDisplay(b.ros_x, b.ros_y) }));

// const ROBOT_START_ROS = { x: 0.90, y: 1.48 };

// // ═══════════════════════════════════════════════════════════════════════════════
// //  CANVAS DRAW HELPERS — giống hệt ExhibitionMap gốc
// // ═══════════════════════════════════════════════════════════════════════════════
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
//   for (let ros_x = 0; ros_x <= 40; ros_x += 5) {
//     const dx = rosToDisplay(ros_x, 0).x;
//     ctx.fillText(ros_x + 'm', dx, H - 5);
//     ctx.strokeStyle = 'rgba(56,189,248,0.2)';
//     ctx.lineWidth = 0.8 / scale;
//     ctx.beginPath(); ctx.moveTo(dx, H - 16); ctx.lineTo(dx, H - 20); ctx.stroke();
//   }
// }

// function drawBooths(ctx: CanvasRenderingContext2D, scale: number) {
//   for (const b of BOOTHS) {
//     const r = 13 / scale;
//     ctx.shadowColor = b.color;
//     ctx.shadowBlur = 7 / scale;
//     ctx.beginPath();
//     ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
//     ctx.fillStyle = b.color + 'cc';
//     ctx.fill();
//     ctx.strokeStyle = '#070c18';
//     ctx.lineWidth = 2.5 / scale;
//     ctx.stroke();
//     ctx.shadowBlur = 0;

//     ctx.font = `${12 / scale}px sans-serif`;
//     ctx.textAlign = 'center';
//     ctx.textBaseline = 'middle';
//     ctx.fillText('🏪', b.x, b.y + 0.5 / scale);

//     ctx.strokeStyle = b.color + '70';
//     ctx.lineWidth = 1.5 / scale;
//     ctx.beginPath();
//     ctx.moveTo(b.x, b.y + r + 1 / scale);
//     ctx.lineTo(b.x, b.y + r + 9 / scale);
//     ctx.stroke();

//     ctx.font = `${9 / scale}px sans-serif`;
//     const fw = ctx.measureText(b.name).width;
//     const pw = fw + 10 / scale, ph = 14 / scale;
//     const labelY = b.y + r + 9 / scale;
//     ctx.fillStyle = 'rgba(7,12,24,0.92)';
//     ctx.strokeStyle = 'rgba(255,255,255,0.1)';
//     ctx.lineWidth = 0.5 / scale;
//     ctx.beginPath(); (ctx as any).roundRect(b.x - pw / 2, labelY, pw, ph, 3 / scale); ctx.fill(); ctx.stroke();
//     ctx.fillStyle = '#cbd5e1';
//     ctx.textAlign = 'center';
//     ctx.textBaseline = 'middle';
//     ctx.fillText(b.name, b.x, labelY + ph / 2);
//     ctx.textBaseline = 'alphabetic';
//   }
// }

// function drawRobot(
//   ctx: CanvasRenderingContext2D,
//   scale: number,
//   pos: { x: number; y: number },
//   rosPos: { x: number; y: number },
//   pulseT: number,
//   isMoving: boolean
// ) {
//   const r = 16 / scale;
//   const color = isMoving ? '#22c55e' : '#fbbf24';

//   for (let i = 0; i < 2; i++) {
//     const progress = (pulseT + i * 0.5) % 1;
//     const pr = r * (1 + progress * 1.6);
//     const alpha = 0.45 * (1 - progress);
//     ctx.beginPath();
//     ctx.arc(pos.x, pos.y, pr, 0, Math.PI * 2);
//     ctx.strokeStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0');
//     ctx.lineWidth = 1 / scale;
//     ctx.stroke();
//   }

//   ctx.shadowColor = color;
//   ctx.shadowBlur = 20 / scale;
//   ctx.beginPath();
//   ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
//   ctx.fillStyle = color;
//   ctx.fill();
//   ctx.strokeStyle = '#070c18';
//   ctx.lineWidth = 2.5 / scale;
//   ctx.stroke();
//   ctx.shadowBlur = 0;

//   ctx.font = `${14 / scale}px sans-serif`;
//   ctx.textAlign = 'center';
//   ctx.textBaseline = 'middle';
//   ctx.fillText('🤖', pos.x, pos.y + 0.5 / scale);

//   const coord = `(${rosPos.x.toFixed(2)}, ${rosPos.y.toFixed(2)})`;
//   ctx.font = `${8 / scale}px monospace`;
//   const fw = ctx.measureText(coord).width;
//   const pw = fw + 10 / scale, ph = 14 / scale;
//   const ly = pos.y + r + 6 / scale;
//   ctx.fillStyle = 'rgba(7,12,24,0.92)';
//   ctx.strokeStyle = color + '50';
//   ctx.lineWidth = 0.5 / scale;
//   ctx.beginPath(); (ctx as any).roundRect(pos.x - pw / 2, ly, pw, ph, 3 / scale); ctx.fill(); ctx.stroke();
//   ctx.fillStyle = color;
//   ctx.textAlign = 'center';
//   ctx.textBaseline = 'middle';
//   ctx.fillText(coord, pos.x, ly + ph / 2);
//   ctx.textBaseline = 'alphabetic';
// }

// // ═══════════════════════════════════════════════════════════════════════════════
// //  PROPS
// // ═══════════════════════════════════════════════════════════════════════════════
// interface ExhibitionMapViewerProps {
//   pose: { x: number; y: number; yaw: number } | null;
//   isMoving: boolean; // true khi robotState === 'EXECUTING'
// }

// // ═══════════════════════════════════════════════════════════════════════════════
// //  COMPONENT — Read-only, không có route queue hay nút điều khiển
// // ═══════════════════════════════════════════════════════════════════════════════
// export function ExhibitionMapViewer({ pose, isMoving }: ExhibitionMapViewerProps) {
//   const [scale, setScale]           = useState(0.38);
//   const [offset, setOffset]         = useState({ x: 0, y: 0 });
//   const [isDragging, setIsDragging] = useState(false);
//   const clickOrigin                 = useRef({ x: 0, y: 0 });
//   const dragStart                   = useRef({ x: 0, y: 0 });
//   const mapContainerRef             = useRef<HTMLDivElement>(null);
//   const canvasRef                   = useRef<HTMLCanvasElement>(null);
//   const animRef                     = useRef<number>(0);
//   const pulseRef                    = useRef(0);

//   const [robotPos, setRobotPos] = useState(rosToDisplay(ROBOT_START_ROS.x, ROBOT_START_ROS.y));
//   const [robotRos, setRobotRos] = useState(ROBOT_START_ROS);

//   // Sync stateRef để tránh stale closure trong render loop
//   const stateRef = useRef({ robotPos, robotRos, isMoving, scale, offset });
//   useEffect(() => {
//     stateRef.current = { robotPos, robotRos, isMoving, scale, offset };
//   }, [robotPos, robotRos, isMoving, scale, offset]);

//   // Update robot position từ pose MQTT
//   useEffect(() => {
//     if (!pose) return;
//     setRobotPos(rosToDisplay(pose.x, pose.y));
//     setRobotRos({ x: pose.x, y: pose.y });
//   }, [pose]);

//   // Canvas render loop
//   useEffect(() => {
//     function loop() {
//       pulseRef.current = (pulseRef.current + 0.016) % 1;

//       const canvas = canvasRef.current;
//       const container = mapContainerRef.current;
//       if (!canvas || !container) { animRef.current = requestAnimationFrame(loop); return; }

//       const W = container.clientWidth, H = container.clientHeight;
//       if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

//       const ctx = canvas.getContext('2d');
//       if (!ctx) { animRef.current = requestAnimationFrame(loop); return; }

//       const { robotPos, robotRos, isMoving, scale, offset } = stateRef.current;

//       ctx.clearRect(0, 0, W, H);
//       ctx.save();
//       ctx.translate(offset.x, offset.y);
//       ctx.scale(scale, scale);

//       drawCorridor(ctx, scale);
//       drawBooths(ctx, scale);
//       drawRobot(ctx, scale, robotPos, robotRos, pulseRef.current, isMoving);

//       ctx.restore();
//       animRef.current = requestAnimationFrame(loop);
//     }

//     animRef.current = requestAnimationFrame(loop);
//     return () => cancelAnimationFrame(animRef.current);
//   }, []);

//   // Pan handlers
//   const handleDown = (e: React.MouseEvent | React.TouchEvent) => {
//     const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
//     const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
//     setIsDragging(false);
//     clickOrigin.current = { x: cx, y: cy };
//     dragStart.current = { x: cx - offset.x, y: cy - offset.y };
//   };
//   const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
//     if ('buttons' in e && e.buttons !== 1) return;
//     const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
//     const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
//     if (Math.hypot(cx - clickOrigin.current.x, cy - clickOrigin.current.y) > 5) {
//       setIsDragging(true);
//       setOffset({ x: cx - dragStart.current.x, y: cy - dragStart.current.y });
//     }
//   };
//   const handleUp = () => { setTimeout(() => setIsDragging(false), 80); };

//   const focusRobot = () => {
//     const container = mapContainerRef.current;
//     if (!container) return;
//     const rect = container.getBoundingClientRect();
//     setOffset({ x: rect.width / 2 - robotPos.x * scale, y: rect.height / 2 - robotPos.y * scale });
//   };
//   const adjustZoom = (d: number) => setScale(s => Math.min(Math.max(0.15, s + d), 2));
//   const resetMap   = () => { setScale(0.38); setOffset({ x: 0, y: 0 }); };

//   return (
//     <div className="relative w-full h-full bg-[#070c18] rounded-2xl overflow-hidden border border-sky-500/20 shadow-2xl flex flex-col">

//       {/* HEADER */}
//       <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
//         <div className="p-3 bg-gradient-to-b from-[#070c18]/97 via-[#070c18]/80 to-transparent">
//           <div className="flex items-center justify-between pointer-events-auto">
//             <div className="flex items-center gap-2">
//               <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 text-sm font-bold">◈</div>
//               <div>
//                 <h2 className="text-sm font-bold text-white tracking-tight">Bản Đồ Triển Lãm</h2>
//                 <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
//                   <span className={`w-1.5 h-1.5 rounded-full ${isMoving ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
//                   {isMoving ? 'Robot đang di chuyển' : 'Robot đang chờ'}
//                   {pose && (
//                     <span className="ml-1 font-mono text-sky-500">
//                       ({pose.x.toFixed(2)}, {pose.y.toFixed(2)})
//                     </span>
//                   )}
//                 </div>
//               </div>
//             </div>

//             {/* Zoom controls */}
//             <div className="flex gap-1 bg-white/[0.03] p-1 rounded-lg border border-white/[0.07]">
//               <button className="p-1.5 text-slate-500 hover:text-white hover:bg-white/[0.07] rounded transition-colors" onClick={() => adjustZoom(0.1)}><ZoomIn className="w-3.5 h-3.5" /></button>
//               <button className="p-1.5 text-slate-500 hover:text-white hover:bg-white/[0.07] rounded transition-colors" onClick={focusRobot}><Locate className="w-3.5 h-3.5" /></button>
//               <button className="p-1.5 text-slate-500 hover:text-white hover:bg-white/[0.07] rounded transition-colors" onClick={() => adjustZoom(-0.1)}><ZoomOut className="w-3.5 h-3.5" /></button>
//               <div className="w-px bg-white/[0.07] mx-0.5" />
//               <button className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 rounded transition-colors" onClick={resetMap}><Maximize className="w-3.5 h-3.5" /></button>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* CANVAS */}
//       <div ref={mapContainerRef}
//         className="flex-1 w-full h-full overflow-hidden relative select-none"
//         style={{
//           background: '#070c18',
//           backgroundImage: 'linear-gradient(rgba(56,189,248,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,0.035) 1px,transparent 1px)',
//           backgroundSize: '32px 32px',
//         }}
//         onMouseDown={handleDown} onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp}
//         onTouchStart={handleDown} onTouchMove={handleMove} onTouchEnd={handleUp}>
//         <canvas
//           ref={canvasRef}
//           className="absolute inset-0 w-full h-full"
//           style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
//         />
//       </div>

//       {/* LEGEND */}
//       <div className="absolute bottom-3 left-3 z-30 pointer-events-none">
//         <div className="flex items-center gap-3 px-3 py-2 bg-[#0a0f1e]/90 rounded-xl border border-sky-500/15 backdrop-blur-md">
//           <div className="flex items-center gap-1.5">
//             <span className="text-sm">🤖</span>
//             <span className="text-[10px] text-slate-400">Robot</span>
//           </div>
//           <div className="w-px h-3 bg-white/10" />
//           <div className="flex items-center gap-1.5">
//             <span className="text-sm">🏪</span>
//             <span className="text-[10px] text-slate-400">Gian hàng</span>
//           </div>
//           <div className="w-px h-3 bg-white/10" />
//           <div className="flex items-center gap-1.5">
//             <span className="text-[10px] text-slate-500">Kéo để di chuyển · Cuộn để zoom</span>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
