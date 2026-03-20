import { useTabs } from './tabsShared';
import { useUser } from '@/contexts/UserContextCore';
import { Icon } from '@/components/Icons/AutoIcons';
import Avatar from '@/components/Avatar/Avatar';
import styles from './Tabs.module.scss';
import { useTranslation } from '@/contexts/languageCore';
import { useSettings } from '@/contexts/settings/context';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useChatMeta } from '@/contexts/ChatContextCore';
import Button from '../ui/button/Button';
import { ContactsLottieIcon, ChatsLottieIcon } from './TabsLottieIcons';

const NEW_WALLPAPER_HEIGHT = '50px';

const wallpaperIcon = (
  <Icon name='Wallpaper' className={styles['new-wallpaper__icon']} />
);

type TabValue = 'contacts' | 'chats' | 'profile';

type TabConfig = {
  id: TabValue;
  label: string;
  icon?: (isActive: boolean) => React.ReactNode;
  avatar?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function getDevicePixelRatio() {
  if (typeof window === 'undefined' || !window.devicePixelRatio) return 1;
  return Math.max(1, window.devicePixelRatio);
}

function snapToDevicePixel(
  value: number,
  mode: 'round' | 'floor' | 'ceil' = 'round',
) {
  const dpr = getDevicePixelRatio();
  const scaled = value * dpr;
  if (mode === 'floor') return Math.floor(scaled) / dpr;
  if (mode === 'ceil') return Math.ceil(scaled) / dpr;
  return Math.round(scaled) / dpr;
}

export function Tabs() {
  const { activeTab, setActiveTab } = useTabs();
  const { user } = useUser();
  const { t } = useTranslation();
  const { activeProfileTab, addUserWallpaper } = useSettings();
  const { chats } = useChatMeta();
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const mainNavRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [isDraggingIndicator, setIsDraggingIndicator] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const [isArmedMove, setIsArmedMove] = useState(false);
  const [indicatorSettledTab, setIndicatorSettledTab] =
    useState<TabValue | null>(activeTab);
  const isDraggingRef = useRef(false);
  const snappingResetTimerRef = useRef<number | null>(null);
  const settleFallbackTimerRef = useRef<number | null>(null);
  const pendingSettledTabRef = useRef<TabValue>(activeTab);
  const indicatorPointerIdRef = useRef<number | null>(null);
  const indicatorStartXRef = useRef(0);
  const pointerStartXRef = useRef(0);
  const tabbarArmedPointerIdRef = useRef<number | null>(null);
  const tabbarArmedStartXRef = useRef(0);
  const tabbarArmedTabIdRef = useRef<TabValue | null>(null);
  const tabbarArmedWillAnimateRef = useRef(false);
  const tabbarArmedTransitionPendingRef = useRef(false);
  const tabbarPressedRef = useRef(false);
  const [indicatorX, setIndicatorX] = useState(0);
  const indicatorXRef = useRef(0);
  const [visualIndicatorX, setVisualIndicatorX] = useState(0);
  const rafRef = useRef<number | null>(null);
  const [disableIndicatorTransition, setDisableIndicatorTransition] =
    useState(true);
  const indicatorInitializedRef = useRef(false);
  const isSnappingRef = useRef(false);

  const [tabLayout, setTabLayout] = useState<
    Partial<Record<TabValue, { left: number; width: number }>>
  >({});
  const [indicatorSize, setIndicatorSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  const tabOrder = useMemo<TabValue[]>(
    () => ['contacts', 'chats', 'profile'],
    [],
  );

  const unreadChatsCount = useMemo(
    () => chats.reduce((acc, chat) => acc + (chat.unread_count > 0 ? 1 : 0), 0),
    [chats],
  );

  const showNewWallpaper =
    activeProfileTab === 'appearance' && activeTab === 'profile';

  useEffect(() => {
    indicatorXRef.current = indicatorX;
  }, [indicatorX]);

  useEffect(() => {
    isSnappingRef.current = isSnapping;
  }, [isSnapping]);

  useEffect(() => {
    // When we're not snapping or armed, the visual position equals state.
    if (!isSnapping && !isArmedMove) setVisualIndicatorX(indicatorX);
  }, [indicatorX, isSnapping, isArmedMove]);

  useEffect(() => {
    // While snapping or armed, `indicatorX` is the target. Track the current
    // visual position from DOM so the mask follows the moving indicator.
    if (!isSnapping && !isArmedMove) return;

    const container = mainNavRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator) return;

    const tick = () => {
      const c = container.getBoundingClientRect();
      const r = indicator.getBoundingClientRect();
      const currentCenterX = r.left + r.width / 2 - c.left;
      setVisualIndicatorX(currentCenterX);
      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isSnapping, isArmedMove]);

  useEffect(() => {
    // Disable initial "jump" animation on first load.
    setDisableIndicatorTransition(false);
    return () => {
      if (snappingResetTimerRef.current !== null) {
        window.clearTimeout(snappingResetTimerRef.current);
      }
      if (settleFallbackTimerRef.current !== null) {
        window.clearTimeout(settleFallbackTimerRef.current);
      }
    };
  }, []);

  const stopSnapping = () => {
    setIsSnapping(false);
    if (snappingResetTimerRef.current !== null) {
      window.clearTimeout(snappingResetTimerRef.current);
      snappingResetTimerRef.current = null;
    }
    if (settleFallbackTimerRef.current !== null) {
      window.clearTimeout(settleFallbackTimerRef.current);
      settleFallbackTimerRef.current = null;
    }
  };

  const scheduleSettleFallback = () => {
    if (settleFallbackTimerRef.current !== null) {
      window.clearTimeout(settleFallbackTimerRef.current);
    }
    const indicator = indicatorRef.current;
    const durMs = indicator
      ? Number.parseFloat(
          window
            .getComputedStyle(indicator)
            .getPropertyValue('--transition-duration'),
        ) * 1000
      : NaN;
    const timeoutMs =
      Number.isFinite(durMs) && durMs > 0 ? Math.ceil(durMs + 80) : 420;
    settleFallbackTimerRef.current = window.setTimeout(() => {
      settleFallbackTimerRef.current = null;
      stopSnapping();
      setIndicatorSettledTab(pendingSettledTabRef.current);
    }, timeoutMs);
  };

  const measureTabLayout = () => {
    const container = mainNavRef.current;
    if (!container) return;

    const c = container.getBoundingClientRect();
    const next: Partial<Record<TabValue, { left: number; width: number }>> = {};

    for (const id of tabOrder) {
      const btn = tabButtonRefs.current[id];
      if (!btn) continue;
      const b = btn.getBoundingClientRect();
      next[id] = { left: b.left - c.left, width: b.width };
    }

    setTabLayout(next);

    const ind = indicatorRef.current;
    if (ind) {
      const r = ind.getBoundingClientRect();
      setIndicatorSize({ width: r.width, height: r.height });
    }
  };

  const clampIndicatorXToBounds = (rawX: number) => {
    const container = mainNavRef.current;
    if (!container) return rawX;

    const c = container.getBoundingClientRect();
    const indicatorW =
      indicatorSize.width ||
      indicatorRef.current?.getBoundingClientRect().width ||
      0;

    // `indicatorX` is the center position (since we translateX(-50%)).
    const min = indicatorW ? indicatorW / 2 : 0;
    const max = indicatorW ? c.width - indicatorW / 2 : c.width;
    return clamp(rawX, min, max);
  };

  const snapIndicatorToTab = (
    tabId: TabValue,
    opts?: { animated?: boolean },
  ) => {
    const container = mainNavRef.current;
    const btn = tabButtonRefs.current[tabId];
    if (!container || !btn) return;

    const c = container.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const centerX = b.left + b.width / 2;
    const x = clampIndicatorXToBounds(snapToDevicePixel(centerX - c.left));

    pendingSettledTabRef.current = tabId;

    if (opts?.animated) {
      // While animating to a new position, drop the settled state so the
      // `.tab-inner` background doesn't switch early.
      setIndicatorSettledTab(null);
      // Decide whether we *visually* move based on current DOM position,
      // not based on the last target `indicatorXRef`.
      const currentRect = indicatorRef.current?.getBoundingClientRect();
      const currentVisualX = currentRect
        ? currentRect.left + currentRect.width / 2 - c.left
        : indicatorXRef.current;
      const didMove = Math.abs(currentVisualX - x) >= 0.5;

      if (didMove) {
        if (snappingResetTimerRef.current !== null) {
          window.clearTimeout(snappingResetTimerRef.current);
        }
        setIsSnapping(true);
        scheduleSettleFallback();
      } else {
        // No visible movement: settle immediately.
        stopSnapping();
        setIndicatorSettledTab(tabId);
      }
    }

    setIndicatorX(x);
    indicatorXRef.current = x;

    // If we jump without animation (first paint / cancel), the indicator is settled immediately.
    if (!opts?.animated) {
      setIndicatorSettledTab(tabId);
    }
  };

  // Keep indicator aligned when activeTab changes (click/programmatic).
  useLayoutEffect(() => {
    if (isDraggingRef.current) return;
    const shouldAnimate = indicatorInitializedRef.current;
    if (shouldAnimate) setIndicatorSettledTab(null);
    snapIndicatorToTab(activeTab, { animated: shouldAnimate });
    indicatorInitializedRef.current = true;
    measureTabLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Also resnap on resize/layout changes.
  useEffect(() => {
    const onResize = () => {
      if (isDraggingRef.current) return;
      const shouldAnimate = indicatorInitializedRef.current;
      snapIndicatorToTab(activeTab, { animated: shouldAnimate });
      measureTabLayout();
    };
    window.addEventListener('resize', onResize);
    // Ensure layout vars exist on mount.
    onResize();
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--new-wallpaper-height',
      showNewWallpaper ? NEW_WALLPAPER_HEIGHT : '0px',
    );
    return () => {
      document.documentElement.style.setProperty(
        '--new-wallpaper-height',
        '0px',
      );
    };
  }, [showNewWallpaper]);

  const tabs: TabConfig[] = [
    {
      id: 'contacts',
      label: t('tabs.contacts'),
      icon: (isActive) => <ContactsLottieIcon isActive={isActive} />,
    },
    {
      id: 'chats',
      label: t('tabs.chats'),
      icon: (isActive) => <ChatsLottieIcon isActive={isActive} />,
    },
    { id: 'profile', label: t('tabs.profile'), avatar: true },
  ];

  const getNearestTabToX = (x: number): TabValue => {
    const container = mainNavRef.current;
    if (!container) return activeTab;
    const c = container.getBoundingClientRect();

    let best: { id: TabValue; dist: number } | null = null;
    for (const id of tabOrder) {
      const btn = tabButtonRefs.current[id];
      if (!btn) continue;
      const b = btn.getBoundingClientRect();
      const center = b.left + b.width / 2 - c.left;
      const dist = Math.abs(center - x);
      if (!best || dist < best.dist) best = { id, dist };
    }
    return best?.id ?? activeTab;
  };

  const onIndicatorPointerDown: React.PointerEventHandler<HTMLDivElement> = (
    e,
  ) => {
    const container = mainNavRef.current;
    if (!container) return;

    stopSnapping();

    // If the indicator was mid-transition, `indicatorX` is the target value,
    // but visually it's between. Snap our state to the *current* visual center
    // to avoid a jump when starting a drag.
    const c = container.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    const currentCenterX = r.left + r.width / 2 - c.left;
    const currentX = clampIndicatorXToBounds(currentCenterX);
    setIndicatorX(currentX);
    indicatorXRef.current = currentX;
    setVisualIndicatorX(currentX);

    isDraggingRef.current = true;
    setIsDraggingIndicator(true);
    setIndicatorSettledTab(null);
    indicatorPointerIdRef.current = e.pointerId;

    // Capture pointer so we continue to receive move/up events.
    e.currentTarget.setPointerCapture(e.pointerId);

    pointerStartXRef.current = e.clientX;
    indicatorStartXRef.current = currentX;
  };

  const onTabbarPointerDown: React.PointerEventHandler<HTMLDivElement> = (
    e,
  ) => {
    // If starting on the indicator, use the indicator handler (it captures).
    if (e.target === indicatorRef.current) return;
    if (isDraggingRef.current) return;

    const container = mainNavRef.current;
    if (!container) return;
    const c = container.getBoundingClientRect();

    stopSnapping();
    tabbarPressedRef.current = true;

    // "Click to move, release to activate":
    // - on pointerdown we snap the indicator to the nearest tab (or the pressed tab)
    // - on pointerup (without dragging) we activate that snapped tab
    const buttonEl = (e.target as HTMLElement | null)?.closest?.(
      'button',
    ) as HTMLButtonElement | null;
    const pressedTabId =
      (buttonEl?.dataset?.tabId as TabValue | undefined) ?? null;

    const x = clampIndicatorXToBounds(e.clientX - c.left);
    const nearest = getNearestTabToX(x);
    const targetTabId = pressedTabId ?? nearest;
    tabbarArmedTabIdRef.current = targetTabId;

    const btn = tabButtonRefs.current[targetTabId];
    const b = btn?.getBoundingClientRect();
    const currentX =
      b && b.width ? clampIndicatorXToBounds(b.left + b.width / 2 - c.left) : x;

    const didMove = Math.abs(indicatorXRef.current - currentX) >= 0.5;
    tabbarArmedWillAnimateRef.current = didMove;
    tabbarArmedTransitionPendingRef.current = didMove;
    const isSameActiveTab = targetTabId === activeTab;
    // Keep settled state when pressing the already-active tab so Lottie `isActive`
    // doesn't flip false→true and replay.
    if (!isSameActiveTab) {
      setIndicatorSettledTab(null);
    }
    // Keep scale 1.1 while pointer is held down on the tabbar,
    // even before any movement happens.
    setIsArmedMove(true);

    setIndicatorX(currentX);
    indicatorXRef.current = currentX;

    // Arm a drag. We'll only start dragging after a small move threshold
    // so normal clicks on tab buttons still work.
    tabbarArmedPointerIdRef.current = e.pointerId;
    tabbarArmedStartXRef.current = e.clientX;

    pointerStartXRef.current = e.clientX;
    indicatorStartXRef.current = currentX;
  };

  const onTabbarPointerMove: React.PointerEventHandler<HTMLDivElement> = (
    e,
  ) => {
    if (tabbarArmedPointerIdRef.current === null) return;
    if (e.pointerId !== tabbarArmedPointerIdRef.current) return;
    if (isDraggingRef.current) return;

    const dx = e.clientX - tabbarArmedStartXRef.current;
    // Follow immediately; threshold is only for suppressing click / entering drag mode.
    const nextX = clampIndicatorXToBounds(indicatorStartXRef.current + dx);
    setIndicatorX(nextX);
    indicatorXRef.current = nextX;
    setVisualIndicatorX(nextX);

    if (Math.abs(dx) < 6) return;

    tabbarArmedPointerIdRef.current = null;
    tabbarArmedWillAnimateRef.current = false;
    tabbarArmedTransitionPendingRef.current = false;
    tabbarPressedRef.current = false;
    setIsArmedMove(false);

    isDraggingRef.current = true;
    setIsDraggingIndicator(true);
    setIndicatorSettledTab(null);
    indicatorPointerIdRef.current = e.pointerId;

    // Capture pointer so we continue to receive move/up events.
    e.currentTarget.setPointerCapture(e.pointerId);

    // Keep the same delta math as indicator dragging.
    pointerStartXRef.current = e.clientX;
    indicatorStartXRef.current = indicatorXRef.current;
  };

  const onTabbarPointerUpOrCancel: React.PointerEventHandler<HTMLDivElement> = (
    e,
  ) => {
    if (tabbarArmedPointerIdRef.current !== null) {
      if (e.pointerId !== tabbarArmedPointerIdRef.current) return;
      tabbarArmedPointerIdRef.current = null;
      tabbarPressedRef.current = false;
      const tabId = tabbarArmedTabIdRef.current;
      tabbarArmedTabIdRef.current = null;
      const willAnimate = tabbarArmedWillAnimateRef.current;
      tabbarArmedWillAnimateRef.current = false;
      // If the indicator already finished its `left` transition while the pointer
      // was held down, drop the scale immediately on release.
      if (!willAnimate || !tabbarArmedTransitionPendingRef.current) {
        setIsArmedMove(false);
      }

      // If user released without starting a drag, activate the snapped tab.
      if (!isDraggingRef.current && tabId && tabId !== activeTab) {
        snapIndicatorToTab(tabId, { animated: true });
        setActiveTab(tabId);
      }
      return;
    }
  };

  const onIndicatorPointerMove: React.PointerEventHandler<HTMLDivElement> = (
    e,
  ) => {
    if (!isDraggingRef.current) return;
    if (
      indicatorPointerIdRef.current !== null &&
      e.pointerId !== indicatorPointerIdRef.current
    )
      return;

    const container = mainNavRef.current;
    if (!container) return;

    const dx = e.clientX - pointerStartXRef.current;

    // Keep indicator within container bounds.
    const nextX = clampIndicatorXToBounds(indicatorStartXRef.current + dx);
    setIndicatorX(nextX);
    indicatorXRef.current = nextX;
  };

  const endIndicatorDrag = (clientX: number) => {
    const container = mainNavRef.current;
    if (!container) return;

    const c = container.getBoundingClientRect();
    const x = clampIndicatorXToBounds(clientX - c.left);
    const nearest = getNearestTabToX(x);

    // Snap indicator visually and activate the nearest tab; keep scale 1.1 during snap.
    setIsSnapping(true);
    setIndicatorSettledTab(null);
    snapIndicatorToTab(nearest, { animated: true });
    setActiveTab(nearest);
  };

  const onIndicatorTransitionEnd: React.TransitionEventHandler<
    HTMLDivElement
  > = (e) => {
    if (e.propertyName !== 'left') return;
    // Pointer-down reposition also animates `left`, but `pendingSettledTabRef`
    // still points at the previous snap — would wrongly restore gray on the old tab.
    const wasSnapTransition = isSnappingRef.current;
    stopSnapping();
    tabbarArmedTransitionPendingRef.current = false;
    // If pointer is still held down on the tabbar, keep the "lifted" scale.
    if (!tabbarPressedRef.current) setIsArmedMove(false);
    if (wasSnapTransition) {
      setIndicatorSettledTab(pendingSettledTabRef.current);
    }
  };

  const onIndicatorPointerUp: React.PointerEventHandler<HTMLDivElement> = (
    e,
  ) => {
    if (!isDraggingRef.current) return;
    if (
      indicatorPointerIdRef.current !== null &&
      e.pointerId !== indicatorPointerIdRef.current
    )
      return;

    isDraggingRef.current = false;
    setIsDraggingIndicator(false);
    indicatorPointerIdRef.current = null;
    endIndicatorDrag(e.clientX);
  };

  const onIndicatorPointerCancel: React.PointerEventHandler<HTMLDivElement> = (
    e,
  ) => {
    if (!isDraggingRef.current) return;
    if (
      indicatorPointerIdRef.current !== null &&
      e.pointerId !== indicatorPointerIdRef.current
    )
      return;

    isDraggingRef.current = false;
    setIsDraggingIndicator(false);
    indicatorPointerIdRef.current = null;
    // Cancel should return to the current active tab without a long animation.
    snapIndicatorToTab(activeTab, { animated: false });
  };

  return (
    <nav className={styles.tabs}>
      {showNewWallpaper && (
        <div className={styles['new-wallpaper']}>
          <Button
            key={'new-wallpaper-button'}
            className={styles['new-wallpaper__button']}
            onClick={() => {
              wallpaperInputRef.current?.click();
            }}
          >
            {wallpaperIcon}
            Add New Wallpaper
          </Button>
          <input
            ref={wallpaperInputRef}
            className={styles['new-wallpaper__input']}
            type='file'
            accept='image/*,video/*'
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              addUserWallpaper(file);
            }}
          />
        </div>
      )}
      <div
        className={`${styles['main-navigation-wrapper']} ${
          isDraggingIndicator || isSnapping
            ? styles['main-navigation--moving']
            : ''
        }`}
        ref={mainNavRef}
        onPointerDown={onTabbarPointerDown}
        onPointerMove={(e) => {
          onTabbarPointerMove(e);
          // When we did start dragging from the tabbar, route movement to the
          // same handler used by the indicator itself.
          onIndicatorPointerMove(
            e as unknown as React.PointerEvent<HTMLDivElement>,
          );
        }}
        onPointerUp={(e) => {
          onTabbarPointerUpOrCancel(e);
          onIndicatorPointerUp(
            e as unknown as React.PointerEvent<HTMLDivElement>,
          );
        }}
        onPointerCancel={(e) => {
          onTabbarPointerUpOrCancel(e);
          onIndicatorPointerCancel(
            e as unknown as React.PointerEvent<HTMLDivElement>,
          );
        }}
      >
        <div
          ref={indicatorRef}
          className={`${styles['drag-indicator']} ${
            disableIndicatorTransition ? styles['drag-indicator--no-anim'] : ''
          } ${
            !isDraggingIndicator && !isSnapping && indicatorSettledTab
              ? styles['drag-indicator--active']
              : ''
          } ${isDraggingIndicator ? styles['drag-indicator--dragging'] : ''} ${
            isSnapping || isArmedMove ? styles['drag-indicator--moving'] : ''
          }`}
          style={{ left: `${indicatorX}px` }}
          onPointerDown={onIndicatorPointerDown}
          onPointerMove={onIndicatorPointerMove}
          onPointerUp={onIndicatorPointerUp}
          onPointerCancel={onIndicatorPointerCancel}
          onTransitionEnd={onIndicatorTransitionEnd}
          role='slider'
          aria-label={t('aria.tabSelector')}
          aria-valuemin={0}
          aria-valuemax={tabOrder.length - 1}
          aria-valuenow={tabOrder.indexOf(activeTab)}
          tabIndex={0}
        />
        {tabs.map((tab) =>
          (() => {
            const isTabLogicallyActive = activeTab === tab.id;
            const layout = tabLayout[tab.id];

            // `.tab-inner` is centered and inset by 4px on each side (see SCSS:
            // width/height: calc(100% - 8px)). The mask is applied inside
            // `.tab-inner`, so compute mask coordinates in that local space.
            const TAB_INNER_INSET_PX = 4;
            const innerWidth = layout
              ? Math.max(0, layout.width - TAB_INNER_INSET_PX * 2)
              : 0;

            const localCenterX = layout ? visualIndicatorX - layout.left : 0;
            const localCenterXInInner = localCenterX - TAB_INNER_INSET_PX;

            const isMaskInMotion =
              isDraggingIndicator || isSnapping || isArmedMove;
            const baseMaskWidth = indicatorSize.width;
            const motionMaskScale = 1.1;
            const staticShrinkPx = 1;
            const maskWidth = isMaskInMotion
              ? baseMaskWidth * motionMaskScale
              : Math.max(0, baseMaskWidth - staticShrinkPx);
            const baseMaskBleed = 0.5 / getDevicePixelRatio();
            const maskBleed = isMaskInMotion ? baseMaskBleed : 0;

            const maskLeft =
              layout && maskWidth
                ? clamp(
                    snapToDevicePixel(
                      localCenterXInInner - maskWidth / 2 - maskBleed,
                      'floor',
                    ),
                    0,
                    innerWidth,
                  )
                : 0;
            const maskRight =
              layout && maskWidth
                ? clamp(
                    snapToDevicePixel(
                      localCenterXInInner + maskWidth / 2 + maskBleed,
                      'ceil',
                    ),
                    0,
                    innerWidth,
                  )
                : 0;
            const maskInsetRight = Math.max(
              0,
              snapToDevicePixel(innerWidth - maskRight, 'floor'),
            );
            const maskOpacity = layout && maskRight - maskLeft > 0 ? 1 : 0;

            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabButtonRefs.current[tab.id] = el;
                }}
                className={styles.tab}
                data-tab-id={tab.id}
                data-settled={tab.id === indicatorSettledTab ? 'true' : 'false'}
                style={
                  layout
                    ? ({
                        ['--mask-left' as never]: `${maskLeft}px`,
                        ['--mask-right' as never]: `${maskRight}px`,
                        ['--mask-inset-right' as never]: `${maskInsetRight}px`,
                        ['--mask-opacity' as never]: String(maskOpacity),
                      } as React.CSSProperties)
                    : undefined
                }
                type='button'
              >
                <div className={styles['tab-inner']}>
                  <div
                    className={`${styles['tab-layer']} ${
                      maskOpacity > 0 ? styles['tab-layer--base-cutout'] : ''
                    }`}
                  >
                    {tab.icon && !tab.avatar && (
                      <div className={styles.icon}>
                        {tab.icon(isTabLogicallyActive)}
                        {tab.id === 'chats' && unreadChatsCount > 0 && (
                          <span className={styles['unread-badge']}>
                            {unreadChatsCount}
                          </span>
                        )}
                      </div>
                    )}

                    {tab.avatar && (
                      <div className={styles.avatar}>
                        <Avatar
                          displayName={user?.username || ''}
                          displayMedia={user?.profile?.primary_media || null}
                          size='small'
                        />
                      </div>
                    )}

                    <span className={styles.label}>{tab.label}</span>
                  </div>

                  <div
                    className={`${styles['tab-layer']} ${styles['tab-layer--masked']}`}
                    aria-hidden='true'
                  >
                    {tab.icon && !tab.avatar && (
                      <div className={styles.icon}>
                        {tab.icon(isTabLogicallyActive)}
                        {tab.id === 'chats' && unreadChatsCount > 0 && (
                          <span className={styles['unread-badge']}>
                            {unreadChatsCount}
                          </span>
                        )}
                      </div>
                    )}

                    {tab.avatar && (
                      <div className={styles.avatar}>
                        <Avatar
                          displayName={user?.username || ''}
                          displayMedia={user?.profile?.primary_media || null}
                          size='small'
                        />
                      </div>
                    )}

                    <span className={styles.label}>{tab.label}</span>
                  </div>
                </div>
              </button>
            );
          })(),
        )}
      </div>
    </nav>
  );
}
