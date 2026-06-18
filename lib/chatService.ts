/**
 * chatService.ts
 * Future Consumer Expo 2026 — Gemini streaming chat service
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/* ═══════════════════════════════════════════════════════
   DATA TRIỂN LÃM — tự điền thông tin thực tế vào đây
   ═══════════════════════════════════════════════════════ */

const EXPO_INFO = {
  name: 'Future Consumer Expo 2026',
  date: '15/06/2026',
  location: 'Trung tâm Hội chợ & Triển lãm TP.HCM',

  // ── Gian hàng — điền thông tin thực tế ──
  booths: [
    { id: 'R1', name: 'Coca-Cola',  desc: 'Đồ uống có gas, nước trái cây',        location: 'Phòng 1' },
    { id: 'R2', name: 'Pepsi',      desc: 'Đồ uống có gas, trà, nước tăng lực',   location: 'Phòng 2' },
    { id: 'R3', name: 'Heineken',   desc: 'Bia cao cấp nhập khẩu',                location: 'Phòng 3' },
    { id: 'R4', name: 'Tiger',      desc: 'Bia Tiger, bia Larue, bia Bia Việt',   location: 'Phòng 4' },
    { id: 'R5', name: 'Sabeco',     desc: 'Bia Sài Gòn, bia 333',                 location: 'Phòng 5' },
    { id: 'R6', name: 'Abbott',     desc: 'Dinh dưỡng y tế, sữa công thức',       location: 'Phòng 6' },
    { id: 'R7', name: 'Nutifood',   desc: 'Sữa, thực phẩm dinh dưỡng Việt Nam',  location: 'Phòng 7' },
    { id: 'R8', name: 'Vinamilk',   desc: 'Sữa tươi, sữa chua, phô mai',         location: 'Phòng 8' },
  ],

  // ── Lịch trình — điền lịch thực tế ──
  schedule: [
    { time: '08:00', end: '08:30', label: 'Đón tiếp & Đăng ký',       location: 'Sảnh chính' },
    { time: '08:30', end: '09:00', label: 'Lễ khai mạc',              location: 'Hội trường chính' },
    { time: '09:00', end: '10:30', label: 'Keynote: Tương lai ngành tiêu dùng', location: 'Hội trường chính' },
    { time: '10:30', end: '11:00', label: 'Giải lao & Networking',     location: 'Sảnh kết nối' },
    { time: '11:00', end: '12:00', label: 'Tham quan gian hàng',       location: 'Khu triển lãm' },
    { time: '12:00', end: '13:00', label: 'Bữa trưa',                  location: 'Khu ăn uống' },
    { time: '13:00', end: '14:30', label: 'Hội thảo: Xu hướng 2026',  location: 'Hội trường chính' },
    { time: '14:30', end: '15:30', label: 'Demo sản phẩm mới',         location: 'Sân khấu trung tâm' },
    { time: '15:30', end: '16:00', label: 'Giải lao',                  location: 'Sảnh kết nối' },
    { time: '16:00', end: '17:30', label: 'Tọa đàm: Đổi mới sáng tạo', location: 'Hội trường chính' },
    { time: '17:30', end: '18:30', label: 'Lễ trao giải',              location: 'Sân khấu trung tâm' },
    { time: '18:30', end: '19:00', label: 'Bế mạc & Tiệc chia tay',   location: 'Sảnh chính' },
  ],

  // ── Tiện ích ──
  facilities: {
    restroom: 'Góc trái bản đồ, gần lối vào chính',
    food:     'Khu ăn uống — cuối hành lang khu B',
    parking:  'Bãi đỗ xe tầng hầm B1',
    wifi:     'Tên mạng: FutureExpo2026 | Mật khẩu: expo2026',
    info:     'Quầy thông tin — Sảnh chính, gần lối vào',
  },

  // ── Robot phục vụ ──
  robot: {
    name: 'TTH-T1',
    desc: 'Robot tiếp thị tự động — phát đồ uống, đồ ăn nhẹ, catalogue cho khách tham quan',
    drawers: [
      { id: 1, name: 'Đồ uống',    desc: 'Nước uống miễn phí cho khách' },
      { id: 2, name: 'Đồ ăn nhẹ', desc: 'Snack, bánh kẹo miễn phí' },
      { id: 3, name: 'Catalogue',  desc: 'Tài liệu giới thiệu các gian hàng' },
    ],
  },
};

/* ═══════════════════════════════════════════════════════
   SYSTEM PROMPT
   ═══════════════════════════════════════════════════════ */

function buildSystemPrompt(): string {
  const boothText = EXPO_INFO.booths
    .map(b => `• ${b.name} (${b.location}): ${b.desc}`)
    .join('\n');

  const scheduleText = EXPO_INFO.schedule
    .map(s => `• ${s.time}–${s.end}: ${s.label} — ${s.location}`)
    .join('\n');

  const drawerText = EXPO_INFO.robot.drawers
    .map(d => `• Ngăn ${d.id} — ${d.name}: ${d.desc}`)
    .join('\n');

  return `Bạn là trợ lý AI thân thiện của robot ${EXPO_INFO.robot.name} tại "${EXPO_INFO.name}".

THÔNG TIN SỰ KIỆN:
- Tên: ${EXPO_INFO.name}
- Ngày: ${EXPO_INFO.date}
- Địa điểm: ${EXPO_INFO.location}

CÁC GIAN HÀNG:
${boothText}

LỊCH TRÌNH HÔM NAY:
${scheduleText}

TIỆN ÍCH:
- Nhà vệ sinh: ${EXPO_INFO.facilities.restroom}
- Khu ăn uống: ${EXPO_INFO.facilities.food}
- Đỗ xe: ${EXPO_INFO.facilities.parking}
- WiFi: ${EXPO_INFO.facilities.wifi}
- Quầy thông tin: ${EXPO_INFO.facilities.info}

ROBOT TTH-T1:
${EXPO_INFO.robot.desc}
${drawerText}
(Khách có thể chạm vào ngăn trên màn hình để nhận đồ)

QUY TẮC TRẢ LỜI:
- Luôn trả lời bằng tiếng Việt, ngắn gọn, thân thiện, dùng emoji phù hợp
- Tối đa 3-4 câu mỗi câu hỏi, trừ khi cần liệt kê
- Nếu không chắc, hướng khách đến quầy thông tin
- Không bịa thông tin ngoài dữ liệu được cung cấp
- Với câu hỏi mở không liên quan triển lãm, trả lời ngắn gọn và lịch sự`;
}

/* ═══════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════ */

export interface ChatMessage {
  type: 'user' | 'assistant';
  text: string;
}

/* ═══════════════════════════════════════════════════════
   GEMINI STREAMING
   ═══════════════════════════════════════════════════════ */

// const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_MODEL = 'gemini-3.1-flash-lite';
// Rate limit cooldown sau khi bị 429
let rateLimitUntil = 0;
const COOLDOWN_MS = 30_000;

export async function* streamChat(
  history: ChatMessage[],
  userMessage: string,
): AsyncGenerator<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  console.log('apiKey =', apiKey);
  if (!apiKey) throw new Error('NO_API_KEY');

  // Đang trong cooldown → dùng fallback
  const now = Date.now();
  if (now < rateLimitUntil) throw new Error('RATE_LIMIT_COOLDOWN');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: buildSystemPrompt(),
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  });

  // Bỏ assistant message đầu tiên (lời chào mặc định)
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
      if (text) yield text;
    }
  } catch (err: any) {
    if (err?.message?.includes('429') || err?.status === 429) {
      rateLimitUntil = Date.now() + COOLDOWN_MS;
    }
    throw err;
  }
}

/* ═══════════════════════════════════════════════════════
   FALLBACK — khi không có API hoặc bị rate limit
   ═══════════════════════════════════════════════════════ */

const FALLBACKS: [string[], string][] = [
  [['xin chào', 'hello', 'hi', 'chào', 'hey'],
    'Xin chào! 👋 Chào mừng bạn đến với Future Consumer Expo 2026! Tôi có thể giúp bạn tìm gian hàng, xem lịch trình, hoặc nhận đồ uống miễn phí. Bạn cần gì không? 😊'],

  [['cảm ơn', 'thanks', 'thank'],
    'Không có gì! 😊 Rất vui được hỗ trợ bạn. Nếu cần gì thêm cứ hỏi nhé!'],

  [['nhà vệ sinh', 'toilet', 'wc', 'vệ sinh'],
    `🚻 Nhà vệ sinh nằm ở góc trái bản đồ, gần lối vào chính. Bạn có thể xem vị trí trên bản đồ màn hình chính!`],

  [['lịch trình', 'sự kiện', 'hôm nay', 'schedule', 'chương trình'],
    `📅 Lịch trình hôm nay:\n${EXPO_INFO.schedule.slice(0, 5).map(s => `• ${s.time}: ${s.label}`).join('\n')}\n...và nhiều hơn nữa! Xem đầy đủ tại quầy thông tin.`],

  [['gian hàng', 'booth', 'sơ đồ', 'ở đâu', 'map'],
    `🗺️ Các gian hàng tại triển lãm:\n${EXPO_INFO.booths.map(b => `• ${b.name} — ${b.location}`).join('\n')}`],

  [['đồ uống', 'nước', 'drink', 'uống'],
    '🥤 Bạn có thể chạm vào ngăn ĐỒ UỐNG trên màn hình bên phải để nhận đồ uống miễn phí từ robot TTH-T1!'],

  [['đồ ăn', 'ăn nhẹ', 'snack', 'bánh'],
    '🍪 Chạm vào ngăn ĐỒ ĂN NHẸ trên màn hình để nhận snack miễn phí từ robot TTH-T1!'],

  [['catalogue', 'tài liệu', 'brochure'],
    '📄 Chạm vào ngăn CATALOGUE trên màn hình để nhận tài liệu giới thiệu các gian hàng!'],

  [['wifi', 'internet', 'mạng'],
    `📶 WiFi miễn phí:\n• Tên mạng: FutureExpo2026\n• Mật khẩu: expo2026`],

  [['đỗ xe', 'parking', 'gửi xe', 'xe'],
    '🚗 Bãi đỗ xe miễn phí tại tầng hầm B1. Lối vào từ cổng chính phía Nam.'],

  [['robot', 'tth', 'ttht1'],
    `🤖 Tôi là robot TTH-T1 — robot tiếp thị tự động tại ${EXPO_INFO.name}!\nTôi có thể phát đồ uống, đồ ăn nhẹ và catalogue cho bạn. Chỉ cần chạm vào các ngăn trên màn hình!`],

  [['coca', 'cocacola', 'pepsi', 'heineken', 'tiger', 'sabeco', 'bia'],
    '🍺 Các thương hiệu đồ uống tại triển lãm: Coca-Cola (Phòng 1), Pepsi (Phòng 2), Heineken (Phòng 3), Tiger (Phòng 4), Sabeco (Phòng 5). Hãy ghé thăm để trải nghiệm sản phẩm mới nhất!'],

  [['abbott', 'nutifood', 'vinamilk', 'sữa'],
    '🥛 Các thương hiệu dinh dưỡng tại triển lãm: Abbott (Phòng 6), Nutifood (Phòng 7), Vinamilk (Phòng 8). Nhiều sản phẩm mới đang được giới thiệu!'],

  [['thông tin', 'help', 'hỗ trợ', 'liên hệ'],
    `ℹ️ Quầy thông tin đặt tại sảnh chính, gần lối vào. Nhân viên luôn sẵn sàng hỗ trợ bạn! 😊`],
];

export function getFallbackResponse(text: string): string {
  const lower = text.toLowerCase();
  for (const [keywords, response] of FALLBACKS) {
    if (keywords.some(k => lower.includes(k))) return response;
  }
  return 'Xin lỗi, hệ thống AI đang tạm thời quá tải. Vui lòng thử lại sau ít phút, hoặc đến quầy thông tin tại sảnh chính để được hỗ trợ trực tiếp! 😊';
}
