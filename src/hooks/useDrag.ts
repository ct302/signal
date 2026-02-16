import { useState, useRef, useEffect, useCallback } from 'react';
import { Position, Size } from '../types';

interface UseDragOptions {
  isMobile: boolean;
}

export const useDrag = ({ isMobile }: UseDragOptions) => {
  const [defPos, setDefPos] = useState<Position | null>(null);
  const [quizPos, setQuizPos] = useState<Position | null>(null);
  const [synthPos, setSynthPos] = useState<Position | null>(null);
  const [defSize, setDefSize] = useState<Size>({ width: 340 });
  const [miniDefSize, setMiniDefSize] = useState<Size>({ width: 280 });
  const [miniDefPosition, setMiniDefPosition] = useState<Position | null>(null);

  const isDraggingRef = useRef(false);
  const dragTargetRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isResizingRef = useRef(false);
  const resizeTargetRef = useRef<string | null>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);

  const startDrag = useCallback((e: React.MouseEvent, target: string) => {
    if (isMobile) return;
    e.preventDefault();
    isDraggingRef.current = true;
    dragTargetRef.current = target;
    const rect = (e.currentTarget as HTMLElement)
      .closest('.def-window, .quiz-window, .synthesis-window')
      ?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  }, [isMobile]);

  const startResize = useCallback((e: React.MouseEvent, target: string) => {
    if (isMobile) return;
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    resizeTargetRef.current = target;
    resizeStartXRef.current = e.clientX;
    if (target.startsWith('def')) {
      resizeStartWidthRef.current = defSize.width;
    } else if (target.startsWith('mini')) {
      resizeStartWidthRef.current = miniDefSize.width;
    }
  }, [isMobile, defSize.width, miniDefSize.width]);

  const handleMiniHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile || !(e.target as HTMLElement).closest('.header-drag-area')) return;
    e.preventDefault();
    isDraggingRef.current = true;
    dragTargetRef.current = 'mini';
    const rect = (e.currentTarget as HTMLElement)
      .closest('.mini-def-window')
      ?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  }, [isMobile]);

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (isDraggingRef.current && dragTargetRef.current) {
        const newX = e.clientX - dragOffsetRef.current.x;
        const newY = e.clientY - dragOffsetRef.current.y;
        // Clamp to viewport bounds — keep at least 100px visible vertically, 200px horizontally
        const clampToViewport = (x: number, y: number) => ({
          top: Math.max(0, Math.min(window.innerHeight - 100, y)),
          left: Math.max(0, Math.min(window.innerWidth - 200, x)),
        });
        if (dragTargetRef.current === 'def') {
          setDefPos(clampToViewport(newX, newY));
        } else if (dragTargetRef.current === 'quiz') {
          setQuizPos(clampToViewport(newX, newY));
        } else if (dragTargetRef.current === 'synthesis') {
          setSynthPos(clampToViewport(newX, newY));
        } else if (dragTargetRef.current === 'mini') {
          setMiniDefPosition(clampToViewport(
            e.clientX - dragOffsetRef.current.x,
            e.clientY - dragOffsetRef.current.y
          ));
        }
      }

      if (isResizingRef.current && resizeTargetRef.current) {
        const deltaX = e.clientX - resizeStartXRef.current;
        const isLeft = resizeTargetRef.current.includes('left');
        const newWidth = isLeft
          ? resizeStartWidthRef.current - deltaX
          : resizeStartWidthRef.current + deltaX;
        const clampedWidth = Math.max(200, Math.min(600, newWidth));

        if (resizeTargetRef.current.startsWith('def')) {
          setDefSize({ width: clampedWidth });
          if (isLeft && defPos) {
            const widthDelta = defSize.width - clampedWidth;
            setDefPos(prev =>
              prev ? { ...prev, left: (typeof prev.left === 'number' ? prev.left : 0) + widthDelta } : null
            );
          }
        } else if (resizeTargetRef.current.startsWith('mini')) {
          setMiniDefSize({ width: clampedWidth });
          if (isLeft && miniDefPosition) {
            const widthDelta = miniDefSize.width - clampedWidth;
            setMiniDefPosition(prev =>
              prev ? { ...prev, left: (typeof prev.left === 'number' ? prev.left : 0) + widthDelta } : null
            );
          }
        }
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      dragTargetRef.current = null;
      isResizingRef.current = false;
      resizeTargetRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [defSize.width, miniDefSize.width, defPos, miniDefPosition]);

  return {
    defPos,
    setDefPos,
    quizPos,
    setQuizPos,
    synthPos,
    setSynthPos,
    defSize,
    setDefSize,
    miniDefSize,
    setMiniDefSize,
    miniDefPosition,
    setMiniDefPosition,
    startDrag,
    startResize,
    handleMiniHeaderMouseDown
  };
};
