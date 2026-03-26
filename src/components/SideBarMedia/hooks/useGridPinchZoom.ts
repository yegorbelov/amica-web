import { useState, useEffect, useRef } from 'react';

const MIN_COLUMNS = 1;
const MAX_COLUMNS = 20;

/** Minimum pinch span (px) to avoid unstable ratios at finger overlap */
const MIN_PINCH_SPAN = 24;

function pointerDistance(p1: PointerEvent, p2: PointerEvent): number {
  return Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
}

export function useGridPinchZoom(
  gridRef: React.RefObject<HTMLDivElement | null>,
  sidebarInnerRef: React.RefObject<HTMLDivElement | null>,
) {
  const [rowScale, setRowScale] = useState(3);
  /** Mirrors column count for listeners; updated synchronously when columns change. */
  const rowScaleRef = useRef(rowScale);

  useEffect(() => {
    rowScaleRef.current = rowScale;
  }, [rowScale]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const pointers = new Map<number, PointerEvent>();
    let initialPinchSpan = MIN_PINCH_SPAN;
    let initialColumns = rowScaleRef.current;

    const applyScrollAnchor = (
      container: HTMLElement,
      containerRect: DOMRect,
      clientX: number,
      prevColumns: number,
      nextColumns: number,
    ) => {
      const cursorXInContainerBefore =
        clientX - containerRect.left + container.scrollLeft;
      requestAnimationFrame(() => {
        const ratio = nextColumns / prevColumns;
        const cursorXInContainerAfter = cursorXInContainerBefore * ratio;
        container.scrollLeft =
          cursorXInContainerAfter - (clientX - containerRect.left);
      });
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, e);
      if (pointers.size === 2) {
        e.preventDefault();
        initialColumns = rowScaleRef.current;
        const [p1, p2] = Array.from(pointers.values());
        initialPinchSpan = Math.max(
          pointerDistance(p1, p2),
          MIN_PINCH_SPAN,
        );
        for (const id of pointers.keys()) {
          try {
            grid.setPointerCapture(id);
          } catch {
            /* ignore */
          }
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (pointers.size !== 2 || !pointers.has(e.pointerId)) return;
      e.preventDefault();
      pointers.set(e.pointerId, e);

      const [p1, p2] = Array.from(pointers.values());
      const span = pointerDistance(p1, p2);
      if (span < 8) return;

      const prevColumns = rowScaleRef.current;
      const ratio = span / initialPinchSpan;
      let nextFloat = initialColumns * ratio;
      nextFloat = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, nextFloat));
      const nextColumns = Math.round(nextFloat);
      if (nextColumns === prevColumns) return;

      const container = gridRef.current!;
      const containerRect = container.getBoundingClientRect();

      rowScaleRef.current = nextColumns;
      setRowScale(nextColumns);
      applyScrollAnchor(container, containerRect, e.clientX, prevColumns, nextColumns);
    };

    const handlePointerUp = (e: PointerEvent) => {
      try {
        grid.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      pointers.delete(e.pointerId);
    };

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) < 1) return;

      const container = sidebarInnerRef.current!;
      const containerRect = container.getBoundingClientRect();
      const prevColumns = rowScaleRef.current;
      const deltaColumns = e.deltaY / 10;
      let newColumns = Math.round(prevColumns + deltaColumns);
      newColumns = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, newColumns));
      if (newColumns === prevColumns) return;

      rowScaleRef.current = newColumns;
      setRowScale(newColumns);
      applyScrollAnchor(container, containerRect, e.clientX, prevColumns, newColumns);
    };

    const handleWheelEnd = () => {
      initialColumns = rowScaleRef.current;
    };

    const pointerOpts: AddEventListenerOptions = { passive: false };

    grid.addEventListener('pointerdown', handlePointerDown, pointerOpts);
    grid.addEventListener('pointermove', handlePointerMove, pointerOpts);
    grid.addEventListener('pointerup', handlePointerUp, pointerOpts);
    grid.addEventListener('pointercancel', handlePointerUp, pointerOpts);
    grid.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keyup', handleWheelEnd);
    window.addEventListener('mouseup', handleWheelEnd);

    return () => {
      grid.removeEventListener('pointerdown', handlePointerDown, pointerOpts);
      grid.removeEventListener('pointermove', handlePointerMove, pointerOpts);
      grid.removeEventListener('pointerup', handlePointerUp, pointerOpts);
      grid.removeEventListener('pointercancel', handlePointerUp, pointerOpts);
      grid.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keyup', handleWheelEnd);
      window.removeEventListener('mouseup', handleWheelEnd);
    };
  }, [gridRef, sidebarInnerRef]);

  return rowScale;
}
