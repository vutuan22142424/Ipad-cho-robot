'use client';

import { Maximize2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CatalogCard() {
  return (
    <div className="bg-card border border-border/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-foreground">Catalog For You</h2>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
        >
          <Maximize2 className="w-4 h-4" />
          <span className="hidden sm:inline">Xem thêm</span>
        </Button>
      </div>

      <div className="bg-secondary/40 border border-border/30 rounded-lg overflow-hidden mb-4">
        <div className="grid grid-cols-2 gap-2 p-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="aspect-video bg-gradient-to-br from-blue-600 to-blue-900 rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center border border-border/30"
            >
              <span className="text-white text-xs font-semibold">Ảnh {i}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          (Tap để xem chi tiết hoặc quét mã QR)
        </p>
        <QrCode className="w-6 h-6 text-primary" />
      </div>
    </div>
  );
}
