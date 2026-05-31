import type { CSSProperties } from 'react';

export const PIP_MAX_WIDTH = 240;
export const PIP_MAX_HEIGHT = 320;
export const PIP_MIN_WIDTH = 120;
export const PIP_MIN_HEIGHT = 68;
/** Default 16:9 PiP size — kept for callers that expect fixed dimensions. */
export const PIP_WIDTH = PIP_MAX_WIDTH;
export const PIP_HEIGHT = Math.round(PIP_MAX_WIDTH / (16 / 9));
export const PIP_MARGIN = 16;

export type PipSize = { width: number; height: number };

export function resolvePipSize(
  videoWidth?: number,
  videoHeight?: number,
): PipSize {
  const w = videoWidth && videoWidth > 0 ? videoWidth : 16;
  const h = videoHeight && videoHeight > 0 ? videoHeight : 9;
  const ratio = w / h;

  let width: number;
  let height: number;

  if (ratio >= 1) {
    width = PIP_MAX_WIDTH;
    height = Math.round(width / ratio);
    if (height > PIP_MAX_HEIGHT) {
      height = PIP_MAX_HEIGHT;
      width = Math.round(height * ratio);
    }
  } else {
    height = PIP_MAX_HEIGHT;
    width = Math.round(height * ratio);
    if (width > PIP_MAX_WIDTH) {
      width = PIP_MAX_WIDTH;
      height = Math.round(width / ratio);
    }
  }

  return {
    width: Math.max(width, PIP_MIN_WIDTH),
    height: Math.max(height, PIP_MIN_HEIGHT),
  };
}
export const PIP_ANIM_MS = 350;
export const PIP_TRANSITION =
  'left 0.35s ease, top 0.35s ease, width 0.35s ease, height 0.35s ease, border-radius 0.35s ease, box-shadow 0.35s ease';

export type PipCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export function clampPip(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function pickCorner(centerX: number, centerY: number): PipCorner {
  const isLeft = centerX < window.innerWidth / 2;
  const isTop = centerY < window.innerHeight / 2;

  if (isTop && isLeft) return 'top-left';
  if (isTop && !isLeft) return 'top-right';
  if (!isTop && isLeft) return 'bottom-left';
  return 'bottom-right';
}

export function cornerPosition(
  corner: PipCorner,
  size: PipSize = resolvePipSize(),
): { left: number; top: number } {
  const maxLeft = window.innerWidth - size.width - PIP_MARGIN;
  const maxTop = window.innerHeight - size.height - PIP_MARGIN;

  switch (corner) {
    case 'top-left':
      return { left: PIP_MARGIN, top: PIP_MARGIN };
    case 'top-right':
      return { left: maxLeft, top: PIP_MARGIN };
    case 'bottom-left':
      return { left: PIP_MARGIN, top: maxTop };
    default:
      return { left: maxLeft, top: maxTop };
  }
}

export function defaultPipPosition(
  size: PipSize = resolvePipSize(),
): { left: number; top: number } {
  return cornerPosition('bottom-right', size);
}

/** Enough of the video tile visible in the scroll area → inline, no PiP. */
export const INLINE_VISIBLE_RATIO = 0.35;
/** Mostly scrolled away → PiP. Values between are hysteresis (no toggle). */
export const INLINE_HIDDEN_RATIO = 0.12;

export type InlineVisibilityDecision = 'inline' | 'pip' | 'unchanged';

export function getVisibleAreaRatio(
  element: HTMLElement,
  root: Element | null,
): number {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return 0;

  const bounds = root
    ? root.getBoundingClientRect()
    : {
        top: 0,
        left: 0,
        bottom: window.innerHeight,
        right: window.innerWidth,
      };

  const visH =
    Math.min(rect.bottom, bounds.bottom) - Math.max(rect.top, bounds.top);
  const visW =
    Math.min(rect.right, bounds.right) - Math.max(rect.left, bounds.left);

  if (visH <= 0 || visW <= 0) return 0;
  return (visH * visW) / (rect.width * rect.height);
}

export function resolveInlineVisibility(
  ratio: number,
  isIntersecting: boolean,
): InlineVisibilityDecision {
  if (!isIntersecting || ratio <= 0) return 'pip';
  if (ratio >= INLINE_VISIBLE_RATIO) return 'inline';
  if (ratio < INLINE_HIDDEN_RATIO) return 'pip';
  return 'unchanged';
}

export function getScrollRoot(element: HTMLElement | null): Element | null {
  if (!element) return null;

  let parent = element.parentElement;
  while (parent) {
    const { overflowY, overflow } = getComputedStyle(parent);
    if (
      overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'overlay' ||
      overflow === 'auto' ||
      overflow === 'scroll'
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }

  return null;
}

export function floatStyleFromRect(
  rect: DOMRect,
  opts?: {
    transition?: string;
    borderRadius?: number | string;
    boxShadow?: string;
    cursor?: string;
  },
): CSSProperties {
  return {
    position: 'fixed',
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    zIndex: 1200,
    borderRadius: opts?.borderRadius ?? 0,
    overflow: 'hidden',
    transition: opts?.transition ?? 'none',
    boxShadow: opts?.boxShadow ?? 'none',
    cursor: opts?.cursor,
    touchAction: 'none',
  };
}

export function pipFloatStyle(
  position: { left: number; top: number },
  opts?: {
    transition?: string;
    animate?: boolean;
    dragging?: boolean;
    size?: PipSize;
  },
): CSSProperties {
  const size = opts?.size ?? resolvePipSize();
  return {
    position: 'fixed',
    left: position.left,
    top: position.top,
    width: size.width,
    height: size.height,
    zIndex: 1200,
    borderRadius: 10,
    overflow: 'hidden',
    transition:
      opts?.dragging || opts?.animate === false
        ? 'none'
        : (opts?.transition ?? PIP_TRANSITION),
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
    cursor: opts?.dragging ? 'grabbing' : 'grab',
    touchAction: 'none',
  };
}
