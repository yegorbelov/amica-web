import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  startTransition,
} from 'react';

const SNAP_TOUCH_THRESHOLD = 30;

function readSnapIndex(viewport: HTMLDivElement) {
  const pageWidth = viewport.clientWidth;
  if (!pageWidth) return 0;
  return Math.round(viewport.scrollLeft / pageWidth);
}

export function useAvatarRoller(
  chatId: string,
  mediaCount: number,
  hasPrimaryMedia: boolean,
  sidebarRef: React.RefObject<HTMLDivElement | null>,
  interlocutorEditVisible: boolean,
  enableScrollGestures = true,
  wheelTargetRef?: React.RefObject<HTMLElement | null>,
  wheelTargetKey = 0,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [rollPosition, setRollPosition] = useState(0);
  const rollerScrollRef = useRef<HTMLDivElement | null>(null);

  const isOpenRef = useRef(isOpen);
  const rollPositionRef = useRef(rollPosition);
  const mediaCountRef = useRef(mediaCount);
  const animatedScrollTargetRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    isOpenRef.current = isOpen;
    rollPositionRef.current = rollPosition;
    mediaCountRef.current = mediaCount;
  });

  const setOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      if (!chatId) return;
      setIsOpen((prev) => (typeof value === 'function' ? value(prev) : value));
    },
    [chatId],
  );

  const setPosition = useCallback(
    (value: number | ((prev: number) => number)) => {
      if (!chatId) return;
      setRollPosition((prev) =>
        typeof value === 'function' ? value(prev) : value,
      );
    },
    [chatId],
  );

  // Programmatic scroll — tap uses smooth adjacent steps; open/reset stays instant.
  const scrollToIndex = useCallback(
    (index: number, animated = false) => {
      const viewport = rollerScrollRef.current;
      if (!viewport) return;

      const go = () => {
        const pageWidth = viewport.clientWidth;
        if (!pageWidth) return;

        const clamped = Math.max(0, Math.min(index, mediaCountRef.current));
        const from = rollPositionRef.current;
        const targetLeft = clamped * pageWidth;
        const isAdjacent = Math.abs(clamped - from) === 1;
        const shouldAnimate = animated && isAdjacent;

        rollPositionRef.current = clamped;
        setPosition(clamped);

        if (Math.abs(viewport.scrollLeft - targetLeft) < 1) {
          animatedScrollTargetRef.current = null;
          return;
        }

        if (shouldAnimate) {
          animatedScrollTargetRef.current = clamped;
          viewport.scrollTo({ left: targetLeft, behavior: 'smooth' });
          return;
        }

        animatedScrollTargetRef.current = null;
        viewport.scrollLeft = targetLeft;
      };

      if (viewport.clientWidth < 1) {
        requestAnimationFrame(go);
        return;
      }
      go();
    },
    [setPosition],
  );

  // Sync dot index after native scroll (touch + CSS snap, or scrollend after wheel).
  const syncIndexFromScroll = useCallback(() => {
    const viewport = rollerScrollRef.current;
    if (!viewport || !isOpenRef.current) return;
    requestAnimationFrame(() => {
      if (!viewport || !isOpenRef.current) return;
      animatedScrollTargetRef.current = null;
      const next = readSnapIndex(viewport);
      if (next !== rollPositionRef.current) {
        rollPositionRef.current = next;
        setPosition(next);
      }
    });
  }, [setPosition]);

  // Reset on chat change.
  useEffect(() => {
    if (!chatId) return;
    startTransition(() => {
      setIsOpen(false);
      setRollPosition(0);
    });
  }, [chatId]);

  // Reset scroll when roller closes.
  useEffect(() => {
    if (isOpen) return;
    animatedScrollTargetRef.current = null;
    const viewport = rollerScrollRef.current;
    if (viewport) viewport.scrollLeft = 0;
  }, [isOpen]);

  // Sync scroll when rollPosition changes externally (e.g. "set as primary").
  useEffect(() => {
    if (!isOpen || interlocutorEditVisible) return;
    if (animatedScrollTargetRef.current === rollPosition) return;
    const viewport = rollerScrollRef.current;
    if (!viewport) return;
    const targetLeft = rollPosition * viewport.clientWidth;
    if (Math.abs(viewport.scrollLeft - targetLeft) > 2) {
      viewport.scrollLeft = targetLeft;
    }
  }, [rollPosition, isOpen, interlocutorEditVisible]);

  const handleRollPositionChange = useCallback(
    (clickX?: number, containerWidth?: number) => {
      if (interlocutorEditVisible || !isOpen || !mediaCount) return;

      const position = rollPositionRef.current;
      const maxIndex = mediaCount;
      const goForward =
        clickX == null ||
        containerWidth == null ||
        containerWidth <= 0 ||
        clickX >= containerWidth / 2;
      const next = goForward
        ? Math.min(position + 1, maxIndex)
        : Math.max(position - 1, 0);

      if (next === position) return;

      scrollToIndex(next, true);
    },
    [interlocutorEditVisible, isOpen, mediaCount, scrollToIndex],
  );

  // Sync dots after native touch/wheel scroll settles.
  useEffect(() => {
    const viewport = rollerScrollRef.current;
    if (!viewport || !isOpen) return;

    viewport.addEventListener('scrollend', syncIndexFromScroll, {
      passive: true,
    });
    viewport.addEventListener('touchend', syncIndexFromScroll, {
      passive: true,
    });

    return () => {
      viewport.removeEventListener('scrollend', syncIndexFromScroll);
      viewport.removeEventListener('touchend', syncIndexFromScroll);
    };
  }, [syncIndexFromScroll, wheelTargetKey, isOpen]);

  // Sidebar gesture handling: open roller, block vertical scroll when roller is open.
  useEffect(() => {
    if (!enableScrollGestures) return;
    const sidebar =
      (wheelTargetRef && wheelTargetRef.current) || sidebarRef.current;
    if (!sidebar || interlocutorEditVisible || !hasPrimaryMedia) return;

    let touchStartY = 0;
    let isTrackingTouch = false;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;

      if (e.deltaY > 0 && isOpenRef.current) {
        setOpen(false);
        setPosition(0);
      }
      if (e.deltaY < 0 && sidebar.scrollTop === 0 && !isOpenRef.current) {
        setOpen(true);
        scrollToIndex(0);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      isTrackingTouch = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTrackingTouch) return;
      const deltaY = touchStartY - e.touches[0].clientY;

      if (deltaY > SNAP_TOUCH_THRESHOLD && isOpenRef.current) {
        setOpen(false);
        setPosition(0);
        isTrackingTouch = false;
      }
      if (
        deltaY < -SNAP_TOUCH_THRESHOLD &&
        sidebar.scrollTop === 0 &&
        !isOpenRef.current
      ) {
        setOpen(true);
        scrollToIndex(0);
        isTrackingTouch = false;
      }
    };

    const handleTouchEnd = () => {
      isTrackingTouch = false;
    };

    sidebar.addEventListener('wheel', handleWheel, { passive: true });
    sidebar.addEventListener('touchstart', handleTouchStart, { passive: true });
    sidebar.addEventListener('touchmove', handleTouchMove, { passive: true });
    sidebar.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      sidebar.removeEventListener('wheel', handleWheel);
      sidebar.removeEventListener('touchstart', handleTouchStart);
      sidebar.removeEventListener('touchmove', handleTouchMove);
      sidebar.removeEventListener('touchend', handleTouchEnd);
    };
  }, [
    enableScrollGestures,
    scrollToIndex,
    setOpen,
    setPosition,
    sidebarRef,
    wheelTargetRef,
    wheelTargetKey,
    hasPrimaryMedia,
    interlocutorEditVisible,
  ]);

  const effectiveRollPosition = interlocutorEditVisible ? 0 : rollPosition;

  return {
    isAvatarRollerOpen: isOpen,
    setIsAvatarRollerOpen: setOpen,
    rollPosition,
    setRollPosition: setPosition,
    effectiveRollPosition,
    handleRollPositionChange,
    rollerScrollRef,
  };
}
