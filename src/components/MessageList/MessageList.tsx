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
  const { messages, messagesLoading, setEditingMessage, removeMessageFromChat } =
    useChatMessages();
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setIsVisible(el.scrollTop < -50);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [setIsVisible]);

  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

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
          <Message
            key={message.id}
            message={message}
            onContextMenu={(e) => handleMessageContextMenu(e, message)}
            onTouchStart={(e) => handleTouchStart(e, message)}
            onTouchEnd={handleTouchEnd}
          />
        ) : null,
      )}
    </div>
  );
};

export default memo(MessageList);
