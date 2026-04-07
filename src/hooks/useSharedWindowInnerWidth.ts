import { useSyncExternalStore } from 'react';

function readWidth(): number {
  return typeof window !== 'undefined' ? window.innerWidth : 1024;
}

let width = readWidth();
const listeners = new Set<() => void>();
let attached = false;

function onResize() {
  const next = readWidth();
  if (next === width) return;
  width = next;
  listeners.forEach((l) => l());
}

function ensureListener() {
  if (typeof window === 'undefined' || attached) return;
  attached = true;
  window.addEventListener('resize', onResize);
}

function subscribe(onStoreChange: () => void) {
  ensureListener();
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/**
 * Same values as per-instance `useState(window.innerWidth)` + `resize`, but one
 * `window` listener shared by all subscribers.
 */
export function useSharedWindowInnerWidth(): number {
  return useSyncExternalStore(subscribe, () => width, () => readWidth());
}
