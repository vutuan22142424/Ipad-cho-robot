'use client';

import { useState } from 'react';
import { Navigation2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NavigationMode() {
  const [isNavigating, setIsNavigating] = useState(false);

  return (
    <div className="bg-card border border-border/50 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Navigation2 className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-bold text-foreground">Navigation Mode</h2>
      </div>

      {isNavigating ? (
        <div className="space-y-4">
          <div className="bg-secondary/40 border border-primary/30 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-2">Dạng dẫn tới:</p>
            <p className="text-lg font-bold text-accent mb-4">Booth AI</p>

            <div className="bg-primary/10 border border-primary/30 rounded p-3 mb-4">
              <p className="text-xs text-muted-foreground mb-1">Khoảng cách:</p>
              <p className="text-2xl font-bold text-foreground">15m</p>
            </div>

            <div className="space-y-2 mb-4 text-sm text-muted-foreground">
              <p>• Đi thẳng 10m</p>
              <p>• Quay trái vào AI Zone</p>
              <p>• Tìm Booth AI</p>
            </div>

            <Button
              onClick={() => setIsNavigating(false)}
              variant="outline"
              className="w-full gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Dừng lại
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground text-center py-8">
            Chọn một booth trên bản đồ để bắt đầu điều hướng
          </p>
          <Button
            onClick={() => setIsNavigating(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <Navigation2 className="w-4 h-4" />
            Dạng dẫn tới Booth AI
          </Button>
        </div>
      )}
    </div>
  );
}
