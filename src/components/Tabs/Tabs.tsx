import { useTabs } from './tabsShared';
import { useUser } from '@/contexts/UserContextCore';
import { Icon } from '@/components/Icons/AutoIcons';
import Avatar from '@/components/Avatar/Avatar';
import styles from './Tabs.module.scss';
import { useTranslation } from '@/contexts/languageCore';
import { useSettings } from '@/contexts/settings/context';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Button from '../ui/button/Button';
import Lottie, { type LottieRefCurrentProps } from 'lottie-react';
import contactsLottie from '@/icons/animated/Contacts.json';
import chatsLottie from '@/icons/animated/Chats.json';

const NEW_WALLPAPER_HEIGHT = '50px';

const contactHeartIcon = <Icon name='ContactHeart' />;
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

function ContactsLottieIcon({ isActive }: { isActive: boolean }) {
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);
  const didInitRef = useRef(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    const api = lottieRef.current;
    if (!api) return;

    const getLastFrame = () => {
      const durFrames = api.getDuration?.(true);
      if (typeof durFrames === 'number' && Number.isFinite(durFrames)) {
        return Math.max(0, Math.floor(durFrames) - 1);
      }
      const total = api.animationItem?.totalFrames;
      if (typeof total === 'number' && Number.isFinite(total)) {
        return Math.max(0, Math.floor(total) - 1);
      }
      return 0;
    };

    if (!didInitRef.current) {
      // Ensure inactive state shows the last frame immediately.
      api.goToAndStop(getLastFrame(), true);
      didInitRef.current = true;
    }

    const item = api.animationItem;

    if (isActive) {
      finishedRef.current = false;

      const onComplete = () => {
        finishedRef.current = true;
      };

      item?.addEventListener?.('complete', onComplete);

      // Play forward from start on activation.
      api.setDirection?.(1);
      api.goToAndPlay(0, true);

      return () => {
        item?.removeEventListener?.('complete', onComplete);
      };
    }

    // If the forward animation already finished, don't animate on exit.
    if (finishedRef.current) {
      api.goToAndStop(getLastFrame(), true);
      return;
    }

    // If user switches away mid-animation, play forward to the default (last) frame.
    api.setDirection?.(1);
    api.play?.();
  }, [isActive]);

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={contactsLottie}
      autoplay={false}
      loop={false}
      className={styles['contacts-lottie']}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

function ChatsLottieIcon({ isActive }: { isActive: boolean }) {
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);
  const didInitRef = useRef(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    const api = lottieRef.current;
    if (!api) return;

    const getLastFrame = () => {
      const durFrames = api.getDuration?.(true);
      if (typeof durFrames === 'number' && Number.isFinite(durFrames)) {
        return Math.max(0, Math.floor(durFrames) - 1);
      }
      const total = api.animationItem?.totalFrames;
      if (typeof total === 'number' && Number.isFinite(total)) {
        return Math.max(0, Math.floor(total) - 1);
      }
      return 0;
    };

    if (!didInitRef.current) {
      api.goToAndStop(getLastFrame(), true);
      didInitRef.current = true;
    }

    const item = api.animationItem;

    if (isActive) {
      finishedRef.current = false;

      const onComplete = () => {
        finishedRef.current = true;
      };

      item?.addEventListener?.('complete', onComplete);

      api.setDirection?.(1);
      api.goToAndPlay(0, true);

      return () => {
        item?.removeEventListener?.('complete', onComplete);
      };
    }

    if (finishedRef.current) {
      api.goToAndStop(getLastFrame(), true);
      return;
    }

    api.setDirection?.(1);
    api.play?.();
  }, [isActive]);

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={chatsLottie}
      autoplay={false}
      loop={false}
      className={styles['chats-lottie']}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

export function Tabs() {
  const { activeTab, setActiveTab } = useTabs();
  const { user } = useUser();
  const { t } = useTranslation();
  const { activeProfileTab, addUserWallpaper } = useSettings();
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  const mainNavRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const [isDraggingIndicator, setIsDraggingIndicator] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const isDraggingRef = useRef(false);
  const snappingResetTimerRef = useRef<number | null>(null);
  const indicatorPointerIdRef = useRef<number | null>(null);
  const indicatorStartXRef = useRef(0);
  const pointerStartXRef = useRef(0);
  const [indicatorX, setIndicatorX] = useState(0);
  const indicatorXRef = useRef(0);
  const [disableIndicatorTransition, setDisableIndicatorTransition] =
    useState(true);
  const indicatorInitializedRef = useRef(false);

  const [tabLayout, setTabLayout] = useState<
    Partial<Record<TabValue, { left: number; width: number }>>
  >({});
  const [indicatorSize, setIndicatorSize] = useState<{ width: number; height: number }>(
    { width: 0, height: 0 },
  );

  const tabOrder = useMemo<TabValue[]>(
    () => ['contacts', 'chats', 'profile'],
    [],
  );

  const showNewWallpaper =
    activeProfileTab === 'appearance' && activeTab === 'profile';

  useEffect(() => {
    indicatorXRef.current = indicatorX;
  }, [indicatorX]);

  useEffect(() => {
    // Disable initial "jump" animation on first load.
    setDisableIndicatorTransition(false);
    return () => {
      if (snappingResetTimerRef.current !== null) {
        window.clearTimeout(snappingResetTimerRef.current);
      }
    };
  }, []);

  const stopSnapping = () => {
    setIsSnapping(false);
    if (snappingResetTimerRef.current !== null) {
      window.clearTimeout(snappingResetTimerRef.current);
      snappingResetTimerRef.current = null;
    }
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
    const x = centerX - c.left;

    if (opts?.animated) {
      // If there's no actual movement, there will be no `left` transition,
      // so never enter the "moving" (scale 1.1) state.
      if (Math.abs(indicatorXRef.current - x) < 0.5) {
        stopSnapping();
      } else {
        if (snappingResetTimerRef.current !== null) {
          window.clearTimeout(snappingResetTimerRef.current);
        }
        setIsSnapping(true);
        // Fallback: if transitionend is missed for any reason, don't get stuck.
        snappingResetTimerRef.current = window.setTimeout(() => {
          stopSnapping();
        }, 260);
      }
    }

    setIndicatorX(x);
    indicatorXRef.current = x;
  };

  // Keep indicator aligned when activeTab changes (click/programmatic).
  useLayoutEffect(() => {
    if (isDraggingRef.current) return;
    const shouldAnimate = indicatorInitializedRef.current;
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
    isDraggingRef.current = true;
    setIsDraggingIndicator(true);
    indicatorPointerIdRef.current = e.pointerId;

    // Capture pointer so we continue to receive move/up events.
    e.currentTarget.setPointerCapture(e.pointerId);

    pointerStartXRef.current = e.clientX;
    indicatorStartXRef.current = indicatorX;
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

    const c = container.getBoundingClientRect();
    const dx = e.clientX - pointerStartXRef.current;

    // Keep indicator within container bounds.
    const nextX = clamp(indicatorStartXRef.current + dx, 0, c.width);
    setIndicatorX(nextX);
  };

  const endIndicatorDrag = (clientX: number) => {
    const container = mainNavRef.current;
    if (!container) return;

    const c = container.getBoundingClientRect();
    const x = clamp(clientX - c.left, 0, c.width);
    const nearest = getNearestTabToX(x);

    // Snap indicator visually and activate the nearest tab; keep scale 1.1 during snap.
    setIsSnapping(true);
    snapIndicatorToTab(nearest);
    setActiveTab(nearest);
  };

  const onIndicatorTransitionEnd: React.TransitionEventHandler<
    HTMLDivElement
  > = (e) => {
    if (e.propertyName === 'left') stopSnapping();
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
    snapIndicatorToTab(activeTab);
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
          isDraggingIndicator || isSnapping ? styles['main-navigation--moving'] : ''
        }`}
        ref={mainNavRef}
      >
        <div
          ref={indicatorRef}
          className={`${styles['drag-indicator']} ${
            disableIndicatorTransition ? styles['drag-indicator--no-anim'] : ''
          } ${isDraggingIndicator ? styles['drag-indicator--dragging'] : ''} ${
            isSnapping ? styles['drag-indicator--moving'] : ''
          }`}
          style={{ left: `${indicatorX}px` }}
          onPointerDown={onIndicatorPointerDown}
          onPointerMove={onIndicatorPointerMove}
          onPointerUp={onIndicatorPointerUp}
          onPointerCancel={onIndicatorPointerCancel}
          onTransitionEnd={onIndicatorTransitionEnd}
          role='slider'
          aria-label='Tab selector'
          aria-valuemin={0}
          aria-valuemax={tabOrder.length - 1}
          aria-valuenow={tabOrder.indexOf(activeTab)}
          tabIndex={0}
        />
        {tabs.map((tab) =>
          (() => {
            const isActive = activeTab === tab.id;
            const layout = tabLayout[tab.id];

            const localCenterX =
              layout ? indicatorX - layout.left : 0;
            const maskLeft =
              layout && indicatorSize.width
                ? clamp(localCenterX - indicatorSize.width / 2, 0, layout.width)
                : 0;
            const maskRight =
              layout && indicatorSize.width
                ? clamp(localCenterX + indicatorSize.width / 2, 0, layout.width)
                : 0;
            const maskOpacity = layout && maskRight - maskLeft > 0 ? 1 : 0;

            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabButtonRefs.current[tab.id] = el;
                }}
                className={`${styles.tab} ${isActive ? styles.active : ''}`}
                style={
                  layout
                    ? ({
                        ['--mask-left' as never]: `${maskLeft}px`,
                        ['--mask-right' as never]: `${maskRight}px`,
                        ['--mask-opacity' as never]: String(maskOpacity),
                      } as React.CSSProperties)
                    : undefined
                }
                onClick={(e) => {
                  const el = e.currentTarget;

                  el.classList.remove(styles.active);
                  void el.offsetWidth;
                  el.classList.add(styles.active);

                  // If user clicks the already-active tab, React may bail out from
                  // state updates, so ensure we don't get stuck in "moving" state.
                  if (activeTab === tab.id) {
                    isDraggingRef.current = false;
                    indicatorPointerIdRef.current = null;
                    setIsDraggingIndicator(false);
                    stopSnapping();
                    snapIndicatorToTab(tab.id, { animated: false });
                    return;
                  }

                  setActiveTab(tab.id);
                }}
                type='button'
              >
                <div className={styles['tab-inner']}>
                  <div className={styles['tab-layer']}>
                    {tab.icon && !tab.avatar && (
                      <div className={styles.icon}>{tab.icon(isActive)}</div>
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
                      <div className={styles.icon}>{tab.icon(isActive)}</div>
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
