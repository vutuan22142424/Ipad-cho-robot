import React, { useState } from 'react';
import { X, Plus, Trash2, Edit, Save } from 'lucide-react';
import { ScheduleItem, ScheduleIcon, saveSchedule } from '../../lib/scheduleStore';

interface Props {
  schedule: ScheduleItem[];
  onClose: () => void;
  onSave: (newSchedule: ScheduleItem[]) => void;
}

const AVAILABLE_ICONS: ScheduleIcon[] = ['Users', 'Mic', 'CalendarDays', 'Utensils', 'MapPin', 'Trophy'];

export function AdminScheduleModal({ schedule, onClose, onSave }: Props) {
  const [items, setItems] = useState<ScheduleItem[]>([...schedule]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleDragSort = () => { /* Có thể bổ sung tính năng kéo thả sau nếu cần */ };

  const handleUpdate = (id: number, field: keyof ScheduleItem, value: any) => {
    setItems(items.map(it => it.id === id ? { ...it, [field]: value } : it));
  };

  const handleAdd = () => {
    const defaultAccent = '#2563eb';
    const newItem: ScheduleItem = {
      id: Date.now(),
      time: '08:00',
      end: '09:00',
      duration: '60 phút',
      icon: 'CalendarDays',
      label: 'Sự kiện mới',
      detail: 'Chưa có địa điểm',
      accent: defaultAccent,
      speaker: ''
    };
    setItems([...items, newItem].sort((a, b) => a.time.localeCompare(b.time)));
    setEditingId(newItem.id);
  };

  const handleDelete = (id: number) => {
    if (confirm('Xóa sự kiện này?')) {
      setItems(items.filter(it => it.id !== id));
    }
  };

  const saveAll = () => {
    // Sắp xếp lại giờ trước khi lưu
    const sorted = [...items].sort((a, b) => a.time.localeCompare(b.time));
    saveSchedule(sorted);
    onSave(sorted);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-800">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50 relative">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
            <Edit className="w-5 h-5 text-blue-600" />
            Cài đặt Lịch trình
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100">
          {items.map(item => {
            const isEditing = editingId === item.id;
            return (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.accent }}></span>
                    {isEditing ? (
                      <input 
                        value={item.label} 
                        onChange={e => handleUpdate(item.id, 'label', e.target.value)}
                        className="border rounded px-2 py-1 text-sm font-semibold text-slate-900 w-48"
                      />
                    ) : (
                      item.label
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                     <button
                        onClick={() => editingId === item.id ? setEditingId(null) : setEditingId(item.id)}
                        className="px-3 py-1.5 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1"
                      >
                        {isEditing ? <Save className="w-3 h-3"/> : <Edit className="w-3 h-3" />}
                        {isEditing ? 'Xong' : 'Sửa'}
                     </button>
                     <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Thời gian Bắt đầu</label>
                      <input type="time" value={item.time} onChange={e => handleUpdate(item.id, 'time', e.target.value)} className="w-full border rounded px-2 py-1 text-slate-900"/>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Thời gian Kết thúc</label>
                      <input type="time" value={item.end} onChange={e => handleUpdate(item.id, 'end', e.target.value)} className="w-full border rounded px-2 py-1 text-slate-900"/>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Thời lượng (Text)</label>
                        <input value={item.duration} onChange={e => handleUpdate(item.id, 'duration', e.target.value)} className="w-full border rounded px-2 py-1 text-slate-900"/>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Địa điểm</label>
                        <input value={item.detail} onChange={e => handleUpdate(item.id, 'detail', e.target.value)} className="w-full border rounded px-2 py-1 text-slate-900"/>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Speaker (Tùy chọn)</label>
                        <input value={item.speaker} onChange={e => handleUpdate(item.id, 'speaker', e.target.value)} className="w-full border rounded px-2 py-1 text-slate-900"/>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Mã Màu (HEX)</label>
                        <div className="flex gap-2">
                           <input type="color" value={item.accent} onChange={e => handleUpdate(item.id, 'accent', e.target.value)} className="w-8 h-8 rounded p-0 border-0"/>
                           <input value={item.accent} onChange={e => handleUpdate(item.id, 'accent', e.target.value)} className="w-full border rounded px-2 py-1 font-mono text-slate-900"/>
                        </div>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Icon</label>
                        <select value={item.icon} onChange={e => handleUpdate(item.id, 'icon', e.target.value as ScheduleIcon)} className="w-full border rounded px-2 py-1 text-slate-900">
                           {AVAILABLE_ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                        </select>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                     <span>Bắt đầu: <strong className="text-slate-700">{item.time}</strong></span>
                     <span>Kết thúc: <strong className="text-slate-700">{item.end}</strong></span>
                     <span>Địa điểm: <strong className="text-slate-700">{item.detail}</strong></span>
                     {item.speaker && <span>Speaker: <strong className="text-slate-700">{item.speaker}</strong></span>}
                  </div>
                )}
              </div>
            );
          })}
          
          <button 
            onClick={handleAdd}
            className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-semibold hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> Thêm Sự Kiện
          </button>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-200">
            Hủy
          </button>
          <button onClick={saveAll} className="px-5 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 shadow-md hover:shadow-lg transition-all">
            <Save className="w-4 h-4" />
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}
