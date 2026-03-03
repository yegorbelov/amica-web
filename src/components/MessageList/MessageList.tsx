import Message from '../Message/Message';
import { useSelectedChat, useChatMessages } from '@/contexts/ChatContextCore';
import { useEffect, useRef, useState, memo, useCallback, useMemo } from 'react';
import ContextMenu from '../ContextMenu/ContextMenu';
import styles from './MessageList.module.scss';
import { useJumpActions } from '@/hooks/useJump';
import { useMergedRefs } from '@/hooks/useMergedRefs';
import { useLazyCanCopyToClipboard } from '@/hooks/useCanCopyToClipboard';
import { useSnackbar } from '@/contexts/snackbar/SnackbarContextCore';
import type { Message as MessageType, User } from '@/types';
import ViewersList from './ViewersList';
import { useMessageContextMenu } from './useMessageContextMenu';

const MessageList: React.FC = () => {
  const { selectedChat } = useSelectedChat();
  const {
    messages,
    messagesLoading,
    setEditingMessage,
    removeMessageFromChat,
  } = useChatMessages();
  const { containerRef: jumpContainerRef, setIsVisible } = useJumpActions();
  const { showSnackbar } = useSnackbar();
  const { canCopy: canCopyToClipboard, triggerCheck: triggerClipboardCheck } =
    useLazyCanCopyToClipboard();

  const [viewersVisible, setViewersVisible] = useState(false);
  const [currentViewers, setCurrentViewers] = useState<User[]>([]);

  const handleShowViewers = useCallback((msg: MessageType) => {
    setCurrentViewers(msg.viewers || []);
    setViewersVisible(true);
  }, []);

  const handleViewersClose = useCallback(() => setViewersVisible(false), []);

  const {
    menuItems,
    menuPos,
    menuVisible,
    isMenuHiding,
    handleClose,
    handleAnimationEnd,
    handleMessageContextMenu,
    handleTouchStart,
    handleTouchEnd,
  } = useMessageContextMenu({
    selectedChat,
    setEditingMessage,
    removeMessageFromChat,
    showSnackbar,
    canCopyToClipboard,
    onShowViewers: handleShowViewers,
    triggerClipboardCheck,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs([containerRef, jumpContainerRef]);
  const messagesRef = useRef(messages);
  const messagesByIdRef = useRef(new Map<string, MessageType>());
  const handlersRef = useRef({
    handleMessageContextMenu,
    handleTouchStart,
    handleTouchEnd,
  });
  useEffect(() => {
    messagesRef.current = messages;
    const byId = new Map<string, MessageType>();
    for (const m of messages) byId.set(String(m.id), m);
    messagesByIdRef.current = byId;
  }, [messages]);
  useEffect(() => {
    handlersRef.current = {
      handleMessageContextMenu,
      handleTouchStart,
      handleTouchEnd,
    };
  }, [handleMessageContextMenu, handleTouchStart, handleTouchEnd]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onContextMenu = (e: MouseEvent) => {
      const msgEl = (e.target as HTMLElement).closest('[data-message-id]');
      const id = msgEl?.getAttribute('data-message-id');
      if (id == null) return;
      const message = messagesByIdRef.current.get(id);
      if (message)
        handlersRef.current.handleMessageContextMenu(
          e as unknown as React.MouseEvent,
          message,
        );
    };
    const onTouchStart = (e: TouchEvent) => {
      const msgEl = (e.target as HTMLElement).closest('[data-message-id]');
      const id = msgEl?.getAttribute('data-message-id');
      if (id == null) return;
      const message = messagesByIdRef.current.get(id);
      if (message)
        handlersRef.current.handleTouchStart(
          e as unknown as React.TouchEvent<HTMLDivElement>,
          message,
        );
    };
    const onTouchEnd = () => {
      handlersRef.current.handleTouchEnd();
    };
    el.addEventListener('contextmenu', onContextMenu);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const THROTTLE_MS = 100;
    const SCROLL_END_MS = 120;
    let rafId: number | null = null;
    let scrollEndTimerId: ReturnType<typeof setTimeout> | null = null;
    let lastRun = 0;
    let lastValue: boolean | null = null;

    const runCheck = () => {
      const visible = el.scrollTop < -50;
      if (lastValue !== visible) {
        lastValue = visible;
        setIsVisible(visible);
      }
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const now = Date.now();
        if (now - lastRun >= THROTTLE_MS) {
          lastRun = now;
          runCheck();
        }
        if (scrollEndTimerId !== null) clearTimeout(scrollEndTimerId);
        scrollEndTimerId = setTimeout(() => {
          scrollEndTimerId = null;
          runCheck();
        }, SCROLL_END_MS);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (scrollEndTimerId !== null) clearTimeout(scrollEndTimerId);
      el.removeEventListener('scroll', onScroll);
    };
  }, [setIsVisible]);

  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const reelItems = useMemo(
    () => messages.filter((m) => Array.isArray(m.files) && m.files.length > 0),
    [messages],
  );

  return (
    <div className='room_div' ref={mergedRef}>
      {menuVisible && (
        <ContextMenu
          items={menuItems}
          position={menuPos || { x: 0, y: 0 }}
          onClose={handleClose}
          onAnimationEnd={handleAnimationEnd}
          isHiding={isMenuHiding}
        />
      )}
      {viewersVisible && (
        <ViewersList viewers={currentViewers} onClose={handleViewersClose} />
      )}

      {messagesLoading && (
        <div className={styles['messages-loading']}>Loading</div>
      )}
      {messages.length === 0 && !messagesLoading && (
        <div className={styles['no-messages']}>No messages yet</div>
      )}
      {reversedMessages.map((message) =>
        !message.is_deleted && (message.value || message.files?.length) ? (
          <Message key={message.id} message={message} reelItems={reelItems} />
        ) : null,
      )}
    </div>
  );
};

export default memo(MessageList);
