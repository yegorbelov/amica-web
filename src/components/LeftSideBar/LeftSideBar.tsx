import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Tabs } from '../Tabs/Tabs';
import { Tab } from '../Tabs/Tab';
import Profile from '@/components/Profile/Profile';
import ChatsTabView from './ChatsTabView';
import ContactsTabContent from './ContactsTabContent';
import styles from './LeftSideBar.module.scss';
import { useSettings } from '@/contexts/settings/context';
import { useTabs } from '@/components/Tabs/tabsShared';
import {
  LeftSideBarLayoutContext,
  type LeftSideBarLayoutContextValue,
} from './leftSideBarLayoutContext';
import {
  clampChatsSidebarWidthForStorage,
  getChatsSidebarWidthFromIdb,
  readChatsSidebarWidthFromSessionStorageSync,
  setChatsSidebarWidthInIdb,
} from '@/utils/chatStateStorage';

const DEFAULT_SIDEBAR_WIDTH_PX = 384;
const CHATS_MAX_WIDTH_PX = 500;
const CHATS_COLLAPSED_WIDTH_PX = 80;
const CHATS_SNAP_THRESHOLD_PX = 250;
const CHATS_STICK_BAND_PX = 28;
const MOBILE_MAX_WIDTH_PX = 768;

function getInitialChatsSidebarWidthPx(): number {
  if (typeof window === 'undefined') return DEFAULT_SIDEBAR_WIDTH_PX;
  if (window.innerWidth <= MOBILE_MAX_WIDTH_PX) return DEFAULT_SIDEBAR_WIDTH_PX;
  const fromSession = readChatsSidebarWidthFromSessionStorageSync();
  return fromSession ?? DEFAULT_SIDEBAR_WIDTH_PX;
}

interface ChooseListProps {
  userInfo?: {
    id: number;
    username: string;
    email: string;
  } | null;
  onLogout?: () => void;
  onChatSelect?: (chatId: number) => void;
}

const LeftSideBar: React.FC<ChooseListProps> = () => {
  const { activeProfileTab } = useSettings();
  const { activeTab } = useTabs();
  const [chatsSidebarWidth, setChatsSidebarWidth] = useState(
    getInitialChatsSidebarWidthPx,
  );
  const [chatsWidthHydratedFromIdb, setChatsWidthHydratedFromIdb] =
    useState(false);
  const [chatsWidthTransitionEnabled, setChatsWidthTransitionEnabled] =
    useState(false);
  const [isResizingChatsSidebar, setIsResizingChatsSidebar] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== 'undefined' && window.innerWidth > MOBILE_MAX_WIDTH_PX,
  );
  const resizePointerIdRef = useRef<number | null>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);

  const chatsChromeCollapsed =
    activeTab === 'chats' &&
    isDesktop &&
    chatsSidebarWidth < CHATS_SNAP_THRESHOLD_PX;

  const layoutValue: LeftSideBarLayoutContextValue = {
    chatsChromeCollapsed,
  };

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MOBILE_MAX_WIDTH_PX + 1}px)`);
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      setChatsSidebarWidth(DEFAULT_SIDEBAR_WIDTH_PX);
      setChatsWidthHydratedFromIdb(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const w = await getChatsSidebarWidthFromIdb();
        if (cancelled) return;
        if (w != null) {
          const clamped = clampChatsSidebarWidthForStorage(w);
          setChatsSidebarWidth((prev) => (prev === clamped ? prev : clamped));
        }
      } finally {
        if (!cancelled) setChatsWidthHydratedFromIdb(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDesktop]);

  useEffect(() => {
    if (!isDesktop || !chatsWidthHydratedFromIdb) {
      setChatsWidthTransitionEnabled(false);
      return;
    }
    let cancelled = false;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      if (cancelled) return;
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) setChatsWidthTransitionEnabled(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isDesktop, chatsWidthHydratedFromIdb]);

  useEffect(() => {
    if (!isDesktop || !chatsWidthHydratedFromIdb) return;
    void setChatsSidebarWidthInIdb(chatsSidebarWidth).catch(() => {});
  }, [isDesktop, chatsWidthHydratedFromIdb, chatsSidebarWidth]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!isDesktop) {
      root.style.removeProperty('--left-side-bar-width');
      root.style.removeProperty('--main-navigation-height');
      root.style.removeProperty('--main-chat-stack-breakpoint');
      return () => {
        root.style.removeProperty('--left-side-bar-width');
        root.style.removeProperty('--main-navigation-height');
        root.style.removeProperty('--main-chat-stack-breakpoint');
      };
    }
    const w =
      activeTab === 'chats' ? chatsSidebarWidth : DEFAULT_SIDEBAR_WIDTH_PX;
    root.style.setProperty('--left-side-bar-width', `${w}px`);

    const cs = getComputedStyle(root);
    const mainChatPx =
      parseFloat(cs.getPropertyValue('--main-chat-window-width')) || 700;
    const gapPx = parseFloat(cs.getPropertyValue('--global-gap')) || 0;
    const stackBreakpoint = Math.round(mainChatPx + w + gapPx);
    root.style.setProperty(
      '--main-chat-stack-breakpoint',
      `${stackBreakpoint}px`,
    );

    if (chatsChromeCollapsed) {
      root.style.setProperty('--main-navigation-height', '0px');
    } else {
      root.style.removeProperty('--main-navigation-height');
    }
    return () => {
      root.style.setProperty(
        '--left-side-bar-width',
        `${DEFAULT_SIDEBAR_WIDTH_PX}px`,
      );
      root.style.removeProperty('--main-navigation-height');
      root.style.removeProperty('--main-chat-stack-breakpoint');
    };
  }, [isDesktop, activeTab, chatsSidebarWidth, chatsChromeCollapsed]);

  const applyChatsWidthFromPointer = useCallback((clientX: number) => {
    const startW = resizeStartWidthRef.current;
    const dx = clientX - resizeStartXRef.current;
    let next = startW + dx;
    next = Math.min(
      CHATS_MAX_WIDTH_PX,
      Math.max(CHATS_COLLAPSED_WIDTH_PX, next),
    );

    if (startW === CHATS_COLLAPSED_WIDTH_PX) {
      if (next > CHATS_SNAP_THRESHOLD_PX) {
        next = DEFAULT_SIDEBAR_WIDTH_PX;
      } else {
        next = CHATS_COLLAPSED_WIDTH_PX;
      }
      setChatsSidebarWidth(next);
      return;
    }

    if (next < CHATS_SNAP_THRESHOLD_PX) {
      next = CHATS_COLLAPSED_WIDTH_PX;
    } else {
      const narrowing = next < startW - 0.5;
      if (
        narrowing &&
        startW > CHATS_SNAP_THRESHOLD_PX &&
        next > CHATS_SNAP_THRESHOLD_PX &&
        next <= CHATS_SNAP_THRESHOLD_PX + CHATS_STICK_BAND_PX
      ) {
        next = CHATS_SNAP_THRESHOLD_PX;
      }
    }
    setChatsSidebarWidth(next);
  }, []);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activeTab !== 'chats' || !isDesktop) return;
      if (e.button !== 0) return;
      e.preventDefault();
      resizePointerIdRef.current = e.pointerId;
      resizeStartXRef.current = e.clientX;
      resizeStartWidthRef.current = chatsSidebarWidth;
      setIsResizingChatsSidebar(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [activeTab, isDesktop, chatsSidebarWidth],
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (resizePointerIdRef.current !== e.pointerId) return;
      applyChatsWidthFromPointer(e.clientX);
    },
    [applyChatsWidthFromPointer],
  );

  const endResize = useCallback((e: React.PointerEvent) => {
    if (resizePointerIdRef.current !== e.pointerId) return;
    resizePointerIdRef.current = null;
    setIsResizingChatsSidebar(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const showResizeHandle = activeTab === 'chats' && isDesktop;

  const onResizeHandleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeTab !== 'chats' || !isDesktop) return;
      setChatsSidebarWidth(DEFAULT_SIDEBAR_WIDTH_PX);
    },
    [activeTab, isDesktop],
  );

  return (
    <LeftSideBarLayoutContext.Provider value={layoutValue}>
      <div
        className={styles['left-side-bar']}
        style={
          activeTab === 'chats' && isDesktop
            ? {
                width: chatsSidebarWidth,
                transition:
                  isResizingChatsSidebar || !chatsWidthTransitionEnabled
                    ? 'none'
                    : 'width 0.2s ease',
              }
            : undefined
        }
      >
        {showResizeHandle && (
          <div
            role='separator'
            aria-orientation='vertical'
            aria-label='Resize chats panel'
            className={styles['left-side-bar__resize-handle']}
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onDoubleClick={onResizeHandleDoubleClick}
          />
        )}
        <div className={styles['left-side-bar__inner']}>
          <div className={styles['left-side-bar__tab-panels']}>
            <Tab id='contacts'>
              <div className={`${styles['tab-content']}`}>
                <ContactsTabContent />
              </div>
            </Tab>
            <Tab id='chats'>
              <ChatsTabView />
            </Tab>
            <Tab id='profile'>
              <div
                className={`${styles['tab-content']} ${styles['tab-content--profile']}`}
                style={
                  {
                    '--offset-bottom':
                      activeProfileTab === 'appearance' ? '120px' : '70px',
                  } as React.CSSProperties
                }
              >
                <Profile />
              </div>
            </Tab>
          </div>
        </div>
        <Tabs />
      </div>
    </LeftSideBarLayoutContext.Provider>
  );
};

export default LeftSideBar;
