import React, {
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import type { Message, Chat, User } from '@/types';
import { apiFetch } from '@/utils/apiFetch';
import { websocketManager } from '@/utils/websocket-manager';
import type { WebSocketMessage } from '@/utils/websocket-manager';
import { useSettingsActions } from './settings/context';
import {
  getChatState,
  setChatState,
  getLastUserId,
} from '@/utils/chatStateStorage';
import { useSnackbar } from '@/contexts/snackbar/SnackbarContextCore';
import { useTranslation } from '@/contexts/languageCore';
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
  const [chatStateReady, setChatStateReady] = useState(false);
  const [initialWsChatLoadAnimation, setInitialWsChatLoadAnimation] = useState<{
    chatId: number;
    messageIds: number[];
    token: number;
  } | null>(null);
  const nextCursorByChatRef = useRef<Record<number, number | null>>({});
  const wsGetChatRequestedOnceRef = useRef<Record<number, boolean>>({});
  const wsInitialAnimationPendingRef = useRef<Record<number, boolean>>({});
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
  const { t } = useTranslation();

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

  const requestChatViaWs = useCallback(
    async (
      chatId: number,
      options?: {
        cursor?: number;
        cursor_newer?: number;
        page_size?: number;
        timeoutMs?: number;
      },
    ) => {
      await websocketManager.waitForConnection();
      return new Promise<{
        chat_id?: number;
        media?: Chat['media'];
        members?: Chat['members'];
        messages?: Message[];
        next_cursor?: number | null;
        next_newer_cursor?: number | null;
      }>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          cleanup();
          reject(new Error('get_chat timeout'));
        }, options?.timeoutMs ?? 10000);

        const cleanup = () => {
          window.clearTimeout(timeoutId);
          websocketManager.off('chat', handleChat);
        };

        const handleChat = (
          data: WebSocketMessage & {
            chat_id?: number;
            media?: unknown;
            members?: unknown;
            messages?: unknown[];
            next_cursor?: number | null;
            next_newer_cursor?: number | null;
          },
        ) => {
          if (data.chat_id !== chatId) return;
          cleanup();
          resolve({
            chat_id: data.chat_id,
            media: data.media as Chat['media'] | undefined,
            members: data.members as Chat['members'] | undefined,
            messages: data.messages as Message[] | undefined,
            next_cursor: data.next_cursor ?? null,
            next_newer_cursor: data.next_newer_cursor ?? null,
          });
        };

        websocketManager.on('chat', handleChat);
        const sent = websocketManager.sendMessage({
          type: 'get_chat',
          chat_id: chatId,
          cursor: options?.cursor,
          cursor_newer: options?.cursor_newer,
          page_size: options?.page_size ?? 25,
        });
        if (!sent) {
          cleanup();
          reject(new Error('WebSocket not connected'));
        }
      });
    },
    [],
  );

  const loadOlderMessages = useCallback(
    async (chatId: number): Promise<boolean> => {
      const cursor = nextCursorByChatRef.current[chatId];
      if (cursor === null || cursor === undefined) return false;
      setLoadingOlderChatId(chatId);
      try {
        const data = (await requestChatViaWs(chatId, {
          cursor,
          page_size: 25,
        })) as {
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
    [prependMessages, requestChatViaWs],
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
        const data = (await requestChatViaWs(chatId, {
          cursor_newer: newestId,
          page_size: 25,
        })) as {
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
    [getCachedMessages, appendMessages, requestChatViaWs],
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
      if (prevChats.some((chat) => chat.id === pending.chat.id))
        return prevChats;
      const nextChats = [...prevChats];
      nextChats.splice(
        Math.min(pending.index, nextChats.length),
        0,
        pending.chat,
      );
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
    selectedChatIdRef.current = chatId;
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
          if (wsInitialAnimationPendingRef.current[chatId]) {
            delete wsInitialAnimationPendingRef.current[chatId];
            const messageIds = (data.messages ?? [])
              .map((m) => m.id)
              .filter((id): id is number => typeof id === 'number');
            if (messageIds.length > 0) {
              setInitialWsChatLoadAnimation({
                chatId,
                messageIds,
                token: Date.now(),
              });
            }
          }
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

      try {
        if (selectedChatIdRef.current !== chatId) {
          setLoadingChatId((prev) => (prev === chatId ? null : prev));
          return;
        }
        if (!wsGetChatRequestedOnceRef.current[chatId]) {
          wsGetChatRequestedOnceRef.current[chatId] = true;
          const cached = getCachedMessages(chatId);
          const hasCache = !!(cached && cached.length > 0);
          if (!hasCache) {
            wsInitialAnimationPendingRef.current[chatId] = true;
          }
        }

        const data = await requestChatViaWs(chatId, { page_size: 25 });
        applyChatData(data);
      } catch (err) {
        console.error(err);
        delete wsInitialAnimationPendingRef.current[chatId];
        setLoadingChatId((prev) => (prev === chatId ? null : prev));
        if (selectedChatIdRef.current === chatId) {
          updateMessages([], chatId);
          setSelectedChatId(chatId);
        }
      }
    },
    [updateMessages, prependMessages, getCachedMessages, requestChatViaWs],
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
    (userId: number) => {
      if (!selectedChatId) return;

      if (!websocketManager.isConnected()) {
        setError('Not connected');
        return;
      }

      const chatId = selectedChatId;
      let settled = false;

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        websocketManager.off('message', onMessage);
      };

      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
      };

      const onMessage = (data: WebSocketMessage) => {
        if (data.type === 'contact_added') {
          const uid = (data as { user_id?: number }).user_id;
          if (uid !== userId) return;
          finish();
          const contactId = (data as { contact_id?: number }).contact_id;
          const contactName = (data as { name?: string }).name;
          setChats((prevChats) =>
            prevChats.map((chat) => {
              if (chat.id !== chatId) return chat;
              if (!chat.members || chat.members.length === 0) return chat;
              const updatedUsers = chat.members.map((u, index) =>
                index === 0
                  ? {
                      ...u,
                      is_contact: true,
                      ...(contactId != null ? { contact_id: contactId } : {}),
                      ...(contactName != null && contactName !== ''
                        ? { name: contactName }
                        : {}),
                    }
                  : u,
              );
              return { ...chat, members: updatedUsers };
            }),
          );
          return;
        }
        if (data.type === 'error' && typeof data.message === 'string') {
          finish();
          setError(data.message);
        }
      };

      const timeoutId = window.setTimeout(() => {
        finish();
        setError('Request timed out');
      }, 15000);

      websocketManager.on('message', onMessage);
      const sent = websocketManager.sendAddContact(userId);
      if (!sent) {
        finish();
        setError('Failed to send');
      }
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
    if (!user) {
      setChatStateReady(false);
      return;
    }
    const userId = user.id || getLastUserId();
    if (!userId) {
      setChatStateReady(true);
      return;
    }
    setChatStateReady(false);
    hasServerChatsRef.current = false;
    getChatState(userId)
      .then((state) => {
        if (!state) return;
        // Apply IDB only if server hasn't responded yet (so we don't overwrite fresh data)
        if (hasServerChatsRef.current) return;
        if (
          state.messagesCache &&
          Object.keys(state.messagesCache).length > 0
        ) {
          setInitialMessagesCache(state.messagesCache);
        }
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
      })
      .catch(() => {})
      .finally(() => {
        setChatStateReady(true);
      });
  }, [user, fetchChat, updateMessages]);

  useEffect(() => {
    if (!user || !chatStateReady) return;
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
  }, [user, chatStateReady, fetchChats]);

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
    const handleGroupMembersUpdated = (
      payload: WebSocketMessage & {
        chat_id?: number;
        members?: unknown;
        users_count?: number;
        chat?: unknown;
      },
    ) => {
      const chatId = payload.chat_id;
      if (chatId == null) return;
      const members = payload.members as User[] | undefined;
      const usersCount = payload.users_count;
      const listRow = payload.chat as Chat | undefined;

      setChats((prev) => {
        const exists = prev.some((c) => c.id === chatId);
        if (listRow && !exists) {
          return [listRow, ...prev.filter((c) => c.id !== chatId)];
        }
        if (!members) return prev;
        return prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                members,
                info: usersCount != null ? String(usersCount) : c.info,
              }
            : c,
        );
      });
    };

    websocketManager.on('group_members_updated', handleGroupMembersUpdated);
    return () => {
      websocketManager.off('group_members_updated', handleGroupMembersUpdated);
    };
  }, []);

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
      const dmChatMatchesUser = (chat: Chat) => {
        if (chat.type !== 'D') return false;
        if (chat.peer_user_id != null && chat.peer_user_id === user.id) {
          return true;
        }
        return (
          Array.isArray(chat.members) &&
          chat.members.some((member) => member.id === user.id)
        );
      };

      const existingChat = chats.find((chat) => dmChatMatchesUser(chat));
      if (existingChat) {
        setTemporaryChat(null);
        window.history.pushState({}, '', `#${existingChat.id}`);
        selectChat(existingChat.id);
        const cached = getCachedMessages(existingChat.id);
        if (existingChat.last_message && (!cached || cached.length === 0)) {
          updateMessages([existingChat.last_message], existingChat.id);
        }
        void fetchChat(existingChat.id);
        return;
      }

      if (temporaryChat && dmChatMatchesUser(temporaryChat)) {
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
        primary_media: user.profile?.primary_media,
        peer_user_id: user.id,
      };

      setTemporaryChat(tempChat);
      window.history.pushState({}, '', `#${tempId}`);
      selectChat(tempId);
    },
    [
      chats,
      fetchChat,
      getCachedMessages,
      selectChat,
      temporaryChat,
      updateMessages,
    ],
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

      showSnackbar(t('chat.chatDeleted'), {
        duration: 5000,
        actionLabel: t('buttons.undo'),
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
      t,
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
      initialWsChatLoadAnimation,
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
      initialWsChatLoadAnimation,
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
