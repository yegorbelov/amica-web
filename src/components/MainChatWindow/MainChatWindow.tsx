import {
  useState,
  // useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  memo,
} from 'react';
import SendArea from '../SendArea/SendArea';
import MessageList from '../MessageList/MessageList';
import ChatHeader from '../ChatHeader/ChatHeader';
// import BackgroundComponent from '../BackgroundComponent/BackgroundComponent';
import { useSelectedChat } from '@/contexts/ChatContextCore';
import { useJumpActions } from '@/hooks/useJump';
import SideBarMedia from '../SideBarMedia/SideBarMedia';
import styles from './MainChatWindow.module.scss';
import { useSettings } from '@/contexts/settings/context';
import { usePageStack } from '@/contexts/useStackHistory';
import { ActiveProfileTab } from '@/components/Profile/ActiveProfileTab';
import { Icon } from '../Icons/AutoIcons';
import Button from '../ui/button/Button';
import AppearanceMenu from './AppearanceMenu';
import Wallpaper from '@/pages/Wallpaper';

const fullscreenExitIcon = (
  <Icon name='FullscreenExit' />
);

const MainChatWindow: React.FC = () => {
  const {
    // settings,
    settingsFullWindow,
    setSettingsFullWindow,
    activeProfileTab,
  } = useSettings();
  // const { activeWallpaper } = settings;
  // const { blur } = useBlur();

  const { selectedChat, setSelectedChatId } = useSelectedChat();
  const { setContainerRef, setIsVisible } = useJumpActions();

  const [sideBarVisible, setSideBarVisible] = useState(false);
  // const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const handleHeaderClick = useCallback(() => {
    setSideBarVisible(true);
  }, []);

  const handleGoHome = useCallback(() => {
    setSelectedChatId(null);
    location.hash = '';
  }, [setSelectedChatId]);

  const handleSideBarClose = useCallback(() => {
    setSideBarVisible(false);
  }, []);

  const handleMinimizeSettings = useCallback(() => {
    setSettingsFullWindow(false);
  }, [setSettingsFullWindow]);

  const isSwiped = Boolean(selectedChat);

  useLayoutEffect(() => {
    const margin = isSwiped ? '0%' : '100%';
    document.documentElement.style.setProperty(
      '--swipe-margin-inactive',
      margin,
    );

    return () => {
      document.documentElement.style.setProperty(
        '--swipe-margin-inactive',
        '100%',
      );
    };
  }, [isSwiped]);

  const { current } = usePageStack();

  const scrollTeardownRef = useRef<(() => void) | null>(null);
  const scrollContainerCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      setContainerRef(node);
      scrollTeardownRef.current?.();
      scrollTeardownRef.current = null;
      if (!node) {
        setIsVisible(false);
        return;
      }
      let rafId: number | null = null;
      let lastValue: boolean | null = null;
      const runCheck = () => {
        const hasScroll = node.scrollHeight > node.clientHeight;
        const notAtBottom = node.scrollTop < -100;
        const visible = hasScroll && notAtBottom;
        if (lastValue !== visible) {
          lastValue = visible;
          setIsVisible(visible);
        }
      };
      const onScroll = () => {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          runCheck();
        });
      };
      node.addEventListener('scroll', onScroll, { passive: true });
      runCheck();
      scrollTeardownRef.current = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        node.removeEventListener('scroll', onScroll);
      };
    },
    [setContainerRef, setIsVisible],
  );

  // useEffect(() => {
  //   const handleResize = () => setWindowWidth(window.innerWidth);
  //   window.addEventListener('resize', handleResize);
  //   return () => window.removeEventListener('resize', handleResize);
  // }, []);

  return (
    <div className={`main_chat_window ${isSwiped ? 'swiped' : ''}`}>
      {/* <Wallpaper isChatWindow /> */}
      {/* {windowWidth <= 768 && <BackgroundComponent />} */}

      {current === 'profile' && settingsFullWindow && activeProfileTab && (
        <div className={styles.settingsContainer}>
          <Button
            key='main-chat-window-minimize-button'
            onClick={handleMinimizeSettings}
            className={styles.minimize}
          >
            {fullscreenExitIcon}
          </Button>
          <ActiveProfileTab />
        </div>
      )}
      {selectedChat && (!settingsFullWindow || current === 'chats') && (
        <>
          <Wallpaper />

          <ChatHeader
            onChatInfoClick={handleHeaderClick}
            onGoHome={handleGoHome}
          />
          <div
            className={styles.roomWrapperContainer}
            ref={scrollContainerCallbackRef}
          >
            <div className={`room_wrapper ${sideBarVisible ? 'shifted' : ''}`}>
              <Wallpaper />
              <MessageList key={selectedChat.id} />
            </div>
          </div>
          <SendArea />
          <SideBarMedia visible={sideBarVisible} onClose={handleSideBarClose} />
        </>
      )}
      {!selectedChat &&
        (!settingsFullWindow || current === 'chats' || !activeProfileTab) && (
          <AppearanceMenu />
        )}
    </div>
  );
};

export default memo(MainChatWindow);
