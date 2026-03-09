import {
  useCallback,
  useState,
  useEffect,
  useRef,
  startTransition,
} from 'react';
import type { Message, Chat } from '@/types';
import type { WebSocketMessage } from '@/utils/websocket-manager';
import { websocketManager } from '@/utils/websocket-manager';

export interface UseMessagesParams {
  selectedChatId: number | null;
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  /** From IDB hydration; applied once when set */
  initialMessagesCache?: Record<number, Message[]> | null;
}

export interface UseMessagesReturn {
  messagesCache: { [roomId: number]: Message[] };
  messages: Message[];
  editingMessage: Message | null;
  setEditingMessage: (message: Message | null) => void;
  updateMessages: (
    messages: Message[],
    chatId: number,
    options?: { updateChatLastMessage?: boolean },
  ) => void;
  prependMessages: (messages: Message[], chatId: number) => void;
  appendMessages: (
    messages: Message[],
    chatId: number,
    options?: { updateChatLastMessage?: boolean },
  ) => void;
  updateMessageInChat: (
    chatId: number,
    messageId: number,
    updates: Partial<Message>,
  ) => void;
  removeMessagesForChat: (chatId: number) => void;
  moveMessagesToChat: (fromChatId: number, toChatId: number) => void;
  removeMessageFromChat: (chatId: number, messageId: number) => void;
  getCachedMessages: (roomId: number) => Message[] | null;
  handleNewMessage: (data: WebSocketMessage) => void;
}

export function useMessages({
  selectedChatId,
  setChats,
  initialMessagesCache,
}: UseMessagesParams): UseMessagesReturn {
  const [messagesCache, setMessagesCache] = useState<{
    [roomId: number]: Message[];
  }>({});
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  const messagesCacheRef = useRef(messagesCache);
  const appliedInitialRef = useRef(false);

  useEffect(() => {
    messagesCacheRef.current = messagesCache;
  }, [messagesCache]);

  useEffect(() => {
    if (
      appliedInitialRef.current ||
      !initialMessagesCache ||
      Object.keys(initialMessagesCache).length === 0
    )
      return;
    appliedInitialRef.current = true;
    startTransition(() => {
      setMessagesCache(initialMessagesCache);
    });
  }, [initialMessagesCache]);

  const messages = selectedChatId ? (messagesCache[selectedChatId] ?? []) : [];

  const handleNewMessage = useCallback(
    (data: WebSocketMessage) => {
      if (data.type === 'chat_message' && data.chat_id && data.data) {
        const roomId = data.chat_id;
        const newMessage = data.data as unknown as Message;

        setChats((prevChats) =>
          prevChats.map((chat) =>
            chat.id === roomId ? { ...chat, last_message: newMessage } : chat,
          ),
        );

        setMessagesCache((prevCache) => {
          const existingMessages = prevCache[roomId] || [];
          const isDuplicate = existingMessages.some(
            (msg) => msg.id === newMessage.id,
          );
          if (isDuplicate) return prevCache;
          return {
            ...prevCache,
            [roomId]: [...existingMessages, newMessage],
          };
        });
      }
    },
    [setChats],
  );

  useEffect(() => {
    websocketManager.on('chat_message', handleNewMessage);
    return () => {
      websocketManager.off('chat_message', handleNewMessage);
    };
  }, [handleNewMessage]);

  const updateMessages = useCallback(
    (
      newMessages: Message[],
      chatId: number,
      options?: { updateChatLastMessage?: boolean },
    ) => {
      setMessagesCache((prev) => ({
        ...prev,
        [chatId]: newMessages,
      }));

      const shouldUpdateChatLastMessage =
        options?.updateChatLastMessage !== false;
      if (newMessages.length > 0 && shouldUpdateChatLastMessage) {
        const lastMessage = newMessages[newMessages.length - 1];
        setChats((prevChats) => {
          const targetChat = prevChats.find((chat) => chat.id === chatId);
          if (!targetChat) return prevChats;
          const currentLastMessage = targetChat.last_message;
          const shouldUpdate =
            !currentLastMessage || lastMessage.id !== currentLastMessage.id;
          if (!shouldUpdate) return prevChats;
          return prevChats.map((chat) =>
            chat.id === chatId ? { ...chat, last_message: lastMessage } : chat,
          );
        });
      }
    },
    [setChats],
  );

  const prependMessages = useCallback(
    (olderMessages: Message[], chatId: number) => {
      if (olderMessages.length === 0) return;
      setMessagesCache((prev) => {
        const existing = prev[chatId] ?? [];
        const existingIds = new Set(existing.map((m) => String(m.id)));
        const newOnes = olderMessages.filter(
          (m) => !existingIds.has(String(m.id)),
        );
        if (newOnes.length === 0) return prev;
        return {
          ...prev,
          [chatId]: [...newOnes, ...existing],
        };
      });
    },
    [],
  );

  const appendMessages = useCallback(
    (
      newerMessages: Message[],
      chatId: number,
      options?: { updateChatLastMessage?: boolean },
    ) => {
      if (newerMessages.length === 0) return;
      setMessagesCache((prev) => {
        const existing = prev[chatId] ?? [];
        const existingIds = new Set(existing.map((m) => String(m.id)));
        const newOnes = newerMessages.filter(
          (m) => !existingIds.has(String(m.id)),
        );
        if (newOnes.length === 0) return prev;
        return {
          ...prev,
          [chatId]: [...existing, ...newOnes],
        };
      });
      const shouldUpdateChatLastMessage =
        options?.updateChatLastMessage !== false;
      if (!shouldUpdateChatLastMessage) return;
      const lastMessage = newerMessages[newerMessages.length - 1];
      setChats((prevChats) => {
        const targetChat = prevChats.find((chat) => chat.id === chatId);
        if (!targetChat) return prevChats;
        const currentLastMessage = targetChat.last_message;
        const shouldUpdate =
          !currentLastMessage || lastMessage.id !== currentLastMessage.id;
        if (!shouldUpdate) return prevChats;
        return prevChats.map((chat) =>
          chat.id === chatId ? { ...chat, last_message: lastMessage } : chat,
        );
      });
    },
    [setChats],
  );

  const updateMessageInChat = useCallback(
    (chatId: number, messageId: number, updates: Partial<Message>) => {
      const mid = Number(messageId);
      setMessagesCache((prev) => {
        const list = prev[chatId] ?? [];
        const newList = list.map((m) =>
          Number(m.id) === mid ? { ...m, ...updates } : m,
        );
        return { ...prev, [chatId]: newList };
      });
    },
    [],
  );

  const moveMessagesToChat = useCallback((fromChatId: number, toChatId: number) => {
    if (fromChatId === toChatId) return;

    setMessagesCache((prev) => {
      const fromMessages = prev[fromChatId] ?? [];
      const toMessages = prev[toChatId] ?? [];

      const mergedMessages = [...toMessages];
      const existingIds = new Set(mergedMessages.map((message) => message.id));

      for (const message of fromMessages) {
        if (existingIds.has(message.id)) continue;
        mergedMessages.push(message);
      }

      const nextCache = { ...prev };
      delete nextCache[fromChatId];
      nextCache[toChatId] = mergedMessages;

      return nextCache;
    });
  }, []);

  const removeMessagesForChat = useCallback((chatId: number) => {
    setMessagesCache((prev) => {
      if (!(chatId in prev)) return prev;
      const nextCache = { ...prev };
      delete nextCache[chatId];
      return nextCache;
    });
  }, []);

  const removeMessageFromChat = useCallback(
    (chatId: number, messageId: number) => {
      const mid = Number(messageId);
      if (!Number.isFinite(mid)) return;
      setMessagesCache((prev) => {
        const list = prev[chatId] ?? [];
        const newList = list.filter((m) => {
          const id = Number(m.id);
          return Number.isFinite(id) ? id !== mid : true;
        });
        if (newList.length === list.length) return prev;
        const result = { ...prev, [chatId]: newList };
        setChats((prevChats) => {
          const targetChat = prevChats.find((c) => c.id === chatId);
          if (
            !targetChat?.last_message ||
            Number(targetChat.last_message.id) !== mid
          )
            return prevChats;
          const newLast =
            newList.length > 0 ? newList[newList.length - 1] : null;
          return prevChats.map((chat) =>
            chat.id === chatId ? { ...chat, last_message: newLast } : chat,
          );
        });
        return result;
      });
    },
    [setChats],
  );

  const handleMessageUpdated = useCallback(
    (data: WebSocketMessage) => {
      if (
        data.type === 'message_updated' &&
        data.chat_id != null &&
        data.data
      ) {
        const roomId = data.chat_id;
        const updatedMessage = data.data as unknown as Message;
        if (updatedMessage.is_deleted) {
          removeMessageFromChat(roomId, updatedMessage.id);
          return;
        }
        updateMessageInChat(roomId, updatedMessage.id, updatedMessage);
      }
    },
    [updateMessageInChat, removeMessageFromChat],
  );

  useEffect(() => {
    websocketManager.on('message_updated', handleMessageUpdated);
    return () => {
      websocketManager.off('message_updated', handleMessageUpdated);
    };
  }, [handleMessageUpdated]);

  const handleMessageDeleted = useCallback(
    (data: WebSocketMessage) => {
      if (
        data.type === 'message_deleted' &&
        data.chat_id != null &&
        data.message_id != null
      ) {
        removeMessageFromChat(data.chat_id, data.message_id);
      }
    },
    [removeMessageFromChat],
  );

  useEffect(() => {
    websocketManager.on('message_deleted', handleMessageDeleted);
    return () => {
      websocketManager.off('message_deleted', handleMessageDeleted);
    };
  }, [handleMessageDeleted]);

  const getCachedMessages = useCallback((roomId: number) => {
    return messagesCacheRef.current[roomId] || null;
  }, []);

  return {
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
  };
}
