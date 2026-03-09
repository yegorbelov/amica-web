import React, { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ChatListItem from './ChatListItem';
import { useChatMeta, useSelectedChat } from '@/contexts/ChatContextCore';
import type { Chat, DisplayMedia } from '@/types';
import styles from './ChatList.module.scss';
import { useSearchContext } from '@/contexts/search/SearchContextCore';
import { useSortedChats } from './useSortedChats';
import { useAnimatedChatOrder } from './useAnimatedChatOrder';
import {
  ChatListLoading,
  ChatListError,
  ChatListEmpty,
} from './ChatListStates';
import ContextMenu, { type MenuItem } from '../ContextMenu/ContextMenu';

const MemoizedChatListItem = memo(ChatListItem);
const ChatListContent = memo(function ChatListContent({
  displayChats,
  selectedChatId,
  setChatItemRef,
  onChatClick,
  onChatContextMenu,
  shouldAnimateOnInit,
  shouldHideBeforeInitAnimation,
}: {
  displayChats: Chat[];
  selectedChatId: number | null;
  setChatItemRef: (chatId: number, el: HTMLDivElement | null) => void;
  onChatClick: (chatId: number) => void;
  onChatContextMenu: (
    chatId: number,
    position: { x: number; y: number },
  ) => void;
  shouldAnimateOnInit: boolean;
  shouldHideBeforeInitAnimation: boolean;
}) {
  return (
    <>
      {displayChats.map((chat, index) => (
        <MemoizedChatListItem
          key={chat.id}
          chatId={chat.id}
          displayPrimaryMedia={chat.primary_media as DisplayMedia}
          displayName={chat.name || ''}
          lastMessage={chat.last_message}
          unread_count={chat.unread_count}
          isActive={selectedChatId === chat.id}
          onChatClick={onChatClick}
          onChatContextMenu={onChatContextMenu}
          ref={(el) => setChatItemRef(chat.id, el)}
          index={index}
          shouldAnimateOnInit={shouldAnimateOnInit}
          shouldHideBeforeInitAnimation={shouldHideBeforeInitAnimation}
        />
      ))}
    </>
  );
});

function ChatList() {
  const { chats, loading, error, fetchChats, handleChatClick, deleteChat } =
    useChatMeta();
  const { selectedChatId } = useSelectedChat();
  const { term } = useSearchContext();
  const [contextMenuChatId, setContextMenuChatId] = useState<number | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  const sortedChats = useSortedChats(chats);
  const { displayChats, setChatItemRef } = useAnimatedChatOrder(sortedChats);
  const shouldShowInitialLoading = loading && chats.length === 0;
  const [hasPlayedInitialAnimation, setHasPlayedInitialAnimation] =
    useState(false);
  const [isInitialAnimationActive, setIsInitialAnimationActive] = useState(false);
  const shouldStartInitialAnimation =
    !hasPlayedInitialAnimation && sortedChats.length > 0;
  const shouldAnimateOnInit = shouldStartInitialAnimation && isInitialAnimationActive;
  const shouldHideBeforeInitAnimation =
    shouldStartInitialAnimation && !isInitialAnimationActive;

  useLayoutEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    if (!shouldStartInitialAnimation) return;

    const activationId = window.setTimeout(() => {
      setIsInitialAnimationActive(true);
    }, 0);
    const timeoutId = window.setTimeout(() => {
      setIsInitialAnimationActive(false);
      setHasPlayedInitialAnimation(true);
    }, 450);

    return () => {
      window.clearTimeout(activationId);
      window.clearTimeout(timeoutId);
    };
  }, [shouldStartInitialAnimation]);

  const chatListRef = useRef<HTMLDivElement>(null);
  const isActive = chats.length > 0 && term.length === 0;
  const isEmpty = displayChats.length === 0;
  const contextMenuItems = React.useMemo<MenuItem[]>(
    () =>
      contextMenuChatId == null
        ? []
        : [
            {
              label: 'Delete chat',
              icon: 'Delete',
              danger: true,
              onClick: () => deleteChat(contextMenuChatId),
            },
          ],
    [contextMenuChatId, deleteChat],
  );

  const handleContextMenuClose = React.useCallback(() => {
    setContextMenuChatId(null);
  }, []);

  const handleChatContextMenu = React.useCallback(
    (chatId: number, position: { x: number; y: number }) => {
      setContextMenuChatId(chatId);
      setContextMenuPosition(position);
    },
    [],
  );

  if (shouldShowInitialLoading) return <ChatListLoading />;
  if (error) return <ChatListError message={error} onRetry={fetchChats} />;
  if (sortedChats.length === 0 && isEmpty) {
    return <ChatListEmpty text='No chats' />;
  }

  return (
    <div
      ref={chatListRef}
      className={`${styles['chat-list-view']} ${
        isActive ? styles['chat-list-view--active'] : ''
      }`}
    >
      {isEmpty ? (
        <ChatListEmpty
          text='No chats found'
          showRefresh
          onRefresh={fetchChats}
        />
      ) : (
        <ChatListContent
          displayChats={displayChats}
          selectedChatId={selectedChatId}
          setChatItemRef={setChatItemRef}
          onChatClick={handleChatClick}
          onChatContextMenu={handleChatContextMenu}
          shouldAnimateOnInit={shouldAnimateOnInit}
          shouldHideBeforeInitAnimation={shouldHideBeforeInitAnimation}
        />
      )}
      {contextMenuChatId != null && (
        <ContextMenu
          items={contextMenuItems}
          position={contextMenuPosition}
          onClose={handleContextMenuClose}
        />
      )}
    </div>
  );
}

export default memo(ChatList);
