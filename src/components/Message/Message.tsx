import React, { useRef, useMemo } from 'react';
import type { Message as MessageType } from '@/types';
import styles from './Message.module.scss';
import { useMessageDimensions } from './useMessageDimensions';
import MessageContent from './MessageContent';
import { Icon } from '../Icons/AutoIcons';

export interface MessageProps {
  message: MessageType;
  reelItems?: MessageType[];
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

const Message: React.FC<MessageProps> = ({
  message,
  reelItems,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useMessageDimensions(containerRef);

  const isOwn = message.is_own;
  const hasOnlyMediaFiles = useMemo(
    () =>
      Array.isArray(message.files) &&
      message.files.length > 0 &&
      message.files.every(
        (file) => file.category === 'image' || file.category === 'video',
      ),
    [message.files],
  );

  return (
    <div
      className={`temp_full ${isOwn ? 'own-message' : 'other-message'} ${selectionMode && isSelected ? 'selected' : ''}`}
      data-message-id={message.id}
      onClick={selectionMode ? onToggleSelect : undefined}
      role={selectionMode ? 'button' : undefined}
      tabIndex={selectionMode ? 0 : undefined}
      onKeyDown={
        selectionMode && onToggleSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggleSelect();
              }
            }
          : undefined
      }
    >
      {selectionMode && (
        <span className="message_select_check" aria-hidden>
          <Icon name={isSelected ? 'Select' : 'Circle'} />
        </span>
      )}
      <div
        ref={containerRef}
        className={`${styles.message_div} ${isOwn ? `${styles.darker} ${styles.right}` : ''} ${selectionMode ? styles.selected_prepare : ''}`}
      >
        <MessageContent
          message={message}
          reelItems={reelItems}
          isOwn={isOwn}
          hasOnlyMediaFiles={hasOnlyMediaFiles}
        />
      </div>
    </div>
  );
};

export default React.memo(Message);
