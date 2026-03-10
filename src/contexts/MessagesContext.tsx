import React, { useReducer } from 'react';
import type { Message } from '@/types';
import { MessagesContext, messagesReducer, initialState } from './messagesCore';
import type { MessagesContextType } from './messagesCore';

export const MessagesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(messagesReducer, initialState);

  const getChatMessages = (chatId: number): Message[] => {
    return state.messages[chatId] || [];
  };

  const addMessage = (chatId: number, message: Message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: { chatId, message } });
  };

  const updateMessage = (
    chatId: number,
    messageId: number,
    updates: Partial<Message>,
  ) => {
    dispatch({
      type: 'UPDATE_MESSAGE',
      payload: { chatId, messageId, updates },
    });
  };

  const deleteMessage = (chatId: number, messageId: number) => {
    dispatch({ type: 'DELETE_MESSAGE', payload: { chatId, messageId } });
  };

  const likeMessage = (chatId: number, messageId: number) => {
    dispatch({ type: 'LIKE_MESSAGE', payload: { chatId, messageId } });
  };

  const loadMessages = (chatId: number, messages: Message[]) => {
    dispatch({ type: 'LOAD_MESSAGES', payload: { chatId, messages } });
  };

  const value: MessagesContextType = {
    state,
    dispatch,
    getChatMessages,
    addMessage,
    updateMessage,
    deleteMessage,
    likeMessage,
    loadMessages,
  };

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
};
