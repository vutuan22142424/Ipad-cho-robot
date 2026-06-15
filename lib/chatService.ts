/**
 * chatService.ts
 * Kết nối ChatBot với Google Gemini API (streaming).
 * Fallback về câu trả lời hardcoded nếu API không khả dụng.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadSchedule, fetchScheduleApi, type ScheduleItem } from './scheduleStore';

/* ═══════════════════════════════════════════════════════════════
   DỮ LIỆU TRIỂN LÃM — cung cấp context cho AI
   ═══════════════════════════════════════════════════════════════ */

const EXHIBITION_INFO = {
  name: 'Triển lãm Công nghệ & Robot 2026',
  date: '15/03/2026',
  location: 'Trung tâm Triển lãm Quốc tế',
  booths: [
    { id: 'A1', name: 'AI & Robotics', desc: 'Trí tuệ nhân tạo & Robot' },
    { id: 'A2', name: 'Smart Home', desc: 'Nhà thông minh IoT' },
    { id: 'A3', name: 'Green Energy', desc: 'Năng lượng tái tạo' },
    { id: 'B1', name: 'Semiconductor', desc: 'Chip & Bán dẫn' },
    { id: 'B2', name: 'VR/AR Zone', desc: 'Thực tế ảo & Tăng cường' },
    { id: 'B3', name: 'Drone Tech', desc: 'Công nghệ UAV' },
    { id: 'C1', name: '3D Printing', desc: 'In 3D & Sản xuất' },
    { id: 'C2', name: 'EV & Mobility', desc: 'Xe điện & Di chuyển' },
    { id: 'C3', name: 'BioTech', desc: 'Công nghệ sinh học' },
    { id: 'D1', name: 'FinTech', desc: 'Công nghệ tài chính' },
    { id: 'D2', name: 'Cyber Security', desc: 'An ninh mạng' },
    { id: 'D3', name: 'Space Tech', desc: 'Công nghệ vũ trụ' },
  ],
  facilities: {
    restrooms: ['Góc trái sảnh chính (Tầng 1, gần lối vào)', 'Cuối hành lang khu B (Tầng 1)'],
    foodArea: 'Nhà hàng • Tầng 4',
    entrance: 'Cổng chính phía Nam',
    infoDesk: 'Sảnh chính, gần lối vào',
  },
  robots: [
    { name: 'RoboMarket X1', desc: 'Robot tiếp thị tự động – phát catalogue, đồ ăn nhẹ, đồ uống' },
    { name: 'AIGuide Pro', desc: 'Robot hướng dẫn thông minh' },
    { name: 'SmartServe 3.0', desc: 'Robot phục vụ sự kiện' },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   TẠO SYSTEM PROMPT
   ═══════════════════════════════════════════════════════════════ */

function buildSystemPrompt(schedule: ScheduleItem[]): string {
  const scheduleText = schedule.length > 0
    ? schedule.map(s => `• ${s.time}–${s.end}: ${s.label} (${s.detail}${s.speaker ? ', ' + s.speaker : ''})`).join('\n')
    : 'Chưa có lịch trình.';

  const boothText = EXHIBITION_INFO.booths
    .map(b => `• Gian hàng ${b.id}: ${b.name} – ${b.desc}`)
    .join('\n');

  return `Bạn là trợ lý AI thân thiện của Robot Tiếp Thị tại "${EXHIBITION_INFO.name}".

THÔNG TIN SỰ KIỆN:
- Ngày: ${EXHIBITION_INFO.date}
- Địa điểm: ${EXHIBITION_INFO.location}

CÁC GIAN HÀNG:
${boothText}

LỊCH TRÌNH HÔM NAY:
${scheduleText}

TIỆN ÍCH:
- Nhà vệ sinh: ${EXHIBITION_INFO.facilities.restrooms.join('; ')}
- Khu ăn uống: ${EXHIBITION_INFO.facilities.foodArea}
- Lối vào: ${EXHIBITION_INFO.facilities.entrance}
- Quầy thông tin: ${EXHIBITION_INFO.facilities.infoDesk}

SẢN PHẨM ROBOT:
${EXHIBITION_INFO.robots.map(r => `• ${r.name}: ${r.desc}`).join('\n')}

QUY TẮC:
- Luôn trả lời bằng tiếng Việt, ngắn gọn, thân thiện
- Dùng emoji phù hợp để sinh động hơn
- Nếu không chắc chắn, hướng dẫn khách đến quầy thông tin
- Không bịa thông tin ngoài dữ liệu được cung cấp
- Trả lời tối đa 3-4 câu cho mỗi câu hỏi, trừ khi cần liệt kê chi tiết
- TUYỆT ĐỐI GIỮ NGUYÊN tên sự kiện trong lịch trình (ví dụ: nếu có chữ "Lễ khai quốc", phải in ra y hệt, không được tự ý sửa thành "Lễ khai mạc").`;
}

/* ═══════════════════════════════════════════════════════════════
   GEMINI STREAMING CHAT
   ═══════════════════════════════════════════════════════════════ */

export interface ChatMessage {
  type: 'user' | 'assistant';
  text: string;
}
// Model: gemini-2.5-flash
const GEMINI_MODEL = 'gemini-2.5-flash';

// ── Rate limit cooldown: sau khi bị 429, skip API trong 30 giây ──
let rateLimitUntil = 0;
const COOLDOWN_MS = 30_000; // 30 giây

// ── Cache lịch trình trong bộ nhớ để tránh bị 429 từ MockAPI khi chat liên tục ──
let cachedSchedule: ScheduleItem[] | null = null;
let lastScheduleFetch = 0;
const SCHEDULE_CACHE_MS = 60_000; // Cache 1 phút

/**
 * Gọi Gemini API với streaming.
 * Tự động skip nếu đang trong cooldown period (sau 429).
 */
export async function* streamChat(
  history: ChatMessage[],
  userMessage: string,
): AsyncGenerator<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[ChatBot] ❌ NEXT_PUBLIC_GEMINI_API_KEY chưa được cấu hình!');
    throw new Error('NO_API_KEY');
  }

  // Nếu đang trong cooldown period → skip API, dùng fallback ngay
  const now = Date.now();
  if (now < rateLimitUntil) {
    const remaining = Math.ceil((rateLimitUntil - now) / 1000);
    console.log(`[ChatBot] ⏳ Đang cooldown (còn ${remaining}s) → dùng fallback`);
    throw new Error('RATE_LIMIT_COOLDOWN');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  let schedule: ScheduleItem[] = [];
  // Ưu tiên dùng cache trong 1 phút để không bị MockAPI khoá API (429) do spam request
  if (cachedSchedule && now - lastScheduleFetch < SCHEDULE_CACHE_MS) {
    schedule = cachedSchedule;
  } else {
    schedule = await fetchScheduleApi();
    if (schedule && schedule.length > 0) {
      cachedSchedule = schedule;
      lastScheduleFetch = now;
    } else {
      // Fallback về localStorage nếu MockAPI bị lỗi
      schedule = loadSchedule();
    }
  }

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: buildSystemPrompt(schedule),
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
  });

  // Chuẩn bị history cho Gemini
  // Bỏ các message 'assistant' (model) ở đầu — ví dụ lời chào mặc định
  const filtered = history.filter(m => m.text.trim());
  let startIdx = 0;
  while (startIdx < filtered.length && filtered[startIdx].type === 'assistant') {
    startIdx++;
  }
  const geminiHistory = filtered.slice(startIdx).map(m => ({
    role: m.type === 'user' ? 'user' as const : 'model' as const,
    parts: [{ text: m.text }],
  }));

  try {
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessageStream(userMessage);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        console.log(`[ChatBot] ✅ Gemini trả lời thành công!`);
        yield text;
      }
    }
    return;
  } catch (err: any) {
    const is429 = err?.message?.includes('429') || err?.status === 429;
    if (is429) {
      rateLimitUntil = Date.now() + COOLDOWN_MS;
      console.warn(`[ChatBot] ⚠️ Rate limited! Cooldown 60s → dùng fallback`);
    } else {
      console.warn(`[ChatBot] ❌ Gemini lỗi:`, err?.message || err);
    }
    throw err;
  }
}

/* ═══════════════════════════════════════════════════════════════
   FALLBACK RESPONSES — dùng khi không có API key hoặc API lỗi
   ═══════════════════════════════════════════════════════════════ */

const FALLBACK_RESPONSES: [string[], string][] = [
  // Chào hỏi
  [['xin chào', 'xin chao', 'hello', 'hi', 'chào', 'chao', 'hey'],
    'Xin chào! 👋 Rất vui được gặp bạn tại Triển lãm Công nghệ & Robot 2026! Tôi có thể giúp bạn tìm đường, xem lịch trình, hoặc giới thiệu sản phẩm. Bạn cần gì không? 😊'],
  // Cảm ơn
  [['cảm ơn', 'cam on', 'thanks', 'thank'],
    'Không có gì! 😊 Rất vui khi được hỗ trợ bạn. Nếu cần gì thêm, cứ hỏi nhé!'],
  // Nhà vệ sinh
  [['nhà vệ sinh', 'nha ve sinh', 'toilet', 'wc', 'vệ sinh', 've sinh'],
    'Nhà vệ sinh có 2 vị trí:\n🚻 Góc trái sảnh chính (Tầng 1, gần lối vào)\n🚻 Cuối hành lang khu B (Tầng 1)'],
  // Robot / Sản phẩm
  [['robot', 'sản phẩm', 'product'],
    'Chúng tôi đang trưng bày:\n🤖 RoboMarket X1 – Robot tiếp thị tự động\n🤖 AIGuide Pro – Robot hướng dẫn thông minh\n🤖 SmartServe 3.0 – Robot phục vụ sự kiện\nBạn muốn biết thêm về sản phẩm nào?'],
  // Sơ đồ / Gian hàng
  [['sơ đồ', 'gian hàng', 'booth', 'khu', 'map', 'bản đồ'],
    'Sơ đồ triển lãm gồm 12 gian hàng:\n• Khu A: AI & Robotics, Smart Home, Green Energy\n• Khu B: Semiconductor, VR/AR, Drone Tech\n• Khu C: 3D Printing, EV & Mobility, BioTech\n• Khu D: FinTech, Cyber Security, Space Tech\n📍 Bạn có thể xem trực tiếp trên bản đồ!'],
  // Ăn uống
  [['ăn', 'uống', 'food', 'drink', 'đói', 'khát', 'nhà hàng', 'canteen', 'ăn uống'],
    'Khu ăn uống:\n🍽️ Nhà hàng chính: Tầng 4\n☕ Khu giải khát: Sảnh kết nối (Khu B)\n🍰 Đồ ăn nhẹ: Robot RoboMarket X1 có thể phục vụ!'],
  // WiFi
  [['wifi', 'internet', 'mạng', 'password', 'pass wifi'],
    'WiFi miễn phí:\n📶 Tên mạng: TechExpo2026\n🔑 Mật khẩu: robot2026\nKết nối khắp khu triển lãm!'],
  // Lối vào / Parking
  [['lối vào', 'entrance', 'đỗ xe', 'parking', 'ra vào', 'gửi xe'],
    'Lối vào chính: Cổng phía Nam\n🚗 Bãi đỗ xe: Tầng hầm B1-B2 (miễn phí)\n🚌 Xe buýt: Trạm dừng ngay cổng chính'],
  // Hỗ trợ / Thông tin
  [['hỗ trợ', 'help', 'thông tin', 'info', 'liên hệ', 'quầy thông tin'],
    'Quầy thông tin:\n📍 Sảnh chính, gần lối vào (Tầng 1)\n📞 Hotline: 1900-xxxx\nNhân viên hỗ trợ sẵn sàng giúp đỡ bạn! 😊'],
  // AI / Công nghệ
  [['trí tuệ nhân tạo', 'công nghệ', 'technology', 'tech'],
    'Gian hàng AI & Công nghệ nổi bật:\n🤖 A1: AI & Robotics – Trí tuệ nhân tạo\n🥽 B2: VR/AR Zone – Thực tế ảo\n💎 B1: Semiconductor – Chip & Bán dẫn\n🚀 D3: Space Tech – Công nghệ vũ trụ'],
  // Giờ giấc
  [['mấy giờ', 'giờ mở', 'giờ đóng', 'khi nào', 'bao giờ', 'thời gian'],
    'Triển lãm diễn ra từ 08:00 – 20:00 ngày 15/03/2026\n🎯 Sự kiện chính: 09:00 – 18:30\n🎉 Tiệc chia tay: 19:30 – 20:00'],
];

export function getFallbackResponse(text: string): string {
  const lower = text.toLowerCase();

  // Kiểm tra lịch trình (ưu tiên cao — dùng dữ liệu thật từ scheduleStore)
  if (lower.includes('lịch trình') || lower.includes('sự kiện') || lower.includes('hôm nay')
    || lower.includes('schedule') || lower.includes('event') || lower.includes('giờ chiều')
    || lower.includes('giờ sáng') || lower.includes('tiếp theo')) {
    const schedule = loadSchedule();
    if (schedule.length > 0) {
      return '📅 Lịch trình hôm nay:\n' + schedule.map(s => `• ${s.time}–${s.end}: ${s.label}`).join('\n');
    }
    return 'Hiện tại chưa có lịch trình nào được cập nhật.';
  }

  // Tìm keyword khớp trong danh sách fallback
  // Chống lỗi match chuỗi con (vd: "hi" trong "hiện đại", "ai" trong "lại")
  for (const [keywords, response] of FALLBACK_RESPONSES) {
    if (keywords.some(k => {
      const regex = new RegExp(`(?:^|\\s|[.,!?])` + k + `(?:$|\\s|[.,!?])`, 'i');
      return regex.test(lower);
    })) return response;
  }

  return 'Xin lỗi, hiện tại hệ thống AI đang bị quá tải (vượt quá số lượng câu hỏi miễn phí của Google). Bạn vui lòng chờ khoảng 1 phút rồi thử lại, hoặc đến Quầy thông tin để được hỗ trợ trực tiếp nhé! 😊';
}
