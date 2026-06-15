export type ScheduleIcon = 'Users' | 'Mic' | 'CalendarDays' | 'Utensils' | 'MapPin' | 'Trophy';

export interface ScheduleItem {
  id: number;
  time: string; // HH:mm
  end: string; // HH:mm
  duration: string;
  icon: ScheduleIcon;
  label: string;
  detail: string;
  accent: string;
  speaker: string;
}

const defaultSchedule: ScheduleItem[] = [
  { id: 1, time: '08:00', end: '08:30', duration: '30 phút', icon: 'Users', label: 'Đón tiếp & Đăng ký', detail: 'Sảnh chính • Tầng 1', accent: '#0ea5e9', speaker: 'Ban tổ chức' },
  { id: 2, time: '08:30', end: '09:00', duration: '30 phút', icon: 'Mic', label: 'Lễ khai mạc', detail: 'Hội trường A • Tầng 1', accent: '#2563eb', speaker: 'BGĐ & Đại biểu' },
  { id: 3, time: '09:00', end: '10:30', duration: '90 phút', icon: 'CalendarDays', label: 'Keynote: Tương lai AI', detail: 'Hội trường chính • Tầng 2', accent: '#7c3aed', speaker: 'TS. Nguyễn Minh Tuấn' },
  { id: 4, time: '10:30', end: '11:00', duration: '30 phút', icon: 'Utensils', label: 'Giải lao & Networking', detail: 'Khu vực B • Sảnh kết nối', accent: '#f59e0b', speaker: '' },
  { id: 5, time: '11:00', end: '12:00', duration: '60 phút', icon: 'MapPin', label: 'Tham quan gian hàng', detail: 'Khu triển lãm • Tầng 1–3', accent: '#10b981', speaker: 'Hướng dẫn viên' },
  { id: 6, time: '12:00', end: '13:00', duration: '60 phút', icon: 'Utensils', label: 'Bữa trưa', detail: 'Nhà hàng • Tầng 4', accent: '#f97316', speaker: '' },
  { id: 7, time: '13:00', end: '14:30', duration: '90 phút', icon: 'Mic', label: 'Panel: Robot & Con người', detail: 'Hội trường chính • Tầng 2', accent: '#8b5cf6', speaker: '5 diễn giả' },
  { id: 8, time: '14:30', end: '15:30', duration: '60 phút', icon: 'Users', label: 'Workshop: Lập trình AI', detail: 'Phòng thực hành • Tầng 3', accent: '#06b6d4', speaker: 'Kỹ sư Google' },
  { id: 9, time: '15:30', end: '16:30', duration: '60 phút', icon: 'MapPin', label: 'Demo sản phẩm robot', detail: 'Sân khấu trung tâm • Tầng 1', accent: '#10b981', speaker: 'Đội phát triển' },
  { id: 10, time: '16:30', end: '17:30', duration: '60 phút', icon: 'Utensils', label: 'Tiệc chiều & Giao lưu', detail: 'Sảnh chính • Tầng 1', accent: '#f59e0b', speaker: '' },
  { id: 11, time: '17:30', end: '18:30', duration: '60 phút', icon: 'Mic', label: 'Toạ đàm: Startup & AI', detail: 'Hội trường B • Tầng 2', accent: '#ec4899', speaker: 'CEO các startup' },
  { id: 12, time: '18:30', end: '19:30', duration: '60 phút', icon: 'Trophy', label: 'Lễ trao giải Innovation', detail: 'Sân khấu trung tâm • Tầng 1', accent: '#f59e0b', speaker: 'BTC & Đối tác' },
  { id: 13, time: '19:30', end: '20:00', duration: '30 phút', icon: 'Mic', label: 'Bế mạc & Tiệc chia tay', detail: 'Hội trường chính', accent: '#6366f1', speaker: 'BGĐ' },
];

export const MOCK_API_URL = 'https://69f458c0bd2396bf5310c8bf.mockapi.io/schedules';

export async function fetchScheduleApi(): Promise<ScheduleItem[]> {
  try {
    // Bỏ query param cache buster vì MockAPI hiểu nhầm đó là lệnh tìm kiếm filter, chỉ cần { cache: 'no-store' } là đủ
    const res = await fetch(MOCK_API_URL, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Chuyển đổi id sang number nếu cần, hoặc lưu nguyên
        const parsedData = data.map((item: any) => ({
          ...item,
          id: typeof item.id === 'string' ? parseInt(item.id, 10) : item.id
        }));
        saveSchedule(parsedData);
        return parsedData;
      }
    }
  } catch (error) {
    console.error('Failed to fetch schedule from API', error);
  }
  return [];
}

export function loadSchedule(): ScheduleItem[] {
  try {
    const data = localStorage.getItem('kiosk_schedule');
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as ScheduleItem[];
      }
    }
  } catch (error) {
    console.error('Failed to load schedule from localStorage', error);
  }
  // Nếu lấy lỗi hoặc rỗng thì luôn fallback về dữ liệu mẫu (để người dùng đỡ bị trắng trơn)
  return defaultSchedule;
}

export function saveSchedule(schedule: ScheduleItem[]) {
  try {
    localStorage.setItem('kiosk_schedule', JSON.stringify(schedule));
  } catch (error) {
    console.error('Failed to save schedule to localStorage', error);
  }
}

export const getIconMap = () => {
    // Import that maps the strings to the actual lucide icons inside components if needed.
    // However, it's cleaner to handle the mapping in the component directly importing them.
};
