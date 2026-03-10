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
import { useSnackbar } from '@/contexts/snackbar/SnackbarContextCore';
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
  const [temporaryChat, setTemporaryChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingChatId, setLoadingChatId] = useState<number | null>(null);
  const [initialMessagesCache, setInitialMessagesCache] = useState<Record<
    number,
    Message[]
  > | null>(null);
  const [loadingOlderChatId, setLoadingOlderChatId] = useState<number | null>(
    null,
  );
  const [loadingNewerChatId, setLoadingNewerChatId] = useState<number | null>(
    null,
  );
  const nextCursorByChatRef = useRef<Record<number, number | null>>({});
  const initialFetchRef = useRef(true);
  const selectedChatIdRef = useRef(selectedChatId);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingMessageRef = useRef<Message | null>(null);
  const pendingChatDeletionRef = useRef<{
    chat: Chat;
    index: number;
    messages: Message[];
    wasSelected: boolean;
    previousHash: string;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);
  /** Guard: server chats already applied — don't overwrite with IDB */
  const hasServerChatsRef = useRef(false);
  selectedChatIdRef.current = selectedChatId;
  const { setActiveProfileTab } = useSettingsActions();
  const { showSnackbar, dismissSnackbar } = useSnackbar();

  const {
    messagesCache,
    messages,
    editingMessage,
    setEditingMessage,
    updateMessages,
    prependMessages,
    appendMessages,
    updateMessageInChat,
    removeMessagesForChat,
    moveMessagesToChat,
    removeMessageFromChat,
    getCachedMessages,
    handleNewMessage,
  } = useMessages({
    selectedChatId,
    setChats,
    initialMessagesCache,
  });

  editingMessageRef.current = editingMessage;

  const selectedChat = useMemo(() => {
    if (
      selectedChatId != null &&
      selectedChatId < 0 &&
      temporaryChat?.id === selectedChatId
    ) {
      return temporaryChat;
    }
    return chats.find((c) => c.id === selectedChatId) ?? null;
  }, [chats, selectedChatId, temporaryChat]);

  const loadOlderMessages = useCallback(
    async (chatId: number): Promise<boolean> => {
      const cursor = nextCursorByChatRef.current[chatId];
      if (cursor === null || cursor === undefined) return false;
      setLoadingOlderChatId(chatId);
      try {
        const res = await apiFetch(
          `/api/get_chat/${chatId}/?cursor=${cursor}&page_size=25`,
        );
        if (!res.ok) return true;
        const data = (await res.json()) as {
          messages?: Message[];
          next_cursor?: number | null;
          media?: Chat['media'];
          members?: Chat['members'];
        };
        if (selectedChatIdRef.current !== chatId) return true;
        if (data.messages?.length) {
          prependMessages(data.messages, chatId);
        }
        if (data.next_cursor !== undefined) {
          nextCursorByChatRef.current[chatId] = data.next_cursor ?? null;
        }
        return true;
      } finally {
        setLoadingOlderChatId((prev) => (prev === chatId ? null : prev));
      }
    },
    [prependMessages],
  );

  const loadNewerMessages = useCallback(
    async (chatId: number): Promise<boolean> => {
      const cached = getCachedMessages(chatId);
      const newestId = cached?.length
        ? (cached[cached.length - 1]?.id as number)
        : undefined;
      if (newestId == null) return false;
      setLoadingNewerChatId(chatId);
      try {
        const res = await apiFetch(
          `/api/get_chat/${chatId}/?cursor_newer=${newestId}&page_size=25`,
        );
        if (!res.ok) return true;
        const data = (await res.json()) as {
          messages?: Message[];
          next_newer_cursor?: number | null;
          media?: Chat['media'];
          members?: Chat['members'];
        };
        if (selectedChatIdRef.current !== chatId) return true;
        if (data.messages?.length) {
          appendMessages(data.messages, chatId, {
            updateChatLastMessage: false,
          });
        }
        return true;
      } finally {
        setLoadingNewerChatId((prev) => (prev === chatId ? null : prev));
      }
    },
    [getCachedMessages, appendMessages],
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

  const finalizePendingChatDeletion = useCallback(() => {
    const pending = pendingChatDeletionRef.current;
    if (!pending) return;
    window.clearTimeout(pending.timeoutId);
    pendingChatDeletionRef.current = null;
    dismissSnackbar();
    websocketManager.sendDeleteChat(pending.chat.id);
  }, [dismissSnackbar]);

  const restorePendingChatDeletion = useCallback(() => {
    const pending = pendingChatDeletionRef.current;
    if (!pending) return;

    window.clearTimeout(pending.timeoutId);
    pendingChatDeletionRef.current = null;
    dismissSnackbar();

    setChats((prevChats) => {
      if (prevChats.some((chat) => chat.id === pending.chat.id)) return prevChats;
      const nextChats = [...prevChats];
      nextChats.splice(Math.min(pending.index, nextChats.length), 0, pending.chat);
      return nextChats;
    });

    updateMessages(pending.messages, pending.chat.id, {
      updateChatLastMessage: false,
    });

    if (pending.wasSelected) {
      setSelectedChatId(pending.chat.id);
      location.hash = pending.previousHash || String(pending.chat.id);
    }
  }, [dismissSnackbar, updateMessages]);

  const trimMessagesToLast = useCallback(
    (chatId: number, keepCount: number) => {
      const cached = getCachedMessages(chatId);
      if (!cached || cached.length <= keepCount) return;
      const trimmed = cached.slice(-keepCount);
      updateMessages(trimmed, chatId, { updateChatLastMessage: false });
      nextCursorByChatRef.current[chatId] = (trimmed[0]?.id ?? null) as
        | number
        | null;
    },
    [getCachedMessages, updateMessages],
  );

  const trimMessagesToRange = useCallback(
    (chatId: number, startIndex: number, endIndex: number) => {
      const cached = getCachedMessages(chatId);
      if (!cached || startIndex < 0 || endIndex >= cached.length) return;
      if (startIndex > endIndex) return;
      const trimmed = cached.slice(startIndex, endIndex + 1);
      if (trimmed.length >= cached.length) return;
      updateMessages(trimmed, chatId, { updateChatLastMessage: false });
      nextCursorByChatRef.current[chatId] = (trimmed[0]?.id ?? null) as
        | number
        | null;
    },
    [getCachedMessages, updateMessages],
  );

  const selectChat = useCallback((chatId: number | null) => {
    setSelectedChatId(chatId);
    // Don't clear editingMessage here — SendArea restores or clears it when chatId changes
  }, []);

  const fetchChat = useCallback(
    async (chatId: number) => {
      setLoadingChatId(chatId);
      const applyChatData = (
        data: {
          media?: Chat['media'];
          members?: Chat['members'];
          messages?: Message[];
          next_cursor?: number | null;
        },
        isPrepend = false,
      ) => {
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
        if (isPrepend && data.messages?.length) {
          prependMessages(data.messages, chatId);
        } else {
          updateMessages(data.messages || [], chatId);
        }
        if (data.next_cursor !== undefined) {
          nextCursorByChatRef.current[chatId] = data.next_cursor ?? null;
        } else if (!isPrepend && data.messages?.length) {
          // Fallback: API may omit next_cursor (e.g. WebSocket); use oldest message id for pagination
          const oldest = data.messages[0];
          nextCursorByChatRef.current[chatId] =
            oldest?.id != null ? (oldest.id as number) : null;
        }
        if (!isPrepend) setSelectedChatId(chatId);
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
            next_cursor?: number | null;
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
    [updateMessages, prependMessages],
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
        hasServerChatsRef.current = true;
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
          if (hashRoomId > 0) {
            fetchChat(hashRoomId);
          }
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
        setTemporaryChat(null);
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
    hasServerChatsRef.current = false;
    getChatState(userId)
      .then((state) => {
        if (!state) return;
        // Apply IDB only if server hasn't responded yet (so we don't overwrite fresh data)
        if (hasServerChatsRef.current) return;
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
          if (state.selectedChatId > 0) {
            fetchChat(state.selectedChatId);
          }
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
      fetchChats();
    };
    websocketManager.on('connection_established', onConnected);
    if (websocketManager.isConnected()) {
      fetchChats();
    }
    return () => {
      websocketManager.off('connection_established', onConnected);
    };
  }, [user, fetchChats]);

  useEffect(() => {
    const handleChatCreated = (
      payload: WebSocketMessage & { temp_chat_id?: number; chat?: unknown },
    ) => {
      const tempChatId = payload.temp_chat_id;
      const createdChat = payload.chat as Chat | undefined;

      if (!createdChat?.id) return;

      setChats((prevChats) => {
        const nextChats = prevChats.filter(
          (chat) => chat.id !== createdChat.id && chat.id !== tempChatId,
        );
        return [createdChat, ...nextChats];
      });

      if (createdChat.last_message) {
        updateMessages([createdChat.last_message], createdChat.id, {
          updateChatLastMessage: false,
        });
      }

      if (typeof tempChatId === 'number') {
        moveMessagesToChat(tempChatId, createdChat.id);
        setTemporaryChat((prev) => (prev?.id === tempChatId ? null : prev));

        if (selectedChatIdRef.current === tempChatId) {
          setSelectedChatId(createdChat.id);
          location.hash = String(createdChat.id);
        }
      }
    };

    websocketManager.on('chat_created', handleChatCreated);
    return () => {
      websocketManager.off('chat_created', handleChatCreated);
    };
  }, [moveMessagesToChat, updateMessages]);

  useEffect(() => {
    const handleChatDeleted = (payload: WebSocketMessage) => {
      const deletedChatId = payload.chat_id;
      if (deletedChatId == null) return;

      if (pendingChatDeletionRef.current?.chat.id === deletedChatId) {
        window.clearTimeout(pendingChatDeletionRef.current.timeoutId);
        pendingChatDeletionRef.current = null;
        dismissSnackbar();
      }

      setChats((prevChats) =>
        prevChats.filter((chat) => chat.id !== deletedChatId),
      );
      removeMessagesForChat(deletedChatId);

      if (selectedChatIdRef.current === deletedChatId) {
        setSelectedChatId(null);
        setTemporaryChat(null);
        location.hash = '';
      }
    };

    websocketManager.on('chat_deleted', handleChatDeleted);
    return () => {
      websocketManager.off('chat_deleted', handleChatDeleted);
    };
  }, [dismissSnackbar, removeMessagesForChat]);

  useEffect(() => {
    if (!user?.id || chats.length === 0) return;
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      persistTimeoutRef.current = null;
      setChatState(user.id, {
        chats,
        selectedChatId:
          selectedChatId != null && selectedChatId > 0 ? selectedChatId : null,
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
      const chatHasUser = (chat: Chat) =>
        Array.isArray(chat.members) &&
        chat.members.some((member) => member.id === user.id);

      const existingChat = chats.find(
        (chat) => chat.type === 'D' && chatHasUser(chat),
      );
      if (existingChat) {
        setTemporaryChat(null);
        window.history.pushState({}, '', `#${existingChat.id}`);
        selectChat(existingChat.id);
        return;
      }

      if (temporaryChat && chatHasUser(temporaryChat)) {
        window.history.pushState({}, '', `#${temporaryChat.id}`);
        selectChat(temporaryChat.id);
        return;
      }

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

      setTemporaryChat(tempChat);
      window.history.pushState({}, '', `#${tempId}`);
      selectChat(tempId);
    },
    [chats, selectChat, temporaryChat],
  );

  const deleteChat = useCallback(
    (chatId: number) => {
      if (chatId < 0) {
        if (temporaryChat?.id === chatId) {
          setTemporaryChat(null);
        }
        if (selectedChatIdRef.current === chatId) {
          setSelectedChatId(null);
          location.hash = '';
        }
        removeMessagesForChat(chatId);
        return;
      }

      const chatToDelete = chats.find((chat) => chat.id === chatId);
      if (!chatToDelete) return;

      if (pendingChatDeletionRef.current) {
        finalizePendingChatDeletion();
      }

      const cachedMessages = getCachedMessages(chatId) ?? [];
      const chatIndex = chats.findIndex((chat) => chat.id === chatId);
      const wasSelected = selectedChatIdRef.current === chatId;
      const previousHash = location.hash.replace(/^#/, '');

      setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));
      removeMessagesForChat(chatId);

      if (wasSelected) {
        setSelectedChatId(null);
        setTemporaryChat(null);
        location.hash = '';
      }

      const timeoutId = window.setTimeout(() => {
        const pending = pendingChatDeletionRef.current;
        if (!pending || pending.chat.id !== chatId) return;
        pendingChatDeletionRef.current = null;
        dismissSnackbar();
        websocketManager.sendDeleteChat(chatId);
      }, 5000);

      pendingChatDeletionRef.current = {
        chat: chatToDelete,
        index: chatIndex,
        messages: cachedMessages,
        wasSelected,
        previousHash,
        timeoutId,
      };

      showSnackbar('Chat deleted', {
        duration: 5000,
        actionLabel: 'Undo',
        onAction: restorePendingChatDeletion,
      });
    },
    [
      chats,
      dismissSnackbar,
      finalizePendingChatDeletion,
      getCachedMessages,
      removeMessagesForChat,
      restorePendingChatDeletion,
      showSnackbar,
      temporaryChat,
    ],
  );

  const handleChatClick = useCallback(
    (chatId: number) => {
      if (selectedChatIdRef.current === chatId) return;
      setTemporaryChat(null);
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
      deleteChat,
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
      deleteChat,
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
      loadingOlderMessages:
        selectedChatId !== null && loadingOlderChatId === selectedChatId,
      loadingNewerMessages:
        selectedChatId !== null && loadingNewerChatId === selectedChatId,
      loadOlderMessages,
      loadNewerMessages,
      trimMessagesToLast,
      trimMessagesToRange,
      editingMessage,
      setEditingMessage,
      updateMessages,
      prependMessages,
      updateMessageInChat,
      removeMessagesForChat,
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
      loadingOlderChatId,
      loadingNewerChatId,
      loadOlderMessages,
      loadNewerMessages,
      trimMessagesToLast,
      trimMessagesToRange,
      editingMessage,
      setEditingMessage,
      updateMessages,
      prependMessages,
      updateMessageInChat,
      removeMessagesForChat,
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
      prependMessages,
      updateMessageInChat,
      removeMessagesForChat,
      removeMessageFromChat,
      updateChatLastMessage,
      updateChatUnreadCount,
      handleNewMessage,
    }),
    [
      updateMessages,
      prependMessages,
      updateMessageInChat,
      removeMessagesForChat,
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
