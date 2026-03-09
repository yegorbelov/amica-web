import React, { forwardRef, useRef, useImperativeHandle, useMemo } from 'react';
import { lastMessageDateFormat, unreadCountFormat } from '../../utils/index';
import Avatar from '../Avatar/Avatar';
import styles from './ChatListItem.module.scss';
import type { DisplayMedia, File, Message } from '@/types';
import AttachmentPreview from './AttachmentPreview';
import { Icon } from '../Icons/AutoIcons';

export interface ChatListItemProps {
  index?: number;
  shouldAnimateOnInit?: boolean;
  shouldHideBeforeInitAnimation?: boolean;
  chatId: number;
  displayPrimaryMedia?: DisplayMedia;
  displayName: string;
  lastMessage: Message | null;
  unread_count: number;
  isActive: boolean;
  onChatClick: (chatId: number) => void;
  onChatContextMenu?: (
    chatId: number,
    position: { x: number; y: number },
  ) => void;
}

const ChatListItem = forwardRef<HTMLDivElement, ChatListItemProps>(
  (
    {
      index,
      shouldAnimateOnInit = false,
      shouldHideBeforeInitAnimation = false,
      chatId,
      displayPrimaryMedia,
      displayName,
      lastMessage,
      unread_count,
      isActive,
      onChatClick,
      onChatContextMenu,
    },
    ref,
  ) => {
    const LONG_PRESS_MS = 250;
    const MOVE_CANCEL_THRESHOLD_PX = 8;
    const lastMessageDate =
      lastMessage && lastMessageDateFormat(lastMessage.date);
    const container = useRef<HTMLDivElement>(null);
    const longPressTimerRef = useRef<number | null>(null);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const suppressNextMouseDownRef = useRef(false);
    const longPressTriggeredRef = useRef(false);

    useImperativeHandle(ref, () => container.current as HTMLDivElement);

    const lastMessageText = lastMessage && lastMessage.value;

    const lastMessageFiles = (lastMessage?.files || [])
      .filter(
        (file: File) =>
          file.category === 'video' ||
          file.category === 'image' ||
          file.category === 'audio',
      )
      .slice(0, 3);

    const readIcon = useMemo(
      () => <Icon name='Read' className={styles['chat-list-item__read']} />,
      [],
    );
    const unreadIcon = useMemo(
      () => (
        <Icon
          name='Unread'
          className={styles['chat-list-item__read']}
          style={{ width: '12px', height: '12px' }}
        />
      ),
      [],
    );

    const unread_counter = unreadCountFormat(unread_count);
    const goToChat = (
      e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    ): void => {
      if (suppressNextMouseDownRef.current) {
        suppressNextMouseDownRef.current = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      window.history.pushState({}, '', `#${chatId}`);

      const ripple = document.createElement('span');
      ripple.className = styles.ripple;

      const rect = container.current!.getBoundingClientRect();
      ripple.style.left = e.clientX - rect.left + 'px';
      ripple.style.top = e.clientY - rect.top + 'px';

      container.current!.appendChild(ripple);

      ripple.addEventListener('animationend', () => {
        ripple.remove();
      });

      // Defer to avoid [Violation] 'mousedown' handler took Nms (onChatClick triggers setState + fetch)
      const id = chatId;
      setTimeout(() => {
        onChatClick(id);
      }, 0);
    };

    const clearLongPressTimer = () => {
      if (longPressTimerRef.current != null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      longPressTriggeredRef.current = false;
      clearLongPressTimer();
      longPressTimerRef.current = window.setTimeout(() => {
        suppressNextMouseDownRef.current = true;
        longPressTriggeredRef.current = true;
        onChatContextMenu?.(chatId, {
          x: touch.clientX,
          y: touch.clientY,
        });
      }, LONG_PRESS_MS);
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
      if (!touchStartRef.current || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const movedX = Math.abs(touch.clientX - touchStartRef.current.x);
      const movedY = Math.abs(touch.clientY - touchStartRef.current.y);
      if (
        movedX > MOVE_CANCEL_THRESHOLD_PX ||
        movedY > MOVE_CANCEL_THRESHOLD_PX
      ) {
        clearLongPressTimer();
      }
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
      clearLongPressTimer();
      touchStartRef.current = null;
      if (!longPressTriggeredRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      longPressTriggeredRef.current = false;
    };

    const handleTouchCancel = () => {
      clearLongPressTimer();
      touchStartRef.current = null;
      longPressTriggeredRef.current = false;
    };
    const getAttachmentText = (files: File[] = []) => {
      if (!files.length) return '';
      const isImage = (f: File) => f.category === 'image';
      const isVideo = (f: File) => f.category === 'video';
      const isAudio = (f: File) => f.category === 'audio';

      const allImages = files.every(isImage);
      const allVideos = files.every(isVideo);
      const allAudios = files.every(isAudio);

      if (allImages) {
        return files.length === 1 ? 'Photo' : 'Photos';
      }

      if (allVideos) {
        return files.length === 1 ? 'Video' : 'Videos';
      }

      if (allAudios) {
        return files.length === 1 ? files[0].original_name || '' : 'Audio';
      }

      return 'Media';
    };

    const attachment_text = lastMessage
      ? getAttachmentText(lastMessage.files)
      : '';

    return (
      <div
        className={`${styles['chat-list-item']} ${
          isActive ? styles['chat-list-item--active'] : ''
        } ${shouldHideBeforeInitAnimation ? styles['chat-list-item--pre-init-hidden'] : ''} ${
          shouldAnimateOnInit ? styles['chat-list-item--animate-in'] : ''
        }`}
        onMouseDown={goToChat}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onChatContextMenu?.(chatId, { x: e.clientX, y: e.clientY });
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{ '--index': `${index}` } as React.CSSProperties}
        ref={container}
      >
        <Avatar
          displayName={displayName}
          displayMedia={displayPrimaryMedia}
          className={styles['chat-list-item__avatar']}
        />

        <div className={styles['chat-list-item__content']}>
          <div className={styles['chat-list-item__header']}>
            <div className={styles['chat-list-item__name']}>{displayName}</div>
            {lastMessage?.is_own &&
              (lastMessage?.is_viewed ? readIcon : unreadIcon)}
            <time className={styles['chat-list-item__date']}>
              {lastMessageDate}
            </time>
          </div>
          <div className={styles['chat-list-item__message-row']}>
            <div className={styles['chat-list-item__message-text']}>
              {lastMessageFiles.length > 0 && (
                <span className={styles['chat-list-item__attachments']}>
                  {lastMessageFiles.map((file: File, index: number) => (
                    <AttachmentPreview key={file.id || index} file={file} />
                  ))}
                </span>
              )}
              {/* <span className={styles['chat-list-item__message-text-content']}> */}
              {lastMessage &&
                (lastMessageText
                  ? lastMessageText
                  : `${lastMessageFiles.length === 1 ? '' : lastMessage.files.length} ${attachment_text}`)}
              {/* </span> */}
            </div>
            {unread_count > 0 && (
              <span className={styles['chat-list-item__unread']}>
                {unread_counter}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  },
);

ChatListItem.displayName = 'ChatListItem';

export default ChatListItem;
