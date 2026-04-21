import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Icon } from '../Icons/AutoIcons';
import styles from './Profile.module.scss';
import { useTranslation, availableLanguages } from '@/contexts/languageCore';
import Avatar from '../Avatar/Avatar';
import { useUser } from '@/contexts/UserContextCore';
import { useSettings } from '@/contexts/settings/context';
import type { SubTab } from '@/contexts/settings/types';
import { usePageStack } from '@/contexts/useStackHistory';
import { TabContent } from './ActiveProfileTab';
import Button from '@/components/ui/button/Button';
import { ProfileAccountSaveProvider } from './ProfileAccountSaveContext';
import ProfileSubpageHeader from './ProfileSubpageHeader';

const languageIcon = <Icon name='Language' />;
const privacyIcon = <Icon name='Privacy' />;
const appearanceIcon = <Icon name='Appearance' />;
const sessionsIcon = <Icon name='Sessions' />;
const arrowBackIcon = (
  <Icon name='Arrow' style={{ transform: 'rotate(180deg)' }} />
);
const arrowNavIcon = <Icon name='Arrow' className={styles.arrow} />;

const SWIPE_DISTANCE_RATIO = 0.5; // >50% of page width
const SWIPE_VELOCITY_THRESHOLD = 0.3; // px/ms — fast swipe

const SLIDE_DURATION_MS = 200;

const SLIDE_OUT_COMMIT_MS = 100;
const SLIDE_OUT_FALLBACK_PAD_MS = 50;
const HORIZONTAL_SWIPE_THRESHOLD = 4;
const SWIPE_TRANSLATE_TOLERANCE_PX = 4;
const WHEEL_FALLBACK_RELEASE_MS = 180;
const WHEEL_CLAMP_SATURATION_EPS_PX = 1;
const WHEEL_INERTIA_WINDOW_SIZE = 6;
const WHEEL_INERTIA_MIN_SAMPLES = 5;
const WHEEL_INERTIA_DECAY_RATIO = 0.92;
const WHEEL_INERTIA_TOTAL_DROP_RATIO = 0.7;
const WHEEL_INERTIA_MAX_MEDIAN_DT_MS = 40;

type WheelSample = {
  absDx: number;
  ts: number;
  sign: -1 | 1;
};

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function wheelInertiaLikely(samples: WheelSample[]) {
  if (samples.length < WHEEL_INERTIA_MIN_SAMPLES) return false;
  const signsSame = samples.every((s) => s.sign === samples[0].sign);
  if (!signsSame) return false;

  const dts: number[] = [];
  let decays = 0;
  for (let i = 1; i < samples.length; i += 1) {
    dts.push(samples[i].ts - samples[i - 1].ts);
    if (samples[i].absDx <= samples[i - 1].absDx * WHEEL_INERTIA_DECAY_RATIO) {
      decays += 1;
    }
  }

  const dtMedian = median(dts);
  if (dtMedian <= 0 || dtMedian > WHEEL_INERTIA_MAX_MEDIAN_DT_MS) return false;

  const totalDrop =
    samples[samples.length - 1].absDx <=
    samples[0].absDx * WHEEL_INERTIA_TOTAL_DROP_RATIO;
  return decays >= WHEEL_INERTIA_MIN_SAMPLES - 2 && totalDrop;
}

function wheelEventToPixelDelta(
  e: WheelEvent,
  pageWidth: number,
  pageHeight: number,
) {
  let dx = e.deltaX;
  let dy = e.deltaY;
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    const line = 16;
    dx *= line;
    dy *= line;
  } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    dx *= pageWidth;
    dy *= pageHeight;
  }
  return { dx, dy };
}

/** Same upper bound as in commitSwipeBackFromDrag — drag must not overshoot the panel. */
function maxDragOffsetPx(pageWidth: number) {
  return Math.max(pageWidth * 0.8, pageWidth - 1);
}

function clampDragOffset(offset: number, pageWidth: number) {
  return Math.min(Math.max(0, offset), maxDragOffsetPx(pageWidth));
}

function isTranslateFullyOnPreviousPage(
  translateXM41: number,
  stackDepth: number,
  pageWidth: number,
): boolean {
  if (stackDepth < 1 || pageWidth <= 0) return false;
  const snappedToPrevious = -(stackDepth - 1) * pageWidth;
  return translateXM41 >= snappedToPrevious - SWIPE_TRANSLATE_TOLERANCE_PX;
}

export default function Profile() {
  const { t, locale } = useTranslation();
  const { user } = useUser();
  const {
    activeProfileTab,
    profilePageStack,
    setActiveProfileTab,
    pushProfilePage,
    popProfilePage,
    settingsFullWindow,
  } = useSettings();
  const { current } = usePageStack();

  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingBack, setIsAnimatingBack] = useState(false);
  const [displayedStackState, setDisplayedStackState] = useState<
    typeof profilePageStack
  >([]);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const dragCommittedRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const animateBackFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isSpringingBackRef = useRef(false);
  const pendingPopAfterSlideRef = useRef(false);
  const profilePageStackRef = useRef(profilePageStack);
  const dragOffsetRef = useRef(0);
  const wheelCommittedRef = useRef(false);
  const wheelIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelGestureStartTimeRef = useRef(0);
  const wheelSamplesRef = useRef<WheelSample[]>([]);
  const wheelIgnoreUntilRef = useRef(0);

  useEffect(() => {
    profilePageStackRef.current = profilePageStack;
  }, [profilePageStack]);

  useEffect(() => {
    dragOffsetRef.current = dragOffset;
  }, [dragOffset]);

  const finishAnimatingBack = useCallback(() => {
    if (animateBackFallbackRef.current) {
      clearTimeout(animateBackFallbackRef.current);
      animateBackFallbackRef.current = null;
    }
    if (!pendingPopAfterSlideRef.current) return;
    pendingPopAfterSlideRef.current = false;
    popProfilePage();
    setIsAnimatingBack(false);
  }, [popProfilePage]);

  const handleBack = useCallback(() => {
    if (profilePageStack.length < 1) return;
    pendingPopAfterSlideRef.current = true;
    setDisplayedStackState(profilePageStack);
    setIsAnimatingBack(true);
    setDragOffset(0);
    animateBackFallbackRef.current = setTimeout(
      finishAnimatingBack,
      SLIDE_OUT_COMMIT_MS + SLIDE_OUT_FALLBACK_PAD_MS,
    );
  }, [profilePageStack, finishAnimatingBack]);

  const commitSwipeBackFromDrag = useCallback(
    (dx: number, velocityPxPerMs?: number) => {
      const pageWidth = wrapperRef.current?.offsetWidth ?? 300;
      const stackLen = profilePageStackRef.current.length;
      let fullyOnPreviousByTranslate = false;
      if (trackRef.current && stackLen >= 1) {
        try {
          const matrix = new DOMMatrix(
            getComputedStyle(trackRef.current).transform,
          );
          fullyOnPreviousByTranslate = isTranslateFullyOnPreviousPage(
            matrix.m41,
            stackLen,
            pageWidth,
          );
        } catch {
          /* ignore */
        }
      }

      const distanceThreshold = pageWidth * SWIPE_DISTANCE_RATIO;
      const velocityOk =
        velocityPxPerMs !== undefined &&
        velocityPxPerMs > SWIPE_VELOCITY_THRESHOLD;
      const shouldGoBack =
        dx > distanceThreshold || velocityOk || fullyOnPreviousByTranslate;

      if (
        shouldGoBack &&
        (dx > 0 || fullyOnPreviousByTranslate || velocityOk)
      ) {
        const stack = profilePageStackRef.current;
        pendingPopAfterSlideRef.current = true;
        setDisplayedStackState(stack);
        const currentOffset = Math.max(0, dx);
        const clampedOffset = clampDragOffset(currentOffset, pageWidth);

        const startSlideOut = () => {
          setIsAnimatingBack(true);
          setDragOffset(0);
          animateBackFallbackRef.current = setTimeout(
            finishAnimatingBack,
            SLIDE_OUT_COMMIT_MS + SLIDE_OUT_FALLBACK_PAD_MS,
          );
        };

        const offsetAlreadyShown = Math.abs(clampedOffset - dx) < 0.5;
        if (offsetAlreadyShown) {
          requestAnimationFrame(startSlideOut);
        } else {
          requestAnimationFrame(() => {
            setDragOffset(clampedOffset);
            requestAnimationFrame(startSlideOut);
          });
        }
      } else {
        setDragOffset(0);
        isSpringingBackRef.current = true;
      }
    },
    [finishAnimatingBack],
  );

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (wheelIdleTimerRef.current) {
        clearTimeout(wheelIdleTimerRef.current);
        wheelIdleTimerRef.current = null;
      }
      wheelCommittedRef.current = false;
      wheelSamplesRef.current = [];
      wheelIgnoreUntilRef.current = 0;

      if (profilePageStack.length < 1) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, [role="button"], a')) return;
      pointerIdRef.current = e.pointerId;
      startTimeRef.current = performance.now();
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      dragCommittedRef.current = false;

      if (
        isSpringingBackRef.current &&
        trackRef.current &&
        wrapperRef.current
      ) {
        isSpringingBackRef.current = false;
        const wrapperWidth = wrapperRef.current.offsetWidth;
        const baseTranslateX = -profilePageStack.length * wrapperWidth;
        const matrix = new DOMMatrix(
          getComputedStyle(trackRef.current).transform,
        );
        const currentTranslateX = matrix.m41;
        const currentOffset = clampDragOffset(
          Math.max(0, currentTranslateX - baseTranslateX),
          wrapperWidth,
        );
        setDragOffset(currentOffset);
        startXRef.current = e.clientX - currentOffset;
        dragCommittedRef.current = true;
        setIsDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
    [profilePageStack.length],
  );

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (pointerIdRef.current !== e.pointerId) return;
      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;
      const pageWidth = wrapperRef.current?.offsetWidth ?? 300;

      if (!dragCommittedRef.current) {
        if (
          Math.abs(dx) > HORIZONTAL_SWIPE_THRESHOLD &&
          Math.abs(dx) >= Math.abs(dy)
        ) {
          dragCommittedRef.current = true;
          setIsDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
          e.preventDefault();
          setDragOffset(clampDragOffset(dx, pageWidth));
        }
        return;
      }
      if (!isDragging) return;
      e.preventDefault();
      setDragOffset(clampDragOffset(dx, pageWidth));
    },
    [isDragging],
  );

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (pointerIdRef.current !== e.pointerId) return;
      if (!dragCommittedRef.current) {
        pointerIdRef.current = null;
        return;
      }
      const pageWidth = wrapperRef.current?.offsetWidth ?? 300;
      const dx = clampDragOffset(e.clientX - startXRef.current, pageWidth);
      const dt = performance.now() - startTimeRef.current;
      const velocity = dt > 0 ? dx / dt : 0;

      commitSwipeBackFromDrag(dx, velocity);
      setIsDragging(false);
      pointerIdRef.current = null;
    },
    [commitSwipeBackFromDrag],
  );

  const onPointerCancel: React.PointerEventHandler<HTMLDivElement> =
    useCallback(() => {
      if (dragCommittedRef.current) {
        setDragOffset(0);
        isSpringingBackRef.current = true;
      }
      setIsDragging(false);
      pointerIdRef.current = null;
    }, []);

  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent) => {
      if (e.propertyName !== 'transform') return;
      if (e.target !== e.currentTarget) return;

      if (pendingPopAfterSlideRef.current) {
        finishAnimatingBack();
        return;
      }

      if (!isAnimatingBack) {
        isSpringingBackRef.current = false;
      }
    },
    [finishAnimatingBack, isAnimatingBack],
  );

  useEffect(() => {
    return () => {
      if (animateBackFallbackRef.current) {
        clearTimeout(animateBackFallbackRef.current);
        animateBackFallbackRef.current = null;
      }
      if (wheelIdleTimerRef.current) {
        clearTimeout(wheelIdleTimerRef.current);
        wheelIdleTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (current !== 'profile' || settingsFullWindow) return;
    const el = wrapperRef.current;
    if (!el) return;

    const onTouchMove = (e: TouchEvent) => {
      if (!dragCommittedRef.current) return;
      e.preventDefault();
    };

    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [current, settingsFullWindow]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const endWheelGesture = (endedByInertia = false) => {
      if (wheelIdleTimerRef.current) {
        clearTimeout(wheelIdleTimerRef.current);
        wheelIdleTimerRef.current = null;
      }
      if (endedByInertia) {
        wheelIgnoreUntilRef.current =
          performance.now() + WHEEL_FALLBACK_RELEASE_MS;
      }
      wheelSamplesRef.current = [];
      if (!wheelCommittedRef.current) return;
      wheelCommittedRef.current = false;
      setIsDragging(false);
      const dx = dragOffsetRef.current;
      const dt = performance.now() - wheelGestureStartTimeRef.current;
      const velocity = dt > 0 ? dx / dt : 0;
      commitSwipeBackFromDrag(dx, velocity);
    };

    const onWheel = (e: WheelEvent) => {
      if (isAnimatingBack) return;
      if (profilePageStackRef.current.length < 1) return;
      if (pointerIdRef.current !== null) return;
      if (performance.now() < wheelIgnoreUntilRef.current) return;

      const w = el.offsetWidth || 300;
      const h = el.offsetHeight || 300;
      const { dx: wdx, dy: wdy } = wheelEventToPixelDelta(e, w, h);
      const pullDx = -wdx;

      if (!wheelCommittedRef.current) {
        if (
          wdy === 0 &&
          Math.abs(wdx) > HORIZONTAL_SWIPE_THRESHOLD &&
          Math.abs(wdx) >= Math.abs(wdy)
        ) {
          wheelCommittedRef.current = true;
          wheelGestureStartTimeRef.current = performance.now();
          wheelSamplesRef.current = [];
          setIsDragging(true);
        } else {
          return;
        }
      }

      const sign = Math.sign(pullDx);
      if (sign !== 0) {
        wheelSamplesRef.current.push({
          absDx: Math.abs(pullDx),
          ts: performance.now(),
          sign: sign > 0 ? 1 : -1,
        });
        if (wheelSamplesRef.current.length > WHEEL_INERTIA_WINDOW_SIZE) {
          wheelSamplesRef.current.shift();
        }
      }

      if (wheelInertiaLikely(wheelSamplesRef.current)) {
        endWheelGesture(true);
        return;
      }

      e.preventDefault();

      const prev = dragOffsetRef.current;
      const next = clampDragOffset(prev + pullDx, w);
      dragOffsetRef.current = next;
      setDragOffset(next);

      const maxOff = maxDragOffsetPx(w);
      const significantPull = Math.abs(pullDx) > 0.5;
      const saturatedAtMax =
        significantPull &&
        pullDx > 0 &&
        prev >= maxOff - WHEEL_CLAMP_SATURATION_EPS_PX &&
        next === prev;
      const saturatedAtMin =
        significantPull &&
        pullDx < 0 &&
        prev <= WHEEL_CLAMP_SATURATION_EPS_PX &&
        next === prev;
      if (saturatedAtMax || saturatedAtMin) {
        if (wheelIdleTimerRef.current) {
          clearTimeout(wheelIdleTimerRef.current);
          wheelIdleTimerRef.current = null;
        }
        endWheelGesture(false);
        return;
      }

      if (wheelIdleTimerRef.current) {
        clearTimeout(wheelIdleTimerRef.current);
      }
      wheelIdleTimerRef.current = setTimeout(
        () => endWheelGesture(false),
        WHEEL_FALLBACK_RELEASE_MS,
      );
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelIdleTimerRef.current) {
        clearTimeout(wheelIdleTimerRef.current);
        wheelIdleTimerRef.current = null;
      }
    };
  }, [commitSwipeBackFromDrag, current, isAnimatingBack, settingsFullWindow]);

  const displayedStack = isAnimatingBack
    ? displayedStackState
    : profilePageStack;

  const tabs = useMemo(
    () => [
      {
        id: 'account' as const,
        label: user?.username || '',
        subtitle: user?.email || undefined,
        icon: (
          <Avatar
            className={styles.avatar}
            displayName={user?.username || ''}
            displayMedia={user?.profile?.primary_media || null}
          />
        ),
      },
      {
        id: 'language' as const,
        label: t('profileTabs.language'),
        trailing:
          availableLanguages.find((l) => l.code === locale)?.name ?? undefined,
        icon: languageIcon,
      },
      {
        id: 'privacy' as const,
        label: t('profileTabs.privacy'),
        icon: privacyIcon,
      },
      {
        id: 'appearance' as const,
        label: t('profileTabs.appearance'),
        icon: appearanceIcon,
      },
      {
        id: 'active_sessions' as const,
        label: t('profileTabs.active_sessions'),
        icon: sessionsIcon,
      },
    ],
    [locale, t, user?.email, user?.profile?.primary_media, user?.username],
  );

  const targetStackLen = isAnimatingBack
    ? Math.max(0, displayedStack.length - 1)
    : displayedStack.length;
  const translateX = isAnimatingBack
    ? `-${targetStackLen * 100}%`
    : `calc(-${displayedStack.length * 100}% + ${dragOffset}px)`;

  const renderPageHeader = (tabId: SubTab) => {
    if (tabId === null) {
      return (
        <div className={styles.pageHeader}>
          <span
            className={`${styles.pageHeaderTitle} ${styles.pageHeaderTitleSettings}`}
          >
            {t('profile.settings')}
          </span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.container}>
      {settingsFullWindow && (
        <div className={styles.title}>
          {activeProfileTab && (
            <div className={styles.titleText}>
              {t(`profileTabs.${activeProfileTab}`)}
            </div>
          )}
          {!activeProfileTab ? (
            <>{t('profile.settings')}</>
          ) : (
            <Button
              key={'profile-header-button'}
              onClick={handleBack}
              className={styles.close}
            >
              {arrowBackIcon}
            </Button>
          )}
        </div>
      )}

      {settingsFullWindow && (
        <nav className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type='button'
              onClick={() => setActiveProfileTab(tab.id)}
              className={`${styles.tab} ${
                activeProfileTab === tab.id ? styles.active : ''
              }`}
            >
              <div className={styles['tab__content']}>
                {tab.icon}
                <div className={styles['tab__text']}>
                  <span
                    className={`${styles['tab__title']} ${
                      tab.id === 'account' ? styles['tab__title--account'] : ''
                    }`}
                  >
                    {tab.label}
                  </span>
                  {'subtitle' in tab && tab.subtitle ? (
                    <span className={styles['tab__subtitle']}>
                      {tab.subtitle}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className={styles['tab__end']}>
                {'trailing' in tab && tab.trailing ? (
                  <span className={styles['tab__subtitle']}>{tab.trailing}</span>
                ) : null}
                {arrowNavIcon}
              </div>
            </button>
          ))}
        </nav>
      )}

      {current === 'profile' && !settingsFullWindow && (
        <div
          ref={wrapperRef}
          className={styles.pagesWrapper}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <div
            ref={trackRef}
            className={styles.pagesTrack}
            style={{
              transform: `translateX(${translateX})`,
              transition: isDragging
                ? 'none'
                : `transform ${
                    isAnimatingBack ? SLIDE_OUT_COMMIT_MS : SLIDE_DURATION_MS
                  }ms ease-out`,
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            <div className={styles.page}>
              {renderPageHeader(null)}
              <nav className={styles.tabs}>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type='button'
                    onClick={() => pushProfilePage(tab.id)}
                    className={`${styles.tab} ${
                      activeProfileTab === tab.id ? styles.active : ''
                    }`}
                  >
                    <div className={styles['tab__content']}>
                      {tab.icon}
                      <div className={styles['tab__text']}>
                        <span
                          className={`${styles['tab__title']} ${
                            tab.id === 'account'
                              ? styles['tab__title--account']
                              : ''
                          }`}
                        >
                          {tab.label}
                        </span>
                        {'subtitle' in tab && tab.subtitle ? (
                          <span className={styles['tab__subtitle']}>
                            {tab.subtitle}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className={styles['tab__end']}>
                      {'trailing' in tab && tab.trailing ? (
                        <span className={styles['tab__subtitle']}>
                          {tab.trailing}
                        </span>
                      ) : null}
                      {arrowNavIcon}
                    </div>
                  </button>
                ))}
              </nav>
            </div>
            {displayedStack.map((tabId, i) =>
              tabId != null ? (
                <div key={`${tabId}-${i}`} className={styles.page}>
                  <ProfileAccountSaveProvider>
                    <ProfileSubpageHeader tabId={tabId} onBack={handleBack} />
                    <div className={styles.settingsContainer}>
                      <TabContent tabId={tabId} />
                    </div>
                  </ProfileAccountSaveProvider>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  );
}
