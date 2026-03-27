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

const SWIPE_DISTANCE_RATIO = 0.5;
const SWIPE_VELOCITY_THRESHOLD = 40.3;
const SLIDE_DURATION_MS = 200;
const MOBILE_BREAKPOINT = 768;
// const HORIZONTAL_SWIPE_THRESHOLD = 50;

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
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingClose, setIsAnimatingClose] = useState(false);
  const [displayedChatState, setDisplayedChatState] =
    useState<typeof selectedChat>(null);
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT,
  );

  const swipeWrapperRef = useRef<HTMLDivElement>(null);
  const swipeTrackRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const activeTouchPointerIdsRef = useRef<Set<number>>(new Set());
  const hadMultiTouchRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const animateCloseFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isSpringingBackRef = useRef(false);
  const dragCommittedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  const finishAnimatingClose = useCallback(() => {
    if (animateCloseFallbackRef.current) {
      clearTimeout(animateCloseFallbackRef.current);
      animateCloseFallbackRef.current = null;
    }
    setSelectedChatId(null);
    location.hash = '';
    setIsAnimatingClose(false);
  }, [setSelectedChatId]);

  const triggerCloseAnimation = useCallback(() => {
    if (!selectedChat) return;
    setDisplayedChatState(selectedChat);
    setIsAnimatingClose(true);
    setDragOffset(0);
    animateCloseFallbackRef.current = setTimeout(
      finishAnimatingClose,
      SLIDE_DURATION_MS + 50,
    );
  }, [selectedChat, finishAnimatingClose]);

  const handleGoHome = useCallback(() => {
    if (isMobile && selectedChat) {
      triggerCloseAnimation();
    } else {
      setSelectedChatId(null);
      location.hash = '';
    }
  }, [setSelectedChatId, isMobile, selectedChat, triggerCloseAnimation]);

  const onSwipePointerDown: React.PointerEventHandler<HTMLDivElement> =
    useCallback(
      (e) => {
        if (!selectedChat || !isMobile) return;

        if (e.pointerType === 'touch') {
          activeTouchPointerIdsRef.current.add(e.pointerId);
          if (activeTouchPointerIdsRef.current.size > 1) {
            hadMultiTouchRef.current = true;
            if (dragCommittedRef.current) {
              setDragOffset(0);
              isSpringingBackRef.current = true;
            }
            setIsDragging(false);
            dragCommittedRef.current = false;
            pointerIdRef.current = null;
            return;
          }
        }
        if (!e.isPrimary) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        if (pointerIdRef.current !== null) return;

        pointerIdRef.current = e.pointerId;
        startTimeRef.current = performance.now();
        startXRef.current = e.clientX;
        startYRef.current = e.clientY;
        dragCommittedRef.current = false;

        if (
          isSpringingBackRef.current &&
          swipeTrackRef.current &&
          swipeWrapperRef.current
        ) {
          isSpringingBackRef.current = false;
          const matrix = new DOMMatrix(
            getComputedStyle(swipeTrackRef.current).transform,
          );
          const currentTranslateX = matrix.m41;
          const currentOffset = Math.max(0, currentTranslateX);
          setDragOffset(currentOffset);
          startXRef.current = e.clientX - currentOffset;
          dragCommittedRef.current = true;
          setIsDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      },
      [selectedChat, isMobile],
    );

  // const onSwipePointerMove: React.PointerEventHandler<HTMLDivElement> =
  //   useCallback(
  //     (e) => {
  //       if (pointerIdRef.current !== e.pointerId) return;
  //       const dx = e.clientX - startXRef.current;
  //       const dy = e.clientY - startYRef.current;

  //       if (!dragCommittedRef.current) {
  //         if (
  //           Math.abs(dx) > HORIZONTAL_SWIPE_THRESHOLD &&
  //           Math.abs(dx) >= Math.abs(dy)
  //         ) {
  //           dragCommittedRef.current = true;
  //           setIsDragging(true);
  //           e.currentTarget.setPointerCapture(e.pointerId);
  //           setDragOffset(Math.max(0, dx));
  //         }
  //         return;
  //       }
  //       if (!isDragging) return;
  //       setDragOffset(Math.max(0, dx));
  //     },
  //     [isDragging],
  //   );

  const onSwipePointerUp: React.PointerEventHandler<HTMLDivElement> =
    useCallback(
      (e) => {
        if (e.pointerType === 'touch') {
          activeTouchPointerIdsRef.current.delete(e.pointerId);
          if (activeTouchPointerIdsRef.current.size === 0) {
            hadMultiTouchRef.current = false;
          }
        }
        if (pointerIdRef.current !== e.pointerId) return;
        if (!dragCommittedRef.current) {
          pointerIdRef.current = null;
          return;
        }
        if (hadMultiTouchRef.current) {
          setDragOffset(0);
          isSpringingBackRef.current = true;
          setIsDragging(false);
          pointerIdRef.current = null;
          return;
        }
        const dx = e.clientX - startXRef.current;
        const dt = performance.now() - startTimeRef.current;
        const velocity = dt > 0 ? dx / dt : 0;

        const pageWidth = swipeWrapperRef.current?.offsetWidth ?? 300;
        const distanceThreshold = pageWidth * SWIPE_DISTANCE_RATIO;
        const shouldClose =
          dx > distanceThreshold || velocity > SWIPE_VELOCITY_THRESHOLD;

        if (shouldClose && dx > 0) {
          triggerCloseAnimation();
        } else {
          setDragOffset(0);
          isSpringingBackRef.current = true;
        }
        setIsDragging(false);
        pointerIdRef.current = null;
      },
      [triggerCloseAnimation],
    );

  const onSwipePointerCancel: React.PointerEventHandler<HTMLDivElement> =
    useCallback((e) => {
      if (e.pointerType === 'touch') {
        activeTouchPointerIdsRef.current.delete(e.pointerId);
        if (activeTouchPointerIdsRef.current.size === 0) {
          hadMultiTouchRef.current = false;
        }
      }
      if (pointerIdRef.current !== e.pointerId) return;
      if (dragCommittedRef.current) {
        setDragOffset(0);
        isSpringingBackRef.current = true;
      }
      setIsDragging(false);
      pointerIdRef.current = null;
    }, []);

  const handleSwipeTransitionEnd = useCallback(
    (e: React.TransitionEvent) => {
      if (e.propertyName !== 'transform') return;
      if (isAnimatingClose) {
        finishAnimatingClose();
      } else {
        isSpringingBackRef.current = false;
      }
    },
    [isAnimatingClose, finishAnimatingClose],
  );

  useEffect(() => {
    return () => {
      if (animateCloseFallbackRef.current) {
        clearTimeout(animateCloseFallbackRef.current);
        animateCloseFallbackRef.current = null;
      }
    };
  }, []);

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

  const isSwiped = Boolean(selectedChat) || isAnimatingClose;
  const displayedChat = isAnimatingClose ? displayedChatState : selectedChat;

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
      {displayedChat &&
        (!settingsFullWindow || current === 'chats') &&
        (isMobile ? (
          <div
            ref={swipeWrapperRef}
            className={styles.swipeWrapper}
            onPointerDown={onSwipePointerDown}
            // onPointerMove={onSwipePointerMove}
            onPointerUp={onSwipePointerUp}
            onPointerCancel={onSwipePointerCancel}
          >
            <div
              ref={swipeTrackRef}
              className={styles.swipeTrack}
              style={{
                transform: isAnimatingClose
                  ? 'translateX(100%)'
                  : `translateX(${dragOffset}px)`,
                transition: isDragging
                  ? 'none'
                  : `transform ${SLIDE_DURATION_MS}ms ease-out`,
              }}
              onTransitionEnd={handleSwipeTransitionEnd}
            >
              <Wallpaper />
              <ChatHeader
                onChatInfoClick={handleHeaderClick}
                onGoHome={handleGoHome}
              />
              <div
                className={styles.roomWrapperContainer}
                ref={scrollContainerCallbackRef}
              >
                <div
                  className={`room_wrapper ${sideBarVisible ? 'shifted' : ''}`}
                >
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
              <SideBarMedia
                visible={sideBarVisible}
                onClose={handleSideBarClose}
              />
            </div>
          </div>
        ) : (
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
              <div
                className={`room_wrapper ${sideBarVisible ? 'shifted' : ''}`}
              >
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
            <SideBarMedia
              visible={sideBarVisible}
              onClose={handleSideBarClose}
            />
          </>
        ))}
      {!isMobile &&
        !selectedChat &&
        (!settingsFullWindow || current === 'chats' || !activeProfileTab) && (
          <AppearanceMenu />
        )}
    </div>
  );
};

export default memo(MainChatWindow);
