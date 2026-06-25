import React, {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import ChatListItem from './ChatListItem';
import { useChatMeta, useSelectedChat } from '@/contexts/ChatContextCore';
import type { Chat, DisplayMedia } from '@/types';
import styles from './ChatList.module.scss';
import { useSearchContext } from '@/contexts/search/SearchContextCore';
import { useSortedChats } from './useSortedChats';
import { useAnimatedChatOrder } from './useAnimatedChatOrder';
import {
  // ChatListLoading,
  ChatListError,
  ChatListEmpty,
} from './ChatListStates';
import { type MenuItem } from '../ui/menu/Menu';
import { Menu } from '../ui/menu/Menu';

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
  const { chats, error, fetchChats, handleChatClick, deleteChat } =
    useChatMeta();
  const { selectedChatId } = useSelectedChat();
  const { term } = useSearchContext();
  const [contextMenuChatId, setContextMenuChatId] = useState<number | null>(
    null,
  );
  const [contextMenuPosition, setContextMenuPosition] = useState({
    x: 0,
    y: 0,
  });
  const [contextMenuInstanceKey, setContextMenuInstanceKey] = useState(0);

  const sortedChats = useSortedChats(chats);
  const { displayChats, setChatItemRef } = useAnimatedChatOrder(sortedChats);
  // const shouldShowInitialLoading = loading && chats.length === 0;
  const [hasPlayedInitialAnimation, setHasPlayedInitialAnimation] =
    useState(false);
  const [isInitialAnimationActive, setIsInitialAnimationActive] =
    useState(false);
  const shouldStartInitialAnimation =
    !hasPlayedInitialAnimation && sortedChats.length > 0;
  const shouldAnimateOnInit =
    shouldStartInitialAnimation && isInitialAnimationActive;
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
  const isActive = term.length === 0;
  const isEmpty = displayChats.length === 0;
  const contextMenuItems = React.useMemo<MenuItem<string>[]>(
    () =>
      contextMenuChatId == null
        ? []
        : [
            {
              label: 'Delete chat',
              icon: 'Delete',
              destructive: true,
              onClick: () => deleteChat(contextMenuChatId),
            },
          ],
    [contextMenuChatId, deleteChat],
  );

  const handleChatContextMenu = React.useCallback(
    (chatId: number, position: { x: number; y: number }) => {
      setContextMenuChatId(chatId);
      setContextMenuPosition(position);
      setContextMenuInstanceKey((prev) => prev + 1);
    },
    [],
  );

  // if (shouldShowInitialLoading) return <ChatListLoading />;
  if (error) return <ChatListError message={error} onRetry={fetchChats} />;

  return (
    <div
      ref={chatListRef}
      className={`${styles['chat-list-view']} ${
        isActive ? styles['chat-list-view--active'] : ''
      }`}
    >
      {isEmpty ? (
        <ChatListEmpty text='No conversations yet' />
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
        <Menu
          key={`chat-context-menu-${contextMenuInstanceKey}`}
          items={contextMenuItems}
          position={contextMenuPosition}
        />
      )}
    </div>
  );
}

export default memo(ChatList);
