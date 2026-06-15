'use client';

import { useEffect, useRef } from 'react';
import { Network } from '@capacitor/network';
import { db } from '@/lib/db';

export function OfflineSync() {
  const isSyncing = useRef(false);

  useEffect(() => {
    const syncData = async () => {
      if (isSyncing.current) return;
      
      try {
        const status = await Network.getStatus();
        // Giả sử có kết nối nếu không thể xác định hoặc có mạng
        if (status && !status.connected) return;
      } catch (e) {
        // Fallback for browsers if capacitor network fails
        if (!navigator.onLine) return;
      }

      const pendingItems = await db.syncQueue.toArray();
      if (pendingItems.length === 0) return;

      isSyncing.current = true;
      try {
        console.log(`⏳ Bắt đầu đồng bộ ${pendingItems.length} bản ghi lên Remote Database...`);
        
        // TODO: Thay thế bằng API Endpoint thực tế của Remote Database
        // const response = await fetch('http://172.19.7.100/api/telemetry/sync', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ data: pendingItems })
        // });
        
        // Giả lập quá trình gửi API:
        await new Promise(resolve => setTimeout(resolve, 800));
        const response = { ok: true }; // Giả lập thành công

        if (response.ok) {
          const idsToDelete = pendingItems.map(item => item.id!);
          await db.syncQueue.bulkDelete(idsToDelete);
          console.log(`✅ Đã đồng bộ thành công và dọn dẹp ${idsToDelete.length} bản ghi khỏi Local DB.`);
        }
      } catch (error) {
        console.error("❌ Đồng bộ thất bại, sẽ thử lại trong chu kỳ tiếp theo:", error);
      } finally {
        isSyncing.current = false;
      }
    };

    // Chạy khi có sự kiện mạng kết nối lại
    const listener = Network.addListener('networkStatusChange', status => {
      if (status.connected) syncData();
    });

    // Chạy định kỳ mỗi 15 giây để quét và đồng bộ
    const interval = setInterval(syncData, 15000);
    
    // Chạy thử lần đầu khi component mount
    syncData();

    return () => {
      clearInterval(interval);
      listener.then(l => l.remove());
    };
  }, []);

  return null; // Component này chỉ chạy ngầm logic, không render ra UI
}
