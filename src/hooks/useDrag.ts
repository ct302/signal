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
  const resizeStartYRef = useRef(0);
  const resizeStartWidthRef = useRef(0);
  const resizeStartHeightRef = useRef(0);

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
    resizeStartYRef.current = e.clientY;
    if (target.startsWith('def')) {
      resizeStartWidthRef.current = defSize.width;
      // If no explicit height yet, measure the current rendered element height
      if (defSize.height) {
        resizeStartHeightRef.current = defSize.height;
      } else {
        const el = (e.currentTarget as HTMLElement).closest('.def-window');
        resizeStartHeightRef.current = el ? el.getBoundingClientRect().height : 350;
      }
    } else if (target.startsWith('mini')) {
      resizeStartWidthRef.current = miniDefSize.width;
      resizeStartHeightRef.current = 0;
    }
  }, [isMobile, defSize.width, defSize.height, miniDefSize.width]);

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
        const deltaY = e.clientY - resizeStartYRef.current;
        const target = resizeTargetRef.current;
        const isLeft = target.includes('left');
        const isBottom = target.includes('bottom');
        const isCorner = target.includes('corner');

        // Horizontal resize
        if (!isBottom || isCorner) {
          const newWidth = isLeft
            ? resizeStartWidthRef.current - deltaX
            : resizeStartWidthRef.current + deltaX;
          const clampedWidth = Math.max(200, Math.min(600, newWidth));

          if (target.startsWith('def')) {
            setDefSize(prev => ({ ...prev, width: clampedWidth }));
            if (isLeft && defPos) {
              const widthDelta = defSize.width - clampedWidth;
              setDefPos(prev =>
                prev ? { ...prev, left: (typeof prev.left === 'number' ? prev.left : 0) + widthDelta } : null
              );
            }
          } else if (target.startsWith('mini')) {
            setMiniDefSize({ width: clampedWidth });
            if (isLeft && miniDefPosition) {
              const widthDelta = miniDefSize.width - clampedWidth;
              setMiniDefPosition(prev =>
                prev ? { ...prev, left: (typeof prev.left === 'number' ? prev.left : 0) + widthDelta } : null
              );
            }
          }
        }

        // Vertical resize (bottom or corner)
        if (isBottom || isCorner) {
          if (target.startsWith('def')) {
            const newHeight = resizeStartHeightRef.current + deltaY;
            const clampedHeight = Math.max(200, Math.min(window.innerHeight * 0.85, newHeight));
            setDefSize(prev => ({ ...prev, height: clampedHeight }));
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
  }, [defSize.width, defSize.height, miniDefSize.width, defPos, miniDefPosition]);

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
