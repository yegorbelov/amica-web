import { memo, useRef } from 'react';

export const ChatListLoading = memo(function ChatListLoading() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className='loading_chats_container' ref={ref}>
      <div className='loading-text'>Loading chats...</div>
    </div>
  );
});

export const ChatListError = memo(function ChatListError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className='error-container'>
      <div className='error-message'>{message}</div>
      <button type='button' onClick={onRetry} className='retry-button'>
        Try Again
      </button>
    </div>
  );
});

export const ChatListEmpty = memo(function ChatListEmpty({
  text = 'No chats',
}: {
  text?: string;
  showRefresh?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className='no-chats'>
      <div className='no-chats-text'>{text}</div>
    </div>
  );
});
