import React, {
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import type { Message, Chat, User } from '@/types';
import { apiFetch, apiUpload } from '@/utils/apiFetch';
import { websocketManager } from '@/utils/websocket-manager';
import type { WebSocketMessage } from '@/utils/websocket-manager';
import { useSettingsActions } from './settings/context';
import {
  getChatState,
  setChatState,
  getLastUserId,
} from '@/utils/chatStateStorage';
import {
  ChatMetaContext,
  ChatMessagesContext,
  SelectedChatContext,
  MessagesDataContext,
  MessagesActionsContext,
  EditingContext,
  type ChatMetaContextType,
  type ChatMessagesContextType,
  type SelectedChatContextType,
  type MessagesDataContextType,
  type MessagesActionsContextType,
  type EditingContextType,
} from './ChatContextCore';
import { useMessages } from './useMessages';
import { useUser } from './UserContextCore';

export const ChatProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingChatId, setLoadingChatId] = useState<number | null>(null);
  const [initialMessagesCache, setInitialMessagesCache] = useState<Record<
    number,
    Message[]
  > | null>(null);
  const initialFetchRef = useRef(true);
  const selectedChatIdRef = useRef(selectedChatId);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingMessageRef = useRef<Message | null>(null);
  selectedChatIdRef.current = selectedChatId;
  const { setActiveProfileTab } = useSettingsActions();

  const {
    messagesCache,
    messages,
    editingMessage,
    setEditingMessage,
    updateMessages,
    updateMessageInChat,
    removeMessageFromChat,
    getCachedMessages,
    handleNewMessage,
  } = useMessages({
    selectedChatId,
    setChats,
    initialMessagesCache,
  });

  editingMessageRef.current = editingMessage;

  const selectedChat = useMemo(
    () => chats.find((c) => c.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const selectChat = useCallback(
    (chatId: number | null) => {
      setSelectedChatId(chatId);
      setEditingMessage(null);
    },
    [setEditingMessage],
  );

  const fetchChat = useCallback(
    async (chatId: number) => {
      setLoadingChatId(chatId);
      const applyChatData = (data: {
        media?: Chat['media'];
        members?: Chat['members'];
        messages?: Message[];
      }) => {
        setLoadingChatId((prev) => (prev === chatId ? null : prev));
        if (selectedChatIdRef.current !== chatId) return;
        if (data.media) {
          setChats((prevChats) =>
            prevChats.map((chat) =>
              chat.id === chatId
                ? {
                    ...chat,
                    media: data.media!,
                    members: data.members ?? chat.members,
                  }
                : chat,
            ),
          );
        }
        updateMessages(data.messages || [], chatId);
        setSelectedChatId(chatId);
      };

      const clearLoadingForThis = () =>
        setLoadingChatId((prev) => (prev === chatId ? null : prev));

      if (websocketManager.isConnected()) {
        const timeoutId = window.setTimeout(() => {
          websocketManager.off('chat', handleChat);
          websocketManager.off('message', handleError);
          clearLoadingForThis();
          apiFetch(`/api/get_chat/${chatId}/`)
            .then((res) => (res.ok ? res.json() : Promise.reject(res)))
            .then(applyChatData)
            .catch(() => {
              setLoadingChatId((prev) => (prev === chatId ? null : prev));
              if (selectedChatIdRef.current === chatId) {
                updateMessages([], chatId);
                setSelectedChatId(chatId);
              }
            });
        }, 10000);

        const handleChat = (
          data: WebSocketMessage & {
            chat_id?: number;
            media?: Chat['media'];
            members?: Chat['members'];
            messages?: Message[];
          },
        ) => {
          if (data.chat_id !== chatId) return;
          window.clearTimeout(timeoutId);
          websocketManager.off('chat', handleChat);
          websocketManager.off('message', handleError);
          applyChatData(data);
        };

        const handleError = (msg: { type?: string }) => {
          if (msg.type !== 'error') return;
          window.clearTimeout(timeoutId);
          websocketManager.off('chat', handleChat);
          websocketManager.off('message', handleError);
          clearLoadingForThis();
          apiFetch(`/api/get_chat/${chatId}/`)
            .then((res) => (res.ok ? res.json() : Promise.reject(res)))
            .then(applyChatData)
            .catch(() => {
              setLoadingChatId((prev) => (prev === chatId ? null : prev));
              if (selectedChatIdRef.current === chatId) {
                updateMessages([], chatId);
                setSelectedChatId(chatId);
              }
            });
        };

        websocketManager.on('chat', handleChat);
        websocketManager.on('message', handleError);
        websocketManager.sendMessage({ type: 'get_chat', chat_id: chatId });
        return;
      }

      try {
        const res = await apiFetch(`/api/get_chat/${chatId}/`);
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const data = await res.json();
        applyChatData(data);
      } catch (err) {
        console.error(err);
        setLoadingChatId((prev) => (prev === chatId ? null : prev));
        if (selectedChatIdRef.current === chatId) {
          updateMessages([], chatId);
          setSelectedChatId(chatId);
        }
      }
    },
    [updateMessages],
  );

  const saveContact = useCallback(
    async (contactId: number, name: string) => {
      if (!selectedChat) return;

      const formData = new FormData();
      formData.append('contact_id', contactId.toString());
      formData.append('name', name);

      const res = await apiFetch('/api/contact/', {
        method: 'PATCH',
        body: formData,
      });

      if (!res.ok) return;

      const updatedMembers = selectedChat.members?.map((u) =>
        u.contact_id === contactId ? { ...u, name } : u,
      );

      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === selectedChat.id
            ? { ...chat, members: updatedMembers, name }
            : chat,
        ),
      );
    },
    [selectedChat],
  );

  const deleteContact = useCallback(
    async (contactId: number) => {
      if (!selectedChatId) return;
      const formData = new FormData();
      formData.append('contact_id', contactId.toString());
      await apiFetch('/api/contact/', {
        method: 'DELETE',
        body: formData,
      });

      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.id !== selectedChatId) return chat;

          if (!chat.members || chat.members.length === 0) return chat;

          const updatedUsers = chat.members.map((u, index) =>
            index === 0 ? { ...u, is_contact: false } : u,
          );

          return {
            ...chat,
            members: updatedUsers,
          };
        }),
      );
    },
    [selectedChatId],
  );

  const addContact = useCallback(
    async (usedId: number) => {
      if (!selectedChatId) return;
      const formData = new FormData();
      formData.append('user_id', usedId.toString());
      const res: unknown = await apiUpload('/api/contact/', formData);
      if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        if (typeof r.error === 'string') {
          setError(r.error);
          return;
        }
      }

      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.id !== selectedChatId) return chat;

          if (!chat.members || chat.members.length === 0) return chat;

          const updatedUsers = chat.members.map((u, index) =>
            index === 0 ? { ...u, is_contact: true } : u,
          );

          return {
            ...chat,
            members: updatedUsers,
          };
        }),
      );
    },
    [selectedChatId],
  );

  const updateChatLastMessage = useCallback(
    (chatId: number, lastMessage: Message | null) => {
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === chatId ? { ...chat, last_message: lastMessage } : chat,
        ),
      );
    },
    [],
  );

  const updateChatUnreadCount = useCallback(
    (chatId: number, unreadCount: number) => {
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === chatId ? { ...chat, unread_count: unreadCount } : chat,
        ),
      );
    },
    [],
  );

  const fetchChats = useCallback(async () => {
    try {
      const isInitialFetch = initialFetchRef.current;
      if (isInitialFetch) initialFetchRef.current = false;
      if (!isInitialFetch) {
        setLoading(true);
      }
      setError(null);

      if (!websocketManager.isConnected()) {
        setLoading(false);
        return;
      }

      const timeoutId = window.setTimeout(() => {
        setLoading(false);
      }, 15000);

      const handleChats = (data: { chats?: unknown[] }) => {
        window.clearTimeout(timeoutId);
        const chatsList = Array.isArray(data.chats)
          ? (data.chats as Chat[])
          : [];
        setChats(chatsList);
        setLoading(false);
        const hashRoomId = location.hash
          ? Number(location.hash.substring(1))
          : null;
        if (hashRoomId) {
          setSelectedChatId(hashRoomId);
          const cached = getCachedMessages(hashRoomId);
          const chat = chatsList.find((c) => c.id === hashRoomId);
          if (chat?.last_message && (!cached || cached.length === 0)) {
            updateMessages([chat.last_message], hashRoomId);
          }
          fetchChat(hashRoomId);
        }
        websocketManager.off('chats', handleChats);
        websocketManager.off('message', handleError);
      };

      const handleError = (msg: { type?: string; message?: string }) => {
        if (msg.type === 'error') {
          window.clearTimeout(timeoutId);
          setError(msg.message ?? 'Unknown error');
          setLoading(false);
          websocketManager.off('chats', handleChats);
          websocketManager.off('message', handleError);
        }
      };

      websocketManager.on('chats', handleChats);
      websocketManager.on('message', handleError);
      websocketManager.sendMessage({ type: 'get_chats' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }, [fetchChat, getCachedMessages, updateMessages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingMessageRef.current) return;
        setSelectedChatId(null);
        setActiveProfileTab(null);
        location.hash = '';
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setActiveProfileTab]);

  useEffect(() => {
    if (!user) return;
    const userId = user.id || getLastUserId();
    if (!userId) return;
    getChatState(userId)
      .then((state) => {
        if (!state) return;
        if (state.chats?.length) setChats(state.chats);
        if (state.selectedChatId != null) {
          setSelectedChatId(state.selectedChatId);
          const hash = state.selectedChatId;
          if (hash !== Number(location.hash.substring(1))) {
            location.hash = String(hash);
          }
          const chat = state.chats?.find((c) => c.id === state.selectedChatId);
          if (chat?.last_message) {
            updateMessages([chat.last_message], state.selectedChatId);
          }
          fetchChat(state.selectedChatId);
        }
        if (
          state.messagesCache &&
          Object.keys(state.messagesCache).length > 0
        ) {
          setInitialMessagesCache(state.messagesCache);
        }
      })
      .catch(() => {});
  }, [user, fetchChat, updateMessages]);

  useEffect(() => {
    if (!user) return;
    const onConnected = () => {
      if (chats.length === 0) {
        fetchChats();
      }
    };
    websocketManager.on('connection_established', onConnected);
    if (websocketManager.isConnected() && chats.length === 0) {
      fetchChats();
    }
    return () => {
      websocketManager.off('connection_established', onConnected);
    };
  }, [user, fetchChats, chats.length]);

  useEffect(() => {
    if (!user?.id || chats.length === 0) return;
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      persistTimeoutRef.current = null;
      setChatState(user.id, {
        chats,
        selectedChatId,
        messagesCache,
        savedAt: '',
      }).catch(() => {});
    }, 500);
    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
    };
  }, [user?.id, chats, selectedChatId, messagesCache]);

  const handleCreateTemporaryChat = useCallback(
    (user: User) => {
      const tempId = Math.min(...chats.map((c) => c.id), 0) - 1;
      const tempChat: Chat = {
        id: tempId,
        info: null,
        name: user.username,
        media: [],
        members: [user],
        last_message: null,
        unread_count: 0,
        type: 'D',
        primary_media: user.profile.primary_media,
      };

      setChats((prev) => [tempChat, ...prev]);

      selectChat(tempId);
    },
    [chats, selectChat],
  );

  const handleChatClick = useCallback(
    (chatId: number) => {
      if (selectedChatIdRef.current === chatId) return;
      selectChat(chatId);
      const cached = getCachedMessages(chatId);
      const chat = chats.find((c) => c.id === chatId);
      if (chat?.last_message && (!cached || cached.length === 0)) {
        updateMessages([chat.last_message], chatId);
      }
      fetchChat(chatId);
    },
    [chats, fetchChat, getCachedMessages, selectChat, updateMessages],
  );

  const valueMeta: ChatMetaContextType = useMemo(
    () => ({
      chats,
      loading,
      error,
      fetchChats,
      fetchChat,
      handleChatClick,
      handleCreateTemporaryChat,
      addContact,
      deleteContact,
      saveContact,
      setChats,
      setLoading,
    }),
    [
      chats,
      loading,
      error,
      fetchChats,
      fetchChat,
      handleChatClick,
      handleCreateTemporaryChat,
      addContact,
      deleteContact,
      saveContact,
      setChats,
      setLoading,
    ],
  );

  const valueSelected: SelectedChatContextType = useMemo(
    () => ({
      selectedChat,
      selectedChatId,
      setSelectedChatId,
    }),
    [selectedChat, selectedChatId],
  );

  const valueMessages: ChatMessagesContextType = useMemo(
    () => ({
      messages,
      messagesCache,
      messagesLoading:
        selectedChatId !== null && loadingChatId === selectedChatId,
      editingMessage,
      setEditingMessage,
      updateMessages,
      updateMessageInChat,
      removeMessageFromChat,
      getCachedMessages,
      updateChatLastMessage,
      updateChatUnreadCount,
      handleNewMessage,
    }),
    [
      messages,
      messagesCache,
      selectedChatId,
      loadingChatId,
      editingMessage,
      setEditingMessage,
      updateMessages,
      updateMessageInChat,
      removeMessageFromChat,
      getCachedMessages,
      updateChatLastMessage,
      updateChatUnreadCount,
      handleNewMessage,
    ],
  );

  const valueMessagesData: MessagesDataContextType = useMemo(
    () => ({
      messages,
      messagesCache,
      getCachedMessages,
    }),
    [messages, messagesCache, getCachedMessages],
  );

  const valueMessagesActions: MessagesActionsContextType = useMemo(
    () => ({
      updateMessages,
      updateMessageInChat,
      removeMessageFromChat,
      updateChatLastMessage,
      updateChatUnreadCount,
      handleNewMessage,
    }),
    [
      updateMessages,
      updateMessageInChat,
      removeMessageFromChat,
      updateChatLastMessage,
      updateChatUnreadCount,
      handleNewMessage,
    ],
  );

  const valueEditing: EditingContextType = useMemo(
    () => ({
      editingMessage,
      setEditingMessage,
    }),
    [editingMessage, setEditingMessage],
  );

  return (
    <ChatMetaContext.Provider value={valueMeta}>
      <SelectedChatContext.Provider value={valueSelected}>
        <MessagesDataContext.Provider value={valueMessagesData}>
          <MessagesActionsContext.Provider value={valueMessagesActions}>
            <EditingContext.Provider value={valueEditing}>
              <ChatMessagesContext.Provider value={valueMessages}>
                {children}
              </ChatMessagesContext.Provider>
            </EditingContext.Provider>
          </MessagesActionsContext.Provider>
        </MessagesDataContext.Provider>
      </SelectedChatContext.Provider>
    </ChatMetaContext.Provider>
  );
};
