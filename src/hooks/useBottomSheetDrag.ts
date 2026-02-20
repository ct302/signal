import { useState, useRef, useCallback } from 'react';

interface UseBottomSheetDragOptions {
  initialHeight: number;       // vh units
  minHeight: number;           // vh units
  maxHeight: number;           // vh units
  dismissThreshold?: number;   // vh — dismiss if dragged below this
  onDismiss?: () => void;
  snapPoints?: number[];       // vh snap targets, e.g. [40, 60, 85]
}

interface UseBottomSheetDragReturn {
  sheetHeight: number;
  isDragging: boolean;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
  setSheetHeight: (h: number) => void;
}

export const useBottomSheetDrag = ({
  initialHeight,
  minHeight,
  maxHeight,
  dismissThreshold = 15,
  onDismiss,
  snapPoints,
}: UseBottomSheetDragOptions): UseBottomSheetDragReturn => {
  const [sheetHeight, setSheetHeight] = useState(initialHeight);
  const [isDragging, setIsDragging] = useState(false);

  const touchStartYRef = useRef(0);
  const startHeightRef = useRef(initialHeight);
  const rafRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartYRef.current = touch.clientY;
    startHeightRef.current = sheetHeight;
    setIsDragging(true);
  }, [sheetHeight]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    e.preventDefault();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const deltaY = touchStartYRef.current - touch.clientY; // positive = dragging up = taller
      const deltaVh = (deltaY / window.innerHeight) * 100;
      const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeightRef.current + deltaVh));
      setSheetHeight(newHeight);
    });
  }, [minHeight, maxHeight]);

  const handleTouchEnd = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsDragging(false);

    setSheetHeight(current => {
      // Dismiss if below threshold
      if (current <= dismissThreshold && onDismiss) {
        onDismiss();
        return initialHeight; // reset for next open
      }

      // Snap to nearest snap point
      if (snapPoints && snapPoints.length > 0) {
        let nearest = snapPoints[0];
        let minDist = Math.abs(current - nearest);
        for (let i = 1; i < snapPoints.length; i++) {
          const dist = Math.abs(current - snapPoints[i]);
          if (dist < minDist) {
            minDist = dist;
            nearest = snapPoints[i];
          }
        }
        return nearest;
      }

      return current;
    });
  }, [dismissThreshold, onDismiss, initialHeight, snapPoints]);

  return {
    sheetHeight,
    isDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    setSheetHeight,
  };
};
