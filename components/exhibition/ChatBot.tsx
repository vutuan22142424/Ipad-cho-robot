'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, MicOff, X, Volume2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { streamChat, getFallbackResponse, type ChatMessage } from '@/lib/chatService';

/* ═══════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════ */

interface Message {
  id: string;
  type: 'user' | 'assistant';
  text: string;
}

/* ═══════════════════════════════════════════════════════
   GỢI Ý CÂU HỎI
   ═══════════════════════════════════════════════════════ */

const SUGGESTIONS = [
  { label: '🚻 Nhà vệ sinh ở đâu?',   text: 'Nhà vệ sinh ở đâu?' },
  { label: '📅 Lịch trình hôm nay',    text: 'Lịch trình hôm nay là gì?' },
  { label: '🗺️ Các gian hàng',         text: 'Có những gian hàng nào?' },
  { label: '📶 WiFi triển lãm',         text: 'Thông tin WiFi?' },
];

/* ═══════════════════════════════════════════════════════
   TYPING INDICATOR // tạo cảm giác AI đang xử lý
   ═══════════════════════════════════════════════════════ */

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
        style={{ background: 'linear-gradient(135deg, #f97316, #eab308)' }}>🤖</div>
      <div className="px-3 py-2 rounded-2xl rounded-bl-sm flex items-center gap-1"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-orange-400"
            style={{ animation: `chatBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes chatBounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   VOICE OVERLAY
   ═══════════════════════════════════════════════════════ */

function isCapacitorNative(): boolean {    // đang chạy trên app Android/iOS?
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

function hasWebSpeechAPI(): boolean { // browser có hỗ trợ nhận dạng giọng nói?
  try {
    return !!(typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  } catch { return false; }
}

function VoiceOverlay({ onClose, onResult }: { onClose: () => void; onResult: (text: string) => void }) {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'success' | 'error' | 'unsupported'>('idle');
  const [displayText, setDisplayText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [dots, setDots] = useState(0);

  const mountedRef = useRef(true);
  const cleanupRef = useRef<(() => void) | null>(null);
  const displayTextRef = useRef('');

  useEffect(() => { displayTextRef.current = displayText; }, [displayText]);

  const stopAndSend = useCallback((text?: string) => {
    try { cleanupRef.current?.(); } catch {}
    cleanupRef.current = null;
    if (text?.trim()) {
      setDisplayText(text.trim());
      setStatus('processing');
      setTimeout(() => {
        if (!mountedRef.current) return;
        setStatus('success');
        setTimeout(() => { if (mountedRef.current) { onResult(text.trim()); onClose(); } }, 400);
      }, 300);
    } else {
      setStatus('error');
      setErrorMsg('Không nhận được giọng nói. Hãy thử lại!');
      setTimeout(() => { if (mountedRef.current) onClose(); }, 2000);
    }
  }, [onClose, onResult]);

  const startWebRecognition = useCallback(() => {  // dùng API có sẵn của Chrome/Safari
    if (!hasWebSpeechAPI()) {
      setStatus('unsupported');
      setErrorMsg('Trình duyệt không hỗ trợ nhận dạng giọng nói.');
      return;
    }
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = 'vi-VN';
      rec.interimResults = true;
      rec.continuous = false;

      let finalText = '';
      rec.onstart = () => { if (mountedRef.current) setStatus('listening'); };
      rec.onresult = (e: any) => {
        if (!mountedRef.current) return;
        let interim = '', final = '';
        for (let i = 0; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += t; else interim += t;
        }
        if (final) finalText += (finalText ? ' ' : '') + final;
        setDisplayText(finalText + (interim ? ' ' + interim : ''));
      };
      rec.onerror = (e: any) => {
        if (!mountedRef.current) return;
        setStatus('error');
        setErrorMsg(e?.error === 'not-allowed' ? 'Vui lòng cấp quyền microphone.' : 'Có lỗi xảy ra. Thử lại nhé!');
        setTimeout(() => { if (mountedRef.current) onClose(); }, 2000);
      };
      rec.onend = () => {
        if (mountedRef.current) stopAndSend(displayTextRef.current || finalText);
      };
      rec.start();
      cleanupRef.current = () => { try { rec.abort(); } catch {} };
    } catch {
      setStatus('unsupported');
      setErrorMsg('Không thể khởi tạo nhận dạng giọng nói.');
    }
  }, [onClose, stopAndSend]);

        const startCapacitorRecognition = useCallback(async () => {
          try {
            const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
            const { available } = await SpeechRecognition.available();
            if (!available) { setStatus('unsupported'); setErrorMsg('Thiết bị chưa hỗ trợ nhận dạng giọng nói.'); return; }

            const perm = await SpeechRecognition.requestPermissions();
            if (perm.speechRecognition === 'denied') {
              setStatus('error'); setErrorMsg('Vui lòng cấp quyền microphone trong Cài đặt.');
              setTimeout(() => { if (mountedRef.current) onClose(); }, 2500); return;
            }

            setStatus('listening');
            let latestText = '';

            const partialListener = await SpeechRecognition.addListener('partialResults', (data: any) => {
              if (!mountedRef.current) return;
              const matches = data.matches || [];
              if (matches.length > 0) { latestText = matches[0]; setDisplayText(latestText); }
            });

            // ← THÊM: lắng nghe khi recognition tự dừng (nói xong → gửi luôn)
            const stateListener = await SpeechRecognition.addListener('listeningState', (data: any) => {
              if (!mountedRef.current) return;
              if (data.status === 'stopped') {
                try { partialListener.remove(); stateListener.remove(); } catch {}
                if (latestText.trim()) {
                  stopAndSend(latestText);
                } else {
                  setStatus('error');
                  setErrorMsg('Không nhận được giọng nói. Hãy thử lại!');
                  setTimeout(() => { if (mountedRef.current) onClose(); }, 2000);
                }
              }
            });

            await SpeechRecognition.start({
              language: 'vi-VN',
              maxResults: 3,
              partialResults: true,
              popup: false,
            });

            cleanupRef.current = () => {
              try { SpeechRecognition.stop(); } catch {}
              try { partialListener.remove(); } catch {}
              try { stateListener.remove(); } catch {}
              try { SpeechRecognition.removeAllListeners(); } catch {}
            };

            // Giữ timeout 15s làm safety net phòng listener không fire
            setTimeout(() => {
              if (mountedRef.current) {
                try { cleanupRef.current?.(); } catch {}
                if (latestText.trim()) stopAndSend(latestText);
              }
            }, 15000);

          } catch {
            setStatus('error'); setErrorMsg('Lỗi nhận dạng giọng nói. Thử lại nhé!');
            setTimeout(() => { if (mountedRef.current) onClose(); }, 2000);
          }
        }, [onClose, stopAndSend]);

  useEffect(() => {
    mountedRef.current = true;
    const dotTimer = setInterval(() => { if (mountedRef.current) setDots(d => (d + 1) % 4); }, 500);
    if (isCapacitorNative()) startCapacitorRecognition(); else startWebRecognition();
    return () => { mountedRef.current = false; clearInterval(dotTimer); try { cleanupRef.current?.(); } catch {} };
  }, []);

  const isListening = status === 'listening';

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}
      onClick={() => { try { cleanupRef.current?.(); } catch {} onClose(); }}>
      <div className="relative w-full max-w-sm mx-4 mb-8 rounded-3xl p-7 flex flex-col items-center gap-5"
        style={{
          background: 'linear-gradient(160deg, #0f172a, #1e293b)',
          border: '1px solid rgba(249,115,22,0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}>

        <button onClick={() => { try { cleanupRef.current?.(); } catch {} onClose(); }}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 text-slate-400" />
        </button>

        {/* Mic button */}
        <div className="relative flex items-center justify-center w-24 h-24">
          {isListening && (
            <div className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ background: 'linear-gradient(135deg, #f97316, #eab308)', animationDuration: '1.5s' }} />
          )}
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              background: status === 'success' ? 'linear-gradient(135deg, #059669, #10b981)'
                : status === 'error' || status === 'unsupported' ? 'linear-gradient(135deg, #dc2626, #ef4444)'
                : 'linear-gradient(135deg, #f97316, #eab308)',
              boxShadow: isListening ? '0 0 30px rgba(249,115,22,0.5)' : 'none',
            }}>
            {status === 'success' ? <Volume2 className="w-8 h-8 text-white" />
              : status === 'processing' ? <div className="w-7 h-7 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : status === 'error' || status === 'unsupported' ? <MicOff className="w-8 h-8 text-white" />
              : <Mic className="w-8 h-8 text-white" />}
          </div>
        </div>

        {/* Status text */}
        <div className="text-center space-y-1">
          <p className="text-white font-semibold text-sm">
            {status === 'idle' ? 'Đang khởi tạo...'
              : status === 'listening' ? `Đang nghe${'.'.repeat(dots)}`
              : status === 'processing' ? 'Đang xử lý...'
              : status === 'success' ? 'Đã nhận!'
              : status === 'error' ? 'Thử lại'
              : 'Không hỗ trợ'}
          </p>
          <p className="text-xs text-slate-400 max-w-[220px] mx-auto leading-relaxed">
            {errorMsg || displayText || 'Nói câu hỏi của bạn bằng tiếng Việt'}
          </p>
        </div>

        {/* Transcript */}
        {displayText && isListening && (
          <div className="w-full px-3 py-2 rounded-xl text-xs text-white/80 leading-relaxed"
            style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
            {displayText}
          </div>
        )}

        <button onClick={() => { try { cleanupRef.current?.(); } catch {} onClose(); }}
          className="px-6 py-2 rounded-xl text-sm text-slate-400 hover:bg-white/10 transition-colors"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          Huỷ
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN CHATBOT COMPONENT
   ═══════════════════════════════════════════════════════ */

export function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      type: 'assistant',
      text: 'Xin chào! 👋 Tôi là trợ lý AI của robot TTH-T1 tại **Future Consumer Expo 2026**. Tôi có thể giúp bạn tìm gian hàng, xem lịch trình, hoặc giải đáp thắc mắc. Bạn cần gì không? 😊',
    },
  ]);
  const [input, setInput]               = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  const [streamingId, setStreamingId]   = useState<string | null>(null);
  const [showVoice, setShowVoice]       = useState(false);
  const [isExpanded, setIsExpanded]     = useState(false);
  const messagesEndRef                  = useRef<HTMLDivElement>(null);
  const isBusy                          = isTyping || streamingId !== null;

  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages, isTyping, isExpanded]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isBusy) return;
    const trimmed = text.trim();
    const userMsg: Message = { id: Date.now().toString(), type: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const aId = (Date.now() + 1).toString();
    try {
      const history: ChatMessage[] = messages.map(m => ({ type: m.type, text: m.text }));
      const stream = streamChat(history, trimmed);
      let firstChunk = true;
      let accumulated = '';

      for await (const chunk of stream) {
        accumulated += chunk;
        if (firstChunk) {
          setIsTyping(false);
          setStreamingId(aId);
          setMessages(prev => [...prev, { id: aId, type: 'assistant', text: accumulated }]);
          firstChunk = false;
        } else {
          setMessages(prev => prev.map(m => m.id === aId ? { ...m, text: accumulated } : m));
        }
      }

      if (firstChunk) {
        setIsTyping(false);
        setMessages(prev => [...prev, { id: aId, type: 'assistant', text: 'Xin lỗi, tôi không thể trả lời lúc này. Bạn thử lại nhé! 😊' }]);
      }
      setStreamingId(null);
    } catch {
      setIsTyping(false);
      setStreamingId(null);
      const fallback = getFallbackResponse(trimmed);
      setMessages(prev => {
        const existing = prev.find(m => m.id === aId);
        if (existing) return prev.map(m => m.id === aId ? { ...m, text: fallback } : m);
        return [...prev, { id: aId, type: 'assistant', text: fallback }];
      });
    }
  }, [isBusy, messages]);

  const handleVoiceResult = useCallback((text: string) => {
    if (!isExpanded) setIsExpanded(true);
    setTimeout(() => sendMessage(text), 300);
  }, [isExpanded, sendMessage]);

  // ── Markdown renderer ──
  const mdComponents = {
    p: ({ ...props }: any) => <p className="mb-1.5 last:mb-0 whitespace-pre-wrap" {...props} />,
    ul: ({ ...props }: any) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5" {...props} />,
    ol: ({ ...props }: any) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5" {...props} />,
    li: ({ ...props }: any) => <li className="pl-0.5" {...props} />,
    strong: ({ ...props }: any) => <strong className="font-bold text-white" {...props} />,
    em: ({ ...props }: any) => <em className="italic text-slate-300" {...props} />,
  };

  return (
    <>
      {/* ── COMPACT VIEW ── */}
      <div
        onClick={() => setIsExpanded(true)}
        className="rounded-2xl overflow-hidden cursor-pointer transition-all"
        style={{ background: 'linear-gradient(135deg, #0f172a, #1c1917)', border: '1px solid rgba(249,115,22,0.15)' }}>

        {/* Header */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #f97316, #eab308)' }}>🤖</div>
            <div>
              <p className="text-xs font-bold text-white leading-none">Trợ lý AI · TTH-T1</p>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-[10px] text-slate-500">Nhấn để trò chuyện</span>
              </div>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        <div className="px-3 py-2 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {SUGGESTIONS.map(s => (
            <div key={s.text}
              onClick={e => { e.stopPropagation(); setIsExpanded(true); setTimeout(() => sendMessage(s.text), 300); }}
              className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full border text-slate-300 hover:text-white transition-colors"
              style={{ background: 'rgba(249,115,22,0.06)', borderColor: 'rgba(249,115,22,0.2)' }}>
              {s.label}
            </div>
          ))}
        </div>

        {/* Fake input */}
        <div className="px-3 pb-3 flex gap-2">
          <div className="flex-1 text-[11px] px-3 py-2 rounded-xl text-slate-500 flex items-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            Nhập câu hỏi...
          </div>
          <button
            onClick={e => { e.stopPropagation(); setShowVoice(true); }}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-orange-500/20"
            style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
            <Mic className="w-3.5 h-3.5 text-orange-400" />
          </button>
        </div>
      </div>

      {/* ── EXPANDED MODAL ── */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
          onClick={() => setIsExpanded(false)}>

          <div
            className="w-full h-full sm:h-auto sm:max-h-[85vh] sm:w-[80vw] sm:max-w-4xl sm:rounded-2xl flex flex-col shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #0f172a, #1c1917)',
              border: '1px solid rgba(249,115,22,0.15)',
            }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-4 py-3.5 border-b flex items-center justify-between flex-shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-base"
                  style={{ background: 'linear-gradient(135deg, #f97316, #eab308)' }}>🤖</div>
                <div>
                  <p className="text-sm font-bold text-white">Trợ lý AI · TTH-T1</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-[10px] text-slate-400">Future Consumer Expo 2026</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsExpanded(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ scrollbarWidth: 'none' }}>
              {messages.map(msg => (
                <div key={msg.id} className={`flex items-end gap-2 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.type === 'assistant' && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs mb-0.5"
                      style={{ background: 'linear-gradient(135deg, #f97316, #eab308)' }}>🤖</div>
                  )}
                  <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm"
                    style={msg.type === 'user' ? {
                      background: 'linear-gradient(135deg, #f97316, #ea580c)',
                      color: 'white', borderBottomRightRadius: '4px',
                    } : {
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#e2e8f0', borderBottomLeftRadius: '4px',
                    }}>
                    {msg.type === 'user' ? (
                      <span className="whitespace-pre-wrap break-words">{msg.text}</span>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                        {msg.text}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions inside modal */}
            <div className="px-4 py-2 flex gap-1.5 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
              {SUGGESTIONS.map(s => (
                <button key={s.text} onClick={() => sendMessage(s.text)}
                  disabled={isBusy}
                  className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full border text-slate-300 hover:text-white transition-colors disabled:opacity-40 whitespace-nowrap"
                  style={{ background: 'rgba(249,115,22,0.06)', borderColor: 'rgba(249,115,22,0.2)' }}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="px-4 pb-4 pt-2 flex gap-2 border-t flex-shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(15,23,42,0.5)' }}>
              <input
                type="text"
                placeholder="Nhập câu hỏi..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                    sendMessage(input);
                  }
                }}
                className="flex-1 text-sm px-4 py-2.5 rounded-xl outline-none text-white placeholder-slate-500"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              />
              <button onClick={() => setShowVoice(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:bg-orange-500/20"
                style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <Mic className="w-4 h-4 text-orange-400" />
              </button>
              <button onClick={() => sendMessage(input)} disabled={!input.trim() || isBusy}
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: input.trim() && !isBusy ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}>
                <Send className="w-4 h-4" style={{ color: input.trim() && !isBusy ? 'white' : '#475569' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice overlay */}
      {showVoice && (
        <VoiceOverlay onClose={() => setShowVoice(false)} onResult={handleVoiceResult} />
      )}
    </>
  );
}
