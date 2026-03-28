import { useEffect, useMemo, useRef, useState } from 'react';

const MIN_COLUMNS = 1;
/** Fewer than this many media cells → column cap `MAX_COLUMNS_SMALL_GRID`. */
const GRID_COLUMN_ITEM_THRESHOLD = 20;
/** At/above threshold → column cap `MAX_COLUMNS_LARGE_GRID`. */
const MAX_COLUMNS_SMALL_GRID = 5;
const MAX_COLUMNS_LARGE_GRID = 12;

const COMMIT_THRESHOLD = 0.5;

function maxColumnsForItemCount(itemCount: number): number {
  return Math.floor(itemCount) < GRID_COLUMN_ITEM_THRESHOLD
    ? MAX_COLUMNS_SMALL_GRID
    : MAX_COLUMNS_LARGE_GRID;
}

function pointerDistance(p1: PointerEvent, p2: PointerEvent): number {
  return Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
}

function normalizeWheelDelta(deltaY: number, deltaMode: number): number {
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) return deltaY * 14;
  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) return deltaY * 140;
  return deltaY;
}

function calcLayerScale(
  baseColumns: number,
  adjacentColumns: number,
  progress: number,
) {
  if (adjacentColumns === baseColumns) return 1;
  const targetScale = baseColumns / adjacentColumns;
  return 1 + (targetScale - 1) * progress;
}

interface GridPinchZoomState {
  currentColumns: number;
  liveScale: number;
  /** transform-origin in px relative to the scaled element (MediaGrid root). */
  zoomOriginX: number | null;
  zoomOriginY: number | null;
  isZooming: boolean;
}

export function useGridPinchZoom(
  gridRef: React.RefObject<HTMLDivElement | null>,
  sidebarInnerRef: React.RefObject<HTMLDivElement | null>,
  /** When this changes, listeners re-bind (e.g. grid mounts after chat/tab). */
  gridAttachKey: string,
  /** Element that receives scale(); origin is computed in its coordinate space. */
  originTargetRef: React.RefObject<HTMLDivElement | null>,
  /** Visible media cells count (filters pinch sensitivity when the grid is small). */
  mediaItemCount: number,
): GridPinchZoomState {
  const [rowScale, setRowScale] = useState(3);
  const [liveScale, setLiveScale] = useState(1);
  const [zoomOriginX, setZoomOriginX] = useState<number | null>(null);
  const [zoomOriginY, setZoomOriginY] = useState<number | null>(null);
  const [isZooming, setIsZooming] = useState(false);
  /** Mirrors column count for listeners; updated synchronously when columns change. */
  const rowScaleRef = useRef(rowScale);

  useEffect(() => {
    rowScaleRef.current = rowScale;
  }, [rowScale]);

  /** Keep column count within bounds when item count / max columns changes. */
  useEffect(() => {
    const maxColumns = maxColumnsForItemCount(mediaItemCount);
    setRowScale((prev) => {
      const next = Math.max(MIN_COLUMNS, Math.min(maxColumns, prev));
      rowScaleRef.current = next;
      return next;
    });
  }, [mediaItemCount]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const maxColumns = maxColumnsForItemCount(mediaItemCount);
    const clampColumns = (value: number) =>
      Math.max(MIN_COLUMNS, Math.min(maxColumns, value));

    const minPinchSpan = maxColumns;
    /** Ignore jitter when fingers are very close; align with `minPinchSpan` on small grids. */
    const pinchMoveSpanFloor = Math.min(8, minPinchSpan);

    const pointers = new Map<number, PointerEvent>();
    let initialPinchSpan = minPinchSpan;
    let initialColumns = rowScaleRef.current;
    /** Touch pinch: spread → fewer columns (bigger cells); pinch in → more columns. */
    let touchPinchInverted = false;

    let wheelEndTimer: ReturnType<typeof setTimeout> | null = null;
    const wheelFloatRef = { current: rowScaleRef.current };

    let pinchScrollLocked = false;
    let savedGridTouchAction = '';
    let savedSidebarOverflow = '';

    const preventTouchMoveWhilePinching = (e: TouchEvent) => {
      e.preventDefault();
    };
    const touchMoveOpts: AddEventListenerOptions = {
      passive: false,
      capture: true,
    };

    const lockPinchScroll = () => {
      if (pinchScrollLocked) return;
      pinchScrollLocked = true;
      savedGridTouchAction = grid.style.touchAction;
      grid.style.touchAction = 'none';
      const sidebar = sidebarInnerRef.current;
      if (sidebar) {
        savedSidebarOverflow = sidebar.style.overflow;
        sidebar.style.overflow = 'hidden';
      }
      window.addEventListener(
        'touchmove',
        preventTouchMoveWhilePinching,
        touchMoveOpts,
      );
    };

    const unlockPinchScroll = () => {
      if (!pinchScrollLocked) return;
      pinchScrollLocked = false;
      grid.style.touchAction = savedGridTouchAction;
      const sidebar = sidebarInnerRef.current;
      if (sidebar) {
        sidebar.style.overflow = savedSidebarOverflow;
      }
      window.removeEventListener(
        'touchmove',
        preventTouchMoveWhilePinching,
        touchMoveOpts,
      );
    };

    const resetZoomVisualState = () => {
      setIsZooming(false);
      setZoomOriginX(null);
      setZoomOriginY(null);
      setLiveScale(1);
    };

    const updateZoomFocus = (clientX: number, clientY: number) => {
      const originEl = originTargetRef.current ?? grid;
      const rect = originEl.getBoundingClientRect();
      setZoomOriginX(Math.max(0, clientX - rect.left));
      setZoomOriginY(Math.max(0, clientY - rect.top));
    };

    const isInsideGrid = (x: number, y: number) => {
      const rect = grid.getBoundingClientRect();
      return (
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      );
    };

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

    const commitColumns = (
      nextColumns: number,
      clientX: number,
      container: HTMLElement,
    ) => {
      const prevColumns = rowScaleRef.current;
      if (nextColumns === prevColumns) return;
      const containerRect = container.getBoundingClientRect();
      rowScaleRef.current = nextColumns;
      setRowScale(nextColumns);
      applyScrollAnchor(
        container,
        containerRect,
        clientX,
        prevColumns,
        nextColumns,
      );
      wheelFloatRef.current = nextColumns;
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, e);
      if (pointers.size === 2) {
        e.preventDefault();
        initialColumns = rowScaleRef.current;
        const [p1, p2] = Array.from(pointers.values());
        touchPinchInverted =
          p1.pointerType === 'touch' && p2.pointerType === 'touch';
        initialPinchSpan = Math.max(pointerDistance(p1, p2), minPinchSpan);
        const centerX = (p1.clientX + p2.clientX) / 2;
        const centerY = (p1.clientY + p2.clientY) / 2;
        setIsZooming(true);
        updateZoomFocus(centerX, centerY);
        setLiveScale(1);
        lockPinchScroll();
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
      if (span < pinchMoveSpanFloor) return;

      const prevColumns = rowScaleRef.current;
      const ratio = span / initialPinchSpan;
      let nextFloat = touchPinchInverted
        ? initialColumns / ratio
        : initialColumns * ratio;
      nextFloat = clampColumns(nextFloat);
      const centerX = (p1.clientX + p2.clientX) / 2;
      const centerY = (p1.clientY + p2.clientY) / 2;
      setIsZooming(true);
      updateZoomFocus(centerX, centerY);

      const delta = nextFloat - prevColumns;
      const direction = delta > 0 ? 1 : delta < 0 ? -1 : 0;
      const adjacentColumns = clampColumns(prevColumns + direction);
      const progress = Math.max(0, Math.min(1, Math.abs(delta)));
      setLiveScale(calcLayerScale(prevColumns, adjacentColumns, progress));

      const roundedColumns = clampColumns(Math.round(nextFloat));
      if (roundedColumns === prevColumns) return;
      const shouldCommit =
        Math.abs(nextFloat - prevColumns) >= COMMIT_THRESHOLD &&
        roundedColumns !== prevColumns;
      if (!shouldCommit) return;

      const container = gridRef.current;
      if (!container) return;
      commitColumns(roundedColumns, centerX, container);

      initialColumns = roundedColumns;
      initialPinchSpan = Math.max(span, minPinchSpan);
      wheelFloatRef.current = roundedColumns;
      setLiveScale(1);
    };

    const handlePointerUp = (e: PointerEvent) => {
      try {
        grid.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      pointers.delete(e.pointerId);
      if (pointers.size < 2) {
        unlockPinchScroll();
        resetZoomVisualState();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const effectiveDeltaY = normalizeWheelDelta(e.deltaY, e.deltaMode);
      if (Math.abs(effectiveDeltaY) < 0.5) return;

      const container = gridRef.current ?? sidebarInnerRef.current;
      if (!container) return;
      const prevColumns = rowScaleRef.current;
      const deltaColumns = effectiveDeltaY / 80;
      wheelFloatRef.current = clampColumns(
        wheelFloatRef.current + deltaColumns,
      );
      const nextFloat = wheelFloatRef.current;
      const direction =
        nextFloat > prevColumns ? 1 : nextFloat < prevColumns ? -1 : 0;
      const adjacentColumns = clampColumns(prevColumns + direction);
      const progress = Math.max(
        0,
        Math.min(1, Math.abs(nextFloat - prevColumns)),
      );
      setIsZooming(true);
      updateZoomFocus(e.clientX, e.clientY);
      setLiveScale(calcLayerScale(prevColumns, adjacentColumns, progress));

      const nextColumns = clampColumns(Math.round(nextFloat));
      const shouldCommit =
        Math.abs(nextFloat - prevColumns) >= COMMIT_THRESHOLD &&
        nextColumns !== prevColumns;
      if (shouldCommit) {
        commitColumns(nextColumns, e.clientX, container);
      }

      if (wheelEndTimer) {
        clearTimeout(wheelEndTimer);
      }
      wheelEndTimer = setTimeout(() => {
        resetZoomVisualState();
      }, 180);
    };

    const handleWheelCapture = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      if (!isInsideGrid(e.clientX, e.clientY)) return;
      e.preventDefault();
    };

    const pointerOpts: AddEventListenerOptions = { passive: false };

    grid.addEventListener('pointerdown', handlePointerDown, pointerOpts);
    grid.addEventListener('pointermove', handlePointerMove, pointerOpts);
    grid.addEventListener('pointerup', handlePointerUp, pointerOpts);
    grid.addEventListener('pointercancel', handlePointerUp, pointerOpts);
    grid.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('wheel', handleWheelCapture, {
      passive: false,
      capture: true,
    });

    return () => {
      unlockPinchScroll();
      if (wheelEndTimer) {
        clearTimeout(wheelEndTimer);
      }
      grid.removeEventListener('pointerdown', handlePointerDown, pointerOpts);
      grid.removeEventListener('pointermove', handlePointerMove, pointerOpts);
      grid.removeEventListener('pointerup', handlePointerUp, pointerOpts);
      grid.removeEventListener('pointercancel', handlePointerUp, pointerOpts);
      grid.removeEventListener('wheel', handleWheel);
      window.removeEventListener('wheel', handleWheelCapture, true);
    };
  }, [
    gridRef,
    sidebarInnerRef,
    gridAttachKey,
    originTargetRef,
    mediaItemCount,
  ]);

  return useMemo(
    () => ({
      currentColumns: rowScale,
      liveScale,
      zoomOriginX,
      zoomOriginY,
      isZooming,
    }),
    [rowScale, liveScale, zoomOriginX, zoomOriginY, isZooming],
  );
}
