import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  memo,
} from 'react';
import SendArea from '../SendArea/SendArea';
import MessageList from '../MessageList/MessageList';
import ChatHeader from '../ChatHeader/ChatHeader';
// import BackgroundComponent from '../BackgroundComponent/BackgroundComponent';
import {
  useSelectedChat,
  useMessagesData,
  useMessagesActions,
} from '@/contexts/ChatContextCore';
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
import type { Message as MessageType } from '@/types';
import { websocketManager } from '@/utils/websocket-manager';
import { useToast } from '@/contexts/toast/ToastContextCore';

const fullscreenExitIcon = <Icon name='FullscreenExit' />;
const EMPTY_SELECTED_MESSAGE_IDS = new Set<number>();

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
  const { messages } = useMessagesData();
  const { removeMessageFromChat } = useMessagesActions();
  const { setContainerRef, setIsVisible } = useJumpActions();
  const { showToast } = useToast();

  const [sideBarVisible, setSideBarVisible] = useState(false);
  const [selectionState, setSelectionState] = useState<{
    chatId: number | null;
    messageIds: Set<number>;
  }>({
    chatId: null,
    messageIds: new Set(),
  });
  // const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const isSelectionMode =
    selectedChat != null &&
    selectionState.chatId === selectedChat.id &&
    selectionState.messageIds.size > 0;
  const selectedMessageIds = isSelectionMode
    ? selectionState.messageIds
    : EMPTY_SELECTED_MESSAGE_IDS;
  const selectedMessagesCount = selectedMessageIds.size;

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

  const enterSelectionMode = useCallback(
    (message: MessageType) => {
      if (!selectedChat) return;
      setSelectionState((prev) => {
        const next =
          prev.chatId === selectedChat.id
            ? new Set(prev.messageIds)
            : new Set<number>();
        next.add(message.id);
        return {
          chatId: selectedChat.id,
          messageIds: next,
        };
      });
    },
    [selectedChat],
  );

  const toggleMessageSelection = useCallback(
    (messageId: number) => {
      if (!selectedChat) return;
      setSelectionState((prev) => {
        const next =
          prev.chatId === selectedChat.id
            ? new Set(prev.messageIds)
            : new Set<number>();
        if (next.has(messageId)) next.delete(messageId);
        else next.add(messageId);
        return {
          chatId: next.size > 0 ? selectedChat.id : null,
          messageIds: next,
        };
      });
    },
    [selectedChat],
  );

  const setMessageSelection = useCallback(
    (messageId: number, selected: boolean) => {
      if (!selectedChat) return;
      setSelectionState((prev) => {
        const next =
          prev.chatId === selectedChat.id
            ? new Set(prev.messageIds)
            : new Set<number>();
        if (selected) next.add(messageId);
        else next.delete(messageId);
        return {
          chatId: next.size > 0 ? selectedChat.id : null,
          messageIds: next,
        };
      });
    },
    [selectedChat],
  );

  const exitSelectionMode = useCallback(() => {
    setSelectionState({
      chatId: null,
      messageIds: new Set(),
    });
  }, []);

  const deleteSelectedMessages = useCallback(() => {
    if (!selectedChat?.id || selectedMessageIds.size === 0) return;
    const ownSelectedMessages = messages.filter(
      (message) => selectedMessageIds.has(message.id) && message.is_own,
    );

    ownSelectedMessages.forEach((message) => {
      removeMessageFromChat(selectedChat.id, message.id);
      websocketManager.sendMessage({
        type: 'delete_message',
        chat_id: selectedChat.id,
        message_id: message.id,
      });
    });

    exitSelectionMode();
    if (ownSelectedMessages.length > 0) {
      const messageLabel =
        ownSelectedMessages.length === 1 ? 'message' : 'messages';
      showToast(`Deleted ${ownSelectedMessages.length} ${messageLabel}`);
    }
  }, [
    selectedChat,
    selectedMessageIds,
    messages,
    removeMessageFromChat,
    exitSelectionMode,
    showToast,
  ]);

  useEffect(() => {
    if (!isSelectionMode) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      exitSelectionMode();
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [isSelectionMode, exitSelectionMode]);

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
              <MessageList
                isSelectionMode={isSelectionMode}
                selectedMessageIds={selectedMessageIds}
                onSelectMessage={enterSelectionMode}
                onToggleMessageSelection={toggleMessageSelection}
                onSetMessageSelection={setMessageSelection}
              />
            </div>
          </div>
          <SendArea
            isSelectionMode={isSelectionMode}
            selectedMessagesCount={selectedMessagesCount}
            onExitSelectionMode={exitSelectionMode}
            onDeleteSelectedMessages={deleteSelectedMessages}
          />
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
