'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, MicOff, X, Volume2, StopCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { streamChat, getFallbackResponse, type ChatMessage } from '../../lib/chatService';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = [
  { label: '🚻 Nhà vệ sinh ở đâu?', text: 'Nhà vệ sinh ở đâu?' },
  { label: '📅 Lịch trình hôm nay', text: 'Lịch trình sự kiện hôm nay là gì?' },
  { label: '🤖 Sản phẩm robot', text: 'Robot đang có những sản phẩm gì?' },
  { label: '🗺️ Sơ đồ gian hàng', text: 'Cho tôi xem sơ đồ các gian hàng?' },
];

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>🤖</div>
      <div className="px-3 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-1"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}`}</style>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   VOICE OVERLAY – Uses Capacitor native plugin on Android,
   falls back to Web Speech API on desktop browsers.
   ════════════════════════════════════════════════════════════════════════ */

// Detect if we're inside a Capacitor native shell
function isCapacitorNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch { return false; }
}

// Safe check: is Web Speech API available? (only for browser fallback)
function hasWebSpeechAPI(): boolean {
  try {
    return !!(typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  } catch { return false; }
}

function VoiceOverlay({ onClose, onResult }: { onClose: () => void; onResult: (text: string) => void }) {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'success' | 'error' | 'unsupported'>('idle');
  const [displayText, setDisplayText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [vol, setVol] = useState<number[]>(Array(20).fill(3));
  const [dots, setDots] = useState(0);
  const [pulseScale, setPulseScale] = useState(1);
  const [autoSendCountdown, setAutoSendCountdown] = useState<number | null>(null);

  const cleanupFnRef = useRef<(() => void) | null>(null);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const hasResultRef = useRef(false);
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const displayTextRef = useRef('');
  const stopAndSendRef = useRef<(text?: string) => void>(() => {});

  // ── Simulated waveform ──
  const startSimulatedWaveform = useCallback(() => {
    if (simIntervalRef.current) return;
    simIntervalRef.current = setInterval(() => {
      if (!mountedRef.current) { clearInterval(simIntervalRef.current!); return; }
      setVol(Array.from({ length: 20 }, () => Math.floor(Math.random() * 12) + 2));
      setPulseScale(1 + Math.random() * 0.2);
    }, 150);
  }, []);

  // ── Keep displayTextRef in sync ──
  useEffect(() => {
    displayTextRef.current = displayText;
  }, [displayText]);

  // ── Stop and send result ──
  const stopAndSend = useCallback((text?: string) => {
    try { cleanupFnRef.current?.(); } catch {}
    cleanupFnRef.current = null;

    if (text?.trim()) {
      setDisplayText(text.trim());
      setStatus('processing');
      setTimeout(() => {
        if (!mountedRef.current) return;
        setStatus('success');
        setTimeout(() => {
          if (mountedRef.current) {
            onResult(text.trim());
            onClose();
          }
        }, 500);
      }, 400);
    } else {
      setStatus('error');
      setErrorMsg('Không nhận được giọng nói. Hãy thử lại!');
      setTimeout(() => { if (mountedRef.current) onClose(); }, 2500);
    }
  }, [onClose, onResult]);

  // Keep ref up to date to avoid temporal dead zone in hooks defined below
  useEffect(() => {
    stopAndSendRef.current = stopAndSend;
  }, [stopAndSend]);

  // ── Auto-send countdown logic ──
  const startAutoSendCountdown = useCallback(() => {
    if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setAutoSendCountdown(3);

    let remaining = 3;
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setAutoSendCountdown(null);
      } else {
        setAutoSendCountdown(remaining);
      }
    }, 1000);

    autoSendTimerRef.current = setTimeout(() => {
      if (mountedRef.current && hasResultRef.current) {
        const textToSend = displayTextRef.current;
        if (textToSend?.trim()) {
          stopAndSendRef.current(textToSend.trim());
        }
      }
    }, 3000);
  }, []);

  const cancelAutoSendCountdown = useCallback(() => {
    if (autoSendTimerRef.current) { clearTimeout(autoSendTimerRef.current); autoSendTimerRef.current = null; }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    setAutoSendCountdown(null);
  }, []);

  // ── Cleanup ──
  const cleanup = useCallback(() => {
    try { cleanupFnRef.current?.(); } catch {}
    cleanupFnRef.current = null;
    try {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    } catch {}
    cancelAutoSendCountdown();
  }, [cancelAutoSendCountdown]);

  // ════════════════════════════════════════════════
  //  CAPACITOR NATIVE – uses @capacitor-community/speech-recognition
  // ════════════════════════════════════════════════
  const startCapacitorRecognition = useCallback(async () => {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');

      // Check availability
      const { available } = await SpeechRecognition.available();
      if (!available) {
        setStatus('unsupported');
        setErrorMsg('Thiết bị chưa hỗ trợ nhận dạng giọng nói.');
        return;
      }

      // Request permissions
      const permResult = await SpeechRecognition.requestPermissions();
      if (permResult.speechRecognition === 'denied') {
        setStatus('error');
        setErrorMsg('Vui lòng cấp quyền microphone trong Cài đặt ứng dụng.');
        setTimeout(() => { if (mountedRef.current) onClose(); }, 3000);
        return;
      }

      setStatus('listening');
      startSimulatedWaveform();

      // Listen for partial results
      let latestText = '';
      const partialListener = await SpeechRecognition.addListener('partialResults', (data: any) => {
        if (!mountedRef.current) return;
        const matches = data.matches || [];
        if (matches.length > 0) {
          latestText = matches[0];
          hasResultRef.current = true;
          setDisplayText(latestText);
        }
      });

      // Start listening
      await SpeechRecognition.start({
        language: 'vi-VN',
        maxResults: 3,
        partialResults: true,
        popup: false,
      });

      // Save cleanup function
      cleanupFnRef.current = () => {
        try { SpeechRecognition.stop(); } catch {}
        try { partialListener.remove(); } catch {}
        try { SpeechRecognition.removeAllListeners(); } catch {}
      };

      // Auto-stop after 10 seconds if still listening
      setTimeout(() => {
        if (mountedRef.current && status === 'listening') {
          const textToSend = latestText;
          try { cleanupFnRef.current?.(); } catch {}
          cleanupFnRef.current = null;
          
          if (textToSend?.trim()) {
            stopAndSend(textToSend);
          }
        }
      }, 10000);

    } catch (err: any) {
      console.error('Capacitor SpeechRecognition error:', err);
      if (mountedRef.current) {
        setStatus('error');
        setErrorMsg('Lỗi nhận dạng giọng nói. Thử lại nhé!');
        setTimeout(() => { if (mountedRef.current) onClose(); }, 2500);
      }
    }
  }, [onClose, startSimulatedWaveform, stopAndSend, status]);

  // ════════════════════════════════════════════════
  //  WEB BROWSER FALLBACK – uses Web Speech API
  // ════════════════════════════════════════════════
  const startWebRecognition = useCallback(() => {
    if (!hasWebSpeechAPI()) {
      setStatus('unsupported');
      setErrorMsg('Trình duyệt không hỗ trợ nhận dạng giọng nói.\nVui lòng sử dụng bàn phím để nhập câu hỏi.');
      startSimulatedWaveform();
      return;
    }

    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = 'vi-VN';
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;

      let finalText = '';
      let silenceTimer: ReturnType<typeof setTimeout> | null = null;

      rec.onstart = () => {
        if (mountedRef.current) setStatus('listening');
      };

      rec.onresult = (e: any) => {
        if (!mountedRef.current) return;
        try {
          let interim = '';
          let final = '';
          for (let i = 0; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) final += t;
            else interim += t;
          }
          if (final) { finalText += (finalText ? ' ' : '') + final; hasResultRef.current = true; }
          const currentText = finalText + (interim ? ' ' + interim : '');
          setDisplayText(currentText);

          if (silenceTimer) clearTimeout(silenceTimer);
          // Cancel running auto-send if user is still speaking
          cancelAutoSendCountdown();
          silenceTimer = setTimeout(() => {
            if (hasResultRef.current && mountedRef.current) {
              // Start 3-second auto-send countdown instead of immediate send
              startAutoSendCountdown();
            }
          }, 1500);
        } catch {}
      };

      rec.onerror = (e: any) => {
        if (!mountedRef.current) return;
        const code = e?.error || 'unknown';
        if (code === 'no-speech') {
          setStatus('error'); setErrorMsg('Không nhận được giọng nói.');
        } else if (code === 'not-allowed') {
          setStatus('error'); setErrorMsg('Vui lòng cấp quyền microphone.');
        } else if (code !== 'aborted') {
          setStatus('error'); setErrorMsg('Có lỗi xảy ra. Thử lại nhé!');
        }
        setTimeout(() => { if (mountedRef.current) onClose(); }, 2500);
      };

      rec.onend = () => {
        if (mountedRef.current) {
          if (!hasResultRef.current) {
            setStatus('error');
            setErrorMsg('Không nhận được giọng nói.');
            setTimeout(() => { if (mountedRef.current) onClose(); }, 2500);
          } else {
            // On mobile, continuous=false causes auto-stop when user finishes speaking.
            // We can send immediately instead of waiting for the silence timer.
            const textToSend = displayTextRef.current;
            if (textToSend?.trim()) {
              stopAndSendRef.current(textToSend.trim());
            }
          }
        }
      };

      rec.start();
      startSimulatedWaveform();

      cleanupFnRef.current = () => {
        try { rec.abort(); } catch {}
        if (silenceTimer) clearTimeout(silenceTimer);
      };
    } catch {
      setStatus('unsupported');
      setErrorMsg('Không thể khởi tạo nhận dạng giọng nói.');
      startSimulatedWaveform();
    }
  }, [onClose, startSimulatedWaveform, stopAndSend, startAutoSendCountdown, cancelAutoSendCountdown]);

  // ── Handle manual stop button ──
  const handleStopButton = useCallback(() => {
    if (status === 'listening' && hasResultRef.current) {
      setDisplayText(current => {
        stopAndSend(current);
        return current;
      });
    }
  }, [status, stopAndSend]);

  // ── Init ──
  useEffect(() => {
    mountedRef.current = true;

    const dotTimer = setInterval(() => {
      if (mountedRef.current) setDots(d => (d + 1) % 4);
    }, 500);

    // Choose recognition engine
    if (isCapacitorNative()) {
      startCapacitorRecognition();
    } else {
      startWebRecognition();
    }

    return () => {
      mountedRef.current = false;
      clearInterval(dotTimer);
      cleanup();
    };
  }, []);

  const handleManualClose = () => {
    cleanup();
    onClose();
  };

  // Status config
  const statusConfig = {
    idle: {
      label: 'Đang khởi tạo...',
      sub: 'Chuẩn bị microphone',
      gradient: 'linear-gradient(135deg, #7c3aed, #2563eb)',
      glow: '0 0 40px rgba(124,58,237,0.4)',
      ringColor: '#7c3aed',
      barGradient: 'linear-gradient(to top, #2563eb, #7c3aed)',
    },
    listening: {
      label: `Đang nghe${'.'.repeat(dots)}`,
      sub: displayText || 'Nói câu hỏi của bạn bằng tiếng Việt',
      gradient: 'linear-gradient(135deg, #7c3aed, #2563eb)',
      glow: '0 0 40px rgba(124,58,237,0.5)',
      ringColor: '#7c3aed',
      barGradient: 'linear-gradient(to top, #2563eb, #7c3aed)',
    },
    processing: {
      label: 'Đang xử lý...',
      sub: displayText || 'Đang nhận dạng giọng nói...',
      gradient: 'linear-gradient(135deg, #f59e0b, #f97316)',
      glow: '0 0 40px rgba(245,158,11,0.5)',
      ringColor: '#f59e0b',
      barGradient: 'linear-gradient(to top, #f97316, #f59e0b)',
    },
    success: {
      label: 'Đã nhận!',
      sub: displayText,
      gradient: 'linear-gradient(135deg, #059669, #10b981)',
      glow: '0 0 40px rgba(16,185,129,0.5)',
      ringColor: '#10b981',
      barGradient: 'linear-gradient(to top, #059669, #10b981)',
    },
    error: {
      label: 'Thử lại',
      sub: errorMsg,
      gradient: 'linear-gradient(135deg, #dc2626, #ef4444)',
      glow: '0 0 40px rgba(239,68,68,0.4)',
      ringColor: '#ef4444',
      barGradient: 'linear-gradient(to top, #dc2626, #ef4444)',
    },
    unsupported: {
      label: 'Không hỗ trợ',
      sub: errorMsg || 'Thiết bị chưa hỗ trợ nhận dạng giọng nói',
      gradient: 'linear-gradient(135deg, #475569, #64748b)',
      glow: '0 0 40px rgba(71,85,105,0.4)',
      ringColor: '#64748b',
      barGradient: 'linear-gradient(to top, #475569, #64748b)',
    },
  };

  const cfg = statusConfig[status];
  const isActive = status === 'listening';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}
      onClick={handleManualClose}>

      <div className="relative w-full max-w-md mx-4 mb-6 rounded-3xl p-8 flex flex-col items-center gap-6"
        style={{
          background: 'linear-gradient(160deg, rgba(15,23,42,0.97), rgba(30,41,59,0.97))',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}>

        {/* Close button */}
        <button onClick={handleManualClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ background: 'rgba(255,255,255,0.06)' }}>
          <X className="w-4 h-4 text-slate-400" />
        </button>

        {/* Main mic button with pulse + ring */}
        <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
          {/* Animated outer rings */}
          {isActive && (
            <>
              <div className="absolute inset-0 rounded-full"
                style={{
                  background: cfg.gradient,
                  opacity: 0.08,
                  transform: `scale(${pulseScale * 1.3})`,
                  transition: 'transform 0.15s ease-out',
                }} />
              <div className="absolute inset-0 rounded-full animate-ping"
                style={{
                  background: cfg.gradient,
                  opacity: 0.06,
                  animationDuration: '2s',
                }} />
            </>
          )}

          {/* SVG ring */}
          <svg className="absolute" width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="62" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
            {isActive && (
              <circle cx="70" cy="70" r="62" fill="none"
                stroke={cfg.ringColor}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 62}`}
                strokeDashoffset="0"
                transform="rotate(-90 70 70)"
                style={{ animation: 'voiceRingSpin 3s linear infinite' }}
              />
            )}
          </svg>

          {/* Center mic button */}
          <button
            onClick={handleStopButton}
            className="w-20 h-20 rounded-full flex items-center justify-center relative z-10 transition-all duration-300"
            style={{
              background: cfg.gradient,
              boxShadow: cfg.glow,
              transform: isActive ? `scale(${0.95 + (pulseScale - 1) * 0.3})` : 'scale(1)',
              transition: 'transform 0.15s ease-out, background 0.3s, box-shadow 0.3s',
            }}>
            {status === 'success' ? (
              <Volume2 className="w-8 h-8 text-white" />
            ) : status === 'processing' ? (
              <div className="w-8 h-8 rounded-full border-3 border-white/30 border-t-white animate-spin" />
            ) : status === 'error' || status === 'unsupported' ? (
              <MicOff className="w-8 h-8 text-white" />
            ) : (
              <Mic className="w-8 h-8 text-white" />
            )}
          </button>

          {/* Tap to stop hint */}
          {isActive && hasResultRef.current && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="text-[10px] text-slate-500 bg-slate-900/80 px-2 py-0.5 rounded-full border border-white/5">
                Nhấn để gửi
              </span>
            </div>
          )}
        </div>

        {/* Real-time waveform visualization */}
        <div className="flex items-end justify-center gap-[3px] h-12 w-full max-w-[280px]">
          {vol.map((v, i) => (
            <div key={i} className="rounded-full transition-all"
              style={{
                width: '4px',
                height: isActive ? `${Math.max(4, v * 2.5)}px` : status === 'processing' ? '6px' : '4px',
                background: cfg.barGradient,
                opacity: isActive ? 0.5 + (v / 32) * 0.5 : 0.25,
                transition: 'height 0.1s ease-out, opacity 0.1s, background 0.3s',
              }} />
          ))}
        </div>

        {/* Status label */}
        <div className="text-center space-y-1.5 min-h-[52px]">
          <p className="text-white font-semibold text-base tracking-wide">{cfg.label}</p>
          <p className="text-sm text-slate-400 max-w-[280px] mx-auto leading-relaxed whitespace-pre-line">
            {cfg.sub}
          </p>
        </div>

        {/* Transcript display when we have recognized text */}
        {displayText && status === 'listening' && (
          <div className="w-full px-4 py-3 rounded-2xl text-sm text-white/90 leading-relaxed"
            style={{
              background: 'rgba(124,58,237,0.1)',
              border: '1px solid rgba(124,58,237,0.2)',
            }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-purple-400 text-xs font-medium">Đã nhận:</span>
              {autoSendCountdown !== null && (
                <span className="text-xs font-bold text-amber-400 animate-pulse">
                  Tự động gửi sau {autoSendCountdown}s
                </span>
              )}
            </div>
            {displayText}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 w-full">
          <button onClick={handleManualClose}
            className="flex-1 text-sm font-medium px-5 py-2.5 rounded-xl transition-all hover:bg-white/10"
            style={{
              background: status === 'unsupported' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'rgba(255,255,255,0.05)',
              color: status === 'unsupported' ? 'white' : '#94a3b8',
              border: status === 'unsupported' ? 'none' : '1px solid rgba(255,255,255,0.08)',
            }}>
            {status === 'unsupported' ? 'Đóng' : 'Huỷ'}
          </button>
          {isActive && (
            <button onClick={() => {
              cancelAutoSendCountdown();
              if (displayText?.trim()) {
                stopAndSend(displayText.trim());
              } else {
                stopAndSend();
              }
            }}
              className="flex-1 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
              style={{
                background: hasResultRef.current
                  ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                  : 'rgba(255,255,255,0.05)',
                color: hasResultRef.current ? 'white' : '#64748b',
                border: hasResultRef.current ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}>
              <Send className="w-4 h-4" />
              Gửi
            </button>
          )}
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes voiceRingSpin {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: ${2 * Math.PI * 62 * 2}; }
        }
      `}</style>
    </div>
  );
}

export function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', type: 'assistant', text: 'Xin chào! Tôi là trợ lý AI của Robot Tiếp Thị. Tôi có thể giúp bạn tìm đường, xem lịch trình, hoặc giới thiệu sản phẩm. Bạn cần gì không?' },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [showVoice, setShowVoice] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, isTyping, isExpanded]);

  const isBusy = isTyping || streamingMsgId !== null;

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isBusy) return;
    const trimmed = text.trim();
    const userMsg: Message = { id: Date.now().toString(), type: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const assistantMsgId = (Date.now() + 1).toString();

    try {
      // Chuẩn bị history (không bao gồm userMsg vừa thêm)
      const history: ChatMessage[] = messages.map(m => ({ type: m.type, text: m.text }));

      // Gọi Gemini streaming
      const stream = streamChat(history, trimmed);
      let firstChunk = true;
      let accumulatedText = "";

      for await (const chunk of stream) {
        accumulatedText += chunk;
        if (firstChunk) {
          // Ẩn typing indicator, bắt đầu hiện message
          setIsTyping(false);
          setStreamingMsgId(assistantMsgId);
          setMessages(prev => [...prev, { id: assistantMsgId, type: 'assistant', text: accumulatedText }]);
          firstChunk = false;
        } else {
          // Cập nhật bằng chuỗi đã cộng dồn để chống lỗi mất chunk do React batch rendering
          setMessages(prev =>
            prev.map(m => m.id === assistantMsgId ? { ...m, text: accumulatedText } : m)
          );
        }
      }

      // Nếu stream rỗng (không có chunk nào)
      if (firstChunk) {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: assistantMsgId, type: 'assistant',
          text: 'Xin lỗi, tôi không thể trả lời lúc này. Bạn thử hỏi lại nhé! 😊',
        }]);
      }

      setStreamingMsgId(null);
    } catch (err: any) {
      console.warn('Gemini API error, using fallback:', err?.message || err);
      setIsTyping(false);
      setStreamingMsgId(null);
      // Fallback: dùng câu trả lời offline
      let fallback = getFallbackResponse(trimmed);

      setMessages(prev => {
        // Nếu đã thêm assistant msg (streaming bị lỗi giữa chừng), thay thế nó
        const existing = prev.find(m => m.id === assistantMsgId);
        if (existing) {
          return prev.map(m => m.id === assistantMsgId ? { ...m, text: fallback } : m);
        }
        return [...prev, { id: assistantMsgId, type: 'assistant', text: fallback }];
      });
    }
  }, [isBusy, messages]);

  // Voice result: auto-expand chat and auto-send
  const handleVoiceResult = useCallback((text: string) => {
    if (!isExpanded) setIsExpanded(true);
    // Small delay to allow expansion animation
    setTimeout(() => {
      sendMessage(text);
    }, 300);
  }, [isExpanded, sendMessage]);

  return (
    <>
      {/* ── COMPACT INLINE VIEW ── */}
      <div 
        onClick={() => setIsExpanded(true)}
        className="rounded-2xl overflow-hidden shadow-sm cursor-pointer transition-all hover:bg-slate-800/80"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        
        <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>🤖</div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Trợ lý AI</p>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-xs text-slate-500">Đang hoạt động · Nhấn để trò chuyện</span>
              </div>
            </div>
          </div>
        </div>

        {/* Suggestions only */}
        <div className="px-4 py-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {SUGGESTIONS.map(s => (
            <div key={s.text}
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
                setTimeout(() => sendMessage(s.text), 300);
              }}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              {s.label}
            </div>
          ))}
        </div>
        
        <div className="px-4 pb-3 flex gap-2">
          <div className="flex-1 text-sm px-3 py-2 rounded-xl text-slate-500 flex items-center gap-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span>Nhập câu hỏi...</span>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowVoice(true);
            }}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:bg-white/10 shadow-sm group"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Mic className="w-4 h-4 text-slate-400 group-hover:text-purple-400 transition-colors" />
          </button>
        </div>
      </div>

      {/* ── EXPANDED MODAL VIEW ── */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)' }}
          onClick={() => setIsExpanded(false)}>
          
          <div className="w-full h-full sm:h-auto sm:max-h-[85vh] sm:w-[80vw] sm:max-w-5xl sm:rounded-2xl flex flex-col shadow-2xl relative"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
            onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-2xl"
                style={{ background: 'radial-gradient(circle, #6366f1, #2563eb)' }} />
              
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>🤖</div>
                <div>
                  <p className="text-base font-bold text-white leading-none">Trợ lý AI</p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-xs text-slate-400">Luôn sẵn sàng hỗ trợ</span>
                  </div>
                </div>
              </div>
              
              <button onClick={() => setIsExpanded(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center relative z-10 transition-colors hover:bg-white/10"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'none' }}>
              {messages.map(msg => (
                <div key={msg.id} className={`flex items-end gap-2 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.type === 'assistant' && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm mb-0.5"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>🤖</div>
                  )}
                  <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm overflow-hidden"
                    style={msg.type === 'user' ? {
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: 'white', borderBottomRightRadius: '4px',
                    } : {
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#e2e8f0', borderBottomLeftRadius: '4px',
                    }}>
                    {msg.type === 'user' ? (
                      <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                    ) : (
                      <div className="markdown-body break-words">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="pl-1 marker:text-slate-400" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
                            a: ({node, ...props}) => <a className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors" {...props} />,
                            h1: ({node, ...props}) => <h1 className="text-lg font-bold text-white mb-2 mt-3 first:mt-0" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-base font-bold text-white mb-2 mt-3 first:mt-0" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-[15px] font-bold text-white mb-1 mt-2 first:mt-0" {...props} />,
                            em: ({node, ...props}) => <em className="italic text-slate-300" {...props} />,
                            code: ({node, ...props}) => <code className="bg-slate-800/80 text-purple-300 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* Suggestions inside Modal */}
            <div className="px-4 pb-3 flex gap-2 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
              {SUGGESTIONS.map(s => (
                <button key={s.text} onClick={() => sendMessage(s.text)}
                  className="flex-shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap shadow-sm"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Input area */}
            <div className="px-4 pb-4 pt-2 flex gap-2 border-t border-white/10 flex-shrink-0 bg-slate-900/50">
              <input
                type="text"
                placeholder="Nhập câu hỏi..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    // Cần thiết nếu input đang được focus trên mobile
                    (e.target as HTMLInputElement).blur();
                    sendMessage(input);
                  }
                }}
                className="flex-1 text-[15px] px-4 py-3 rounded-xl outline-none text-white placeholder-slate-500 shadow-inner"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
              <button onClick={() => setShowVoice(true)}
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:bg-purple-500/20 group"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Mic className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors" />
              </button>
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || isBusy}
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: input.trim() && !isBusy ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                <Send className="w-5 h-5" style={{ color: input.trim() && !isBusy ? 'white' : '#475569', marginLeft: input.trim() && !isBusy ? '2px' : '0' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showVoice && (
        <VoiceOverlay
          onClose={() => setShowVoice(false)}
          onResult={handleVoiceResult}
        />
      )}
    </>
  );
}