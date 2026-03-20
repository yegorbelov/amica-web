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

const languageIcon = <Icon name='Language' />;
const privacyIcon = <Icon name='Privacy' />;
const appearanceIcon = <Icon name='Appearance' />;
const sessionsIcon = <Icon name='Sessions' />;
const arrowBackIcon = (
  <Icon name='Arrow' style={{ transform: 'rotate(180deg)' }} />
);
const fullscreenIcon = <Icon name='Fullscreen' />;
const arrowNavIcon = <Icon name='Arrow' className={styles.arrow} />;

const SWIPE_DISTANCE_RATIO = 0.5; // >50% of page width
const SWIPE_VELOCITY_THRESHOLD = 0.3; // px/ms — fast swipe
const SLIDE_DURATION_MS = 200;
const HORIZONTAL_SWIPE_THRESHOLD = 10;

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
    setSettingsFullWindow,
    isResizingPermitted,
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

  const finishAnimatingBack = useCallback(() => {
    if (animateBackFallbackRef.current) {
      clearTimeout(animateBackFallbackRef.current);
      animateBackFallbackRef.current = null;
    }
    popProfilePage();
    setIsAnimatingBack(false);
  }, [popProfilePage]);

  const handleBack = useCallback(() => {
    if (profilePageStack.length < 1) return;
    setDisplayedStackState(profilePageStack);
    setIsAnimatingBack(true);
    setDragOffset(0);
    animateBackFallbackRef.current = setTimeout(
      finishAnimatingBack,
      SLIDE_DURATION_MS + 50,
    );
  }, [profilePageStack, finishAnimatingBack]);

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = useCallback(
    (e) => {
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
        const currentOffset = Math.max(0, currentTranslateX - baseTranslateX);
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

      if (!dragCommittedRef.current) {
        if (
          Math.abs(dx) > HORIZONTAL_SWIPE_THRESHOLD &&
          Math.abs(dx) >= Math.abs(dy)
        ) {
          dragCommittedRef.current = true;
          setIsDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragOffset(Math.max(0, dx));
        }
        return;
      }
      if (!isDragging) return;
      setDragOffset(Math.max(0, dx));
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
      const dx = e.clientX - startXRef.current;
      const dt = performance.now() - startTimeRef.current;
      const velocity = dt > 0 ? dx / dt : 0;

      const pageWidth = wrapperRef.current?.offsetWidth ?? 300;
      const distanceThreshold = pageWidth * SWIPE_DISTANCE_RATIO;
      const shouldGoBack =
        dx > distanceThreshold || velocity > SWIPE_VELOCITY_THRESHOLD;

      if (shouldGoBack && dx > 0) {
        setDisplayedStackState(profilePageStack);
        const currentOffset = Math.max(0, dx);
        const maxOffset = Math.max(pageWidth * 0.8, pageWidth - 1);
        const clampedOffset = Math.min(currentOffset, maxOffset);

        requestAnimationFrame(() => {
          setDragOffset(clampedOffset);
          requestAnimationFrame(() => {
            setIsAnimatingBack(true);
            setDragOffset(0);
            animateBackFallbackRef.current = setTimeout(
              finishAnimatingBack,
              SLIDE_DURATION_MS + 50,
            );
          });
        });
      } else {
        setDragOffset(0);
        isSpringingBackRef.current = true;
      }
      setIsDragging(false);
      pointerIdRef.current = null;
    },
    [finishAnimatingBack, profilePageStack],
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
      if (!isAnimatingBack) {
        isSpringingBackRef.current = false;
      }
    },
    [isAnimatingBack],
  );

  useEffect(() => {
    return () => {
      if (animateBackFallbackRef.current) {
        clearTimeout(animateBackFallbackRef.current);
        animateBackFallbackRef.current = null;
      }
    };
  }, []);

  const displayedStack = isAnimatingBack
    ? displayedStackState
    : profilePageStack;

  const tabs = useMemo(
    () => [
      {
        id: 'account' as const,
        label: user?.username || '',
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
        label:
          t('profileTabs.language') +
          ' (' +
          availableLanguages.find((l) => l.code === locale)?.name +
          ')',
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
    [locale, t, user?.profile?.primary_media, user?.username],
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
    return (
      <div className={styles.pageHeader}>
        <Button
          key={`header-back-${tabId}`}
          onClick={handleBack}
          className={styles.close}
        >
          {arrowBackIcon}
        </Button>
        <span className={styles.pageHeaderTitle}>
          {t(`profileTabs.${tabId}`)}
        </span>
        {isResizingPermitted && !settingsFullWindow ? (
          <Button
            key={`header-maximize-${tabId}`}
            className={styles.maximize}
            onClick={() => setSettingsFullWindow(true)}
          >
            {fullscreenIcon}
          </Button>
        ) : (
          <span className={styles.pageHeaderSpacer} aria-hidden />
        )}
      </div>
    );
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
                <span>{tab.label}</span>
              </div>
              {arrowNavIcon}
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
                : `transform ${SLIDE_DURATION_MS}ms ease-out`,
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
                      <span>{tab.label}</span>
                    </div>
                    {arrowNavIcon}
                  </button>
                ))}
              </nav>
            </div>
            {displayedStack.map((tabId, i) => (
              <div key={`${tabId}-${i}`} className={styles.page}>
                {renderPageHeader(tabId)}
                <div className={styles.settingsContainer}>
                  <TabContent tabId={tabId} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
