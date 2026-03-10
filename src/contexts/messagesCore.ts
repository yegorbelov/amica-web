import React, { createContext, useContext } from 'react';
import type { Message } from '@/types';

export interface MessagesState {
  messages: { [chatId: number]: Message[] };
  loading: boolean;
  error: string | null;
}

export type MessagesAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LOAD_MESSAGES'; payload: { chatId: number; messages: Message[] } }
  | { type: 'ADD_MESSAGE'; payload: { chatId: number; message: Message } }
  | {
      type: 'UPDATE_MESSAGE';
      payload: { chatId: number; messageId: number; updates: Partial<Message> };
    }
  | { type: 'DELETE_MESSAGE'; payload: { chatId: number; messageId: number } }
  | { type: 'LIKE_MESSAGE'; payload: { chatId: number; messageId: number } };

export const initialState: MessagesState = {
  messages: {},
  loading: false,
  error: null,
};

export const messagesReducer = (
  state: MessagesState,
  action: MessagesAction,
): MessagesState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'LOAD_MESSAGES':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.chatId]: action.payload.messages,
        },
      };

    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.chatId]: [
            ...(state.messages[action.payload.chatId] || []),
            action.payload.message,
          ],
        },
      };

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.chatId]: (
            state.messages[action.payload.chatId] || []
          ).map((msg) =>
            msg.id === action.payload.messageId
              ? { ...msg, ...action.payload.updates }
              : msg,
          ),
        },
      };

    case 'DELETE_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.chatId]: (
            state.messages[action.payload.chatId] || []
          ).filter((msg) => msg.id !== action.payload.messageId),
        },
      };

    case 'LIKE_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.chatId]: (
            state.messages[action.payload.chatId] || []
          ).map((msg) =>
            msg.id === action.payload.messageId
              ? { ...msg, liked: msg.liked + 1 }
              : msg,
          ),
        },
      };

    default:
      return state;
  }
};

export interface MessagesContextType {
  state: MessagesState;
  dispatch: React.Dispatch<MessagesAction>;
  getChatMessages: (chatId: number) => Message[];
  addMessage: (chatId: number, message: Message) => void;
  updateMessage: (
    chatId: number,
    messageId: number,
    updates: Partial<Message>,
  ) => void;
  deleteMessage: (chatId: number, messageId: number) => void;
  likeMessage: (chatId: number, messageId: number) => void;
  loadMessages: (chatId: number, messages: Message[]) => void;
}

export const MessagesContext = createContext<MessagesContextType | undefined>(
  undefined,
);

export const useMessages = (): MessagesContextType => {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
};
