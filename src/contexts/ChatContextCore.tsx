import { createContext, useContext } from 'react';
import type { Message, Chat, User } from '@/types';
import type { WebSocketMessage } from '@/utils/websocket-manager';

/** Context for chat list, loading – use when you don't need selection or messages */
export interface ChatMetaContextType {
  chats: Chat[];
  loading: boolean;
  error: string | null;
  fetchChats: () => Promise<void>;
  fetchChat: (chatId: number) => Promise<void>;
  handleChatClick: (chatId: number) => void;
  handleCreateTemporaryChat: (user: User) => void;
  deleteChat: (chatId: number) => void;
  addContact: (userId: number) => void;
  deleteContact: (contactId: number) => void;
  saveContact: (contactId: number, name: string) => void;
  setChats: (chats: Chat[]) => void;
  setLoading: (loading: boolean) => void;
}

/** Context for selected chat only – use when you only need selection. Reduces re-renders on chat click. */
export interface SelectedChatContextType {
  selectedChat: Chat | null;
  selectedChatId: number | null;
  setSelectedChatId: (chatId: number | null) => void;
}

/** Message list data – changes when messages/editing change. Use only where you need to render the list. */
export interface MessagesDataContextType {
  messages: Message[];
  messagesCache: { [roomId: number]: Message[] };
  getCachedMessages: (roomId: number) => Message[] | null;
}

/** Message actions – stable references. Use in SendArea etc. to avoid re-renders when one message is updated. */
export interface MessagesActionsContextType {
  updateMessages: (
    messages: Message[],
    chatId: number,
    options?: { updateChatLastMessage?: boolean },
  ) => void;
  prependMessages: (messages: Message[], chatId: number) => void;
  updateMessageInChat: (
    chatId: number,
    messageId: number,
    updates: Partial<Message>,
  ) => void;
  removeMessagesForChat: (chatId: number) => void;
  removeMessageFromChat: (chatId: number, messageId: number) => void;
  updateChatLastMessage: (chatId: number, lastMessage: Message | null) => void;
  updateChatUnreadCount: (chatId: number, unreadCount: number) => void;
  handleNewMessage: (data: WebSocketMessage) => void;
}

/** Editing state – changes only when user starts/stops editing a message. */
export interface EditingContextType {
  editingMessage: Message | null;
  setEditingMessage: (message: Message | null) => void;
}

/** Full messages context – use when you need both data and actions. Re-renders on any message change. */
export interface ChatMessagesContextType {
  messages: Message[];
  messagesCache: { [roomId: number]: Message[] };
  messagesLoading: boolean;
  loadingOlderMessages: boolean;
  loadingNewerMessages: boolean;
  loadOlderMessages: (chatId: number) => Promise<boolean>;
  loadNewerMessages: (chatId: number) => Promise<boolean>;
  trimMessagesToLast: (chatId: number, keepCount: number) => void;
  trimMessagesToRange: (
    chatId: number,
    startIndex: number,
    endIndex: number,
  ) => void;
  editingMessage: Message | null;
  setEditingMessage: (message: Message | null) => void;
  updateMessages: (
    messages: Message[],
    chatId: number,
    options?: { updateChatLastMessage?: boolean },
  ) => void;
  prependMessages: (messages: Message[], chatId: number) => void;
  updateMessageInChat: (
    chatId: number,
    messageId: number,
    updates: Partial<Message>,
  ) => void;
  removeMessagesForChat: (chatId: number) => void;
  removeMessageFromChat: (chatId: number, messageId: number) => void;
  getCachedMessages: (roomId: number) => Message[] | null;
  updateChatLastMessage: (chatId: number, lastMessage: Message | null) => void;
  updateChatUnreadCount: (chatId: number, unreadCount: number) => void;
  handleNewMessage: (data: WebSocketMessage) => void;
}

export type ChatContextType = ChatMetaContextType &
  SelectedChatContextType &
  ChatMessagesContextType;

export const ChatMetaContext = createContext<ChatMetaContextType | undefined>(
  undefined,
);

export const SelectedChatContext = createContext<
  SelectedChatContextType | undefined
>(undefined);

export const MessagesDataContext = createContext<
  MessagesDataContextType | undefined
>(undefined);

export const MessagesActionsContext = createContext<
  MessagesActionsContextType | undefined
>(undefined);

export const EditingContext = createContext<EditingContextType | undefined>(
  undefined,
);

export const ChatMessagesContext = createContext<
  ChatMessagesContextType | undefined
>(undefined);

/** Use when component only needs chat list / loading. Does not re-render on selection change. */
export const useChatMeta = (): ChatMetaContextType => {
  const context = useContext(ChatMetaContext);
  if (context === undefined) {
    throw new Error('useChatMeta must be used within a ChatProvider');
  }
  return context;
};

/** Use when component only needs selected chat. Re-renders only when selection changes. */
export const useSelectedChat = (): SelectedChatContextType => {
  const context = useContext(SelectedChatContext);
  if (context === undefined) {
    throw new Error('useSelectedChat must be used within a ChatProvider');
  }
  return context;
};

/** Use when component needs to render the message list. Re-renders when messages change. */
export const useMessagesData = (): MessagesDataContextType => {
  const context = useContext(MessagesDataContext);
  if (context === undefined) {
    throw new Error('useMessagesData must be used within a ChatProvider');
  }
  return context;
};

/** Use when component only needs message actions (update, remove, etc.). Stable refs – no re-render when one message is edited. */
export const useMessagesActions = (): MessagesActionsContextType => {
  const context = useContext(MessagesActionsContext);
  if (context === undefined) {
    throw new Error('useMessagesActions must be used within a ChatProvider');
  }
  return context;
};

/** Use when component needs editing state. Re-renders only when editingMessage changes. */
export const useEditing = (): EditingContextType => {
  const context = useContext(EditingContext);
  if (context === undefined) {
    throw new Error('useEditing must be used within a ChatProvider');
  }
  return context;
};

/** Use when component needs both messages data and actions. Re-renders on any message/editing change. */
export const useChatMessages = (): ChatMessagesContextType => {
  const context = useContext(ChatMessagesContext);
  if (context === undefined) {
    throw new Error('useChatMessages must be used within a ChatProvider');
  }
  return context;
};

/** Use when component needs both meta and messages. Re-renders on any chat or message change. */
export const useChat = (): ChatContextType => {
  const meta = useContext(ChatMetaContext);
  const selected = useContext(SelectedChatContext);
  const messages = useContext(ChatMessagesContext);
  if (meta === undefined || selected === undefined || messages === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return { ...meta, ...selected, ...messages };
};
