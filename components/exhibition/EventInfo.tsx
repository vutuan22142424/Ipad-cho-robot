'use client';

import { useRef, useState, useEffect } from 'react';
import { Clock, ChevronLeft, CalendarDays, Mic, Utensils, Trophy, Users, MapPin, ChevronRight, X } from 'lucide-react';
import { loadSchedule, fetchScheduleApi, ScheduleItem } from '../../lib/scheduleStore';
import { AdminScheduleModal } from './AdminScheduleModal';

const ICON_MAP: Record<string, any> = {
  Users, Mic, CalendarDays, Utensils, MapPin, Trophy
};

const banners = [
  { id: 1, gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #0ea5e9 100%)', tag: 'KHAI MẠC', title: 'Robot Tiếp Thị\nThế Hệ Mới', sub: 'Trải nghiệm AI tương tác trực tiếp', emoji: '🤖' },
  { id: 2, gradient: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #a78bfa 100%)', tag: 'KEYNOTE', title: 'Tech Summit\n2026', sub: 'Diễn giả hàng đầu châu Á', emoji: '🎤' },
  { id: 3, gradient: 'linear-gradient(135deg, #064e3b 0%, #059669 50%, #34d399 100%)', tag: 'TRIỂN LÃM', title: 'Gian Hàng\nCông Nghệ', sub: '50+ đối tác & nhà triển lãm', emoji: '🏛️' },
  { id: 4, gradient: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 50%, #f87171 100%)', tag: 'NETWORKING', title: 'Kết Nối\nDoanh Nghiệp', sub: 'Gặp gỡ 500+ chuyên gia công nghệ', emoji: '🤝' },
];

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getStatus(time: string, end: string, nowMinutes: number) {
  const start = timeToMinutes(time);
  const finish = timeToMinutes(end);
  if (nowMinutes >= start && nowMinutes < finish) return 'active';
  if (nowMinutes >= finish) return 'done';
  return 'upcoming';
}

function BannerSlider() {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setCurrent(p => (p + 1) % banners.length), 3000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ height: '160px' }}>
      {banners.map((b, i) => (
        <div
          key={b.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ background: b.gradient, opacity: i === current ? 1 : 0, pointerEvents: i === current ? 'auto' : 'none' }}
        >
          <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-white opacity-5" />
          <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full bg-white opacity-5" />
          <div className="relative h-full flex items-center px-5 gap-4">
            <div className="flex-1">
              <span className="inline-block text-xs font-bold tracking-widest uppercase bg-white/20 text-white rounded-full px-2.5 py-0.5 mb-2">
                {b.tag}
              </span>
              <h3 className="text-xl font-extrabold text-white leading-tight whitespace-pre-line">{b.title}</h3>
              <p className="text-xs text-white/70 mt-1">{b.sub}</p>
            </div>
            <div className="text-5xl select-none">{b.emoji}</div>
          </div>
        </div>
      ))}
      <button
        onClick={() => setCurrent(c => (c - 1 + banners.length) % banners.length)}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/25 flex items-center justify-center text-white z-10"
        aria-label="Banner trước"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => setCurrent(c => (c + 1) % banners.length)}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/25 flex items-center justify-center text-white z-10"
        aria-label="Banner tiếp theo"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {banners.map((b, i) => (
          <button
            key={b.id}
            onClick={() => setCurrent(i)}
            className="rounded-full transition-all duration-300"
            style={{ width: i === current ? '20px' : '6px', height: '6px', background: i === current ? 'white' : 'rgba(255,255,255,0.4)' }}
            aria-label={`Banner ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function FullScheduleModal({ onClose, nowMinutes, schedule }: { onClose: () => void; nowMinutes: number; schedule: ScheduleItem[] }) {
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTimeout(() => activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl overflow-hidden flex flex-col"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-bold text-white">Toàn bộ lịch trình</span>
            <span className="text-xs text-slate-500">15/03/2026 · 08:00–20:00</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.08)' }}
            aria-label="Đóng"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-0" style={{ scrollbarWidth: 'none' }}>
          {schedule.map((item, idx) => {
            const status = getStatus(item.time, item.end, nowMinutes);
            const Icon = ICON_MAP[item.icon as string] || CalendarDays;
            const isLast = idx === schedule.length - 1;
            return (
              <div key={item.id} ref={status === 'active' ? activeRef : undefined} className="flex gap-3 relative">
                {!isLast && (
                  <div
                    className="absolute left-[29px] top-10 bottom-0 w-0.5 rounded-full"
                    style={{ background: status === 'done' ? `${item.accent}30` : 'rgba(255,255,255,0.06)' }}
                  />
                )}
                {/* Time */}
                <div className="flex-shrink-0 w-11 pt-2.5 text-right">
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: status === 'active' ? item.accent : status === 'done' ? '#374151' : '#64748b' }}
                  >
                    {item.time}
                  </span>
                </div>
                {/* Icon dot */}
                <div className="flex-shrink-0 pt-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: status === 'active' ? item.accent : status === 'done' ? `${item.accent}20` : 'rgba(255,255,255,0.06)',
                      boxShadow: status === 'active' ? `0 0 14px ${item.accent}70` : 'none',
                      border: status === 'active' ? `2px solid ${item.accent}` : '2px solid transparent',
                    }}
                  >
                    <Icon className="w-4 h-4" style={{ color: status === 'done' ? '#374151' : status === 'active' ? 'white' : item.accent }} />
                  </div>
                </div>
                {/* Content */}
                <div className="flex-1 pb-5 pt-2 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span
                      className="text-sm font-bold leading-tight"
                      style={{ color: status === 'done' ? '#374151' : status === 'active' ? 'white' : '#e2e8f0' }}
                    >
                      {item.label}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                      {status === 'active' && (
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse"
                          style={{ background: `${item.accent}25`, color: item.accent }}
                        >
                          ● Live
                        </span>
                      )}
                      {status === 'done' && (
                        <span className="text-xs px-2 py-0.5 rounded-full text-slate-600" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          Xong
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-xs" style={{ color: status === 'done' ? '#374151' : '#64748b' }}>
                      <MapPin className="w-3 h-3" />{item.detail}
                    </span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: status === 'done' ? '#374151' : '#64748b' }}>
                      <Clock className="w-3 h-3" />{item.duration}
                    </span>
                    {item.speaker && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: status === 'done' ? '#374151' : '#64748b' }}>
                        🎙 {item.speaker}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function EventInfo() {
  const [now, setNow] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [clicks, setClicks] = useState(0);

  useEffect(() => {
    // 1. Tải từ local storage (hoặc default) để hiển thị ngay lập tức
    setSchedule(loadSchedule());
    
    // 2. Fetch dữ liệu mới nhất từ mockAPI (khi app khởi động hoặc người dùng vuốt xuống reload app)
    fetchScheduleApi().then(data => {
      if (data && data.length > 0) {
        setSchedule(data);
      }
    });

    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const handleHeaderClick = () => {
    setClicks(c => c + 1);
    if (clicks + 1 >= 5) {
      setShowAdmin(true);
      setClicks(0);
    }
  };

  useEffect(() => {
    if (clicks > 0) {
      const timer = setTimeout(() => setClicks(0), 1000); // 1 giây để bấm liên tục 5 lần
      return () => clearTimeout(timer);
    }
  }, [clicks]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const enriched = schedule.map(item => ({
    ...item,
    status: getStatus(item.time, item.end, nowMinutes),
  }));

  const activeIdx = enriched.findIndex(e => e.status === 'active');
  const firstUpcomingIdx = enriched.findIndex(e => e.status === 'upcoming');
  const anchorIdx = activeIdx !== -1 ? activeIdx : (firstUpcomingIdx !== -1 ? firstUpcomingIdx : Math.max(0, enriched.length - 1));
  const displayed = enriched.slice(anchorIdx, anchorIdx + 3);

  return (
    <div className="font-sans space-y-3 w-full h-full flex flex-col">
      <BannerSlider />

      {/* Schedule compact */}
      <div className="rounded-2xl overflow-hidden shadow-sm pt-0" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>

        {/* Header với nút Xem tất cả và Admin ẩn */}
        <div className="px-4 pt-4 pb-3 border-b border-white/10 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer select-none group" 
            onClick={handleHeaderClick}
            title="Lịch trình"
          >
            <CalendarDays className="w-4 h-4 text-blue-400 group-hover:text-blue-300 transition-colors" />
            <span className="text-sm font-bold text-white group-hover:text-blue-100 transition-colors">
               Lịch trình
            </span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 text-xs font-semibold transition-colors hover:text-slate-300"
            style={{ color: '#64748b' }}
          >
            Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Compact list */}
        <div className="px-4 py-3 space-y-0 min-h-[220px]">
          {displayed.length === 0 && (
             <div className="text-center text-slate-400 text-sm py-8">Chưa có lịch trình nào</div>
          )}
          {displayed.map((item, idx) => {
            const Icon = ICON_MAP[item.icon as string] || CalendarDays;
            const isLast = idx === displayed.length - 1;
            return (
              <div key={item.id} className="flex gap-3 relative">
                {!isLast && (
                  <div
                    className="absolute left-[29px] top-10 bottom-0 w-0.5"
                    style={{ background: item.status === 'done' ? `${item.accent}30` : 'rgba(255,255,255,0.06)' }}
                  />
                )}
                {/* Time */}
                <div className="flex-shrink-0 w-11 pt-2.5 text-right">
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: item.status === 'active' ? item.accent : '#64748b' }}
                  >
                    {item.time}
                  </span>
                </div>
                {/* Icon dot */}
                <div className="flex-shrink-0 pt-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: item.status === 'active' ? item.accent : 'rgba(255,255,255,0.06)',
                      boxShadow: item.status === 'active' ? `0 0 14px ${item.accent}70` : 'none',
                      border: item.status === 'active' ? `2px solid ${item.accent}` : '2px solid transparent',
                    }}
                  >
                    <Icon className="w-4 h-4" style={{ color: item.status === 'active' ? 'white' : item.accent }} />
                  </div>
                </div>
                {/* Chỉ tên + badge */}
                <div className="flex-1 pb-4 pt-2.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white leading-tight truncate">{item.label}</span>
                    {item.status === 'active' && (
                      <span
                        className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse"
                        style={{ background: `${item.accent}25`, color: item.accent }}
                      >
                        ● Live
                      </span>
                    )}
                    {item.status === 'upcoming' && (
                      <span
                        className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}
                      >
                        Tiếp theo
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showModal && <FullScheduleModal schedule={schedule} onClose={() => setShowModal(false)} nowMinutes={nowMinutes} />}
      {showAdmin && <AdminScheduleModal schedule={schedule} onClose={() => setShowAdmin(false)} onSave={setSchedule} />}
    </div>
  );
}