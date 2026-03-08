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
  onPointerSelectStart?: (pointerId: number) => void;
  onSelectionGestureCandidateStart?: (
    pointerId: number,
    clientX: number,
    clientY: number,
  ) => void;
}

const Message: React.FC<MessageProps> = ({
  message,
  reelItems,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  onPointerSelectStart,
  onSelectionGestureCandidateStart,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressSelectionClickRef = useRef(false);
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
      className={`temp_full ${isOwn ? 'own-message' : 'other-message'} ${selectionMode && isSelected ? 'selected' : ''} ${selectionMode ? 'selection-mode' : ''}`}
      data-message-id={message.id}
      onPointerDown={
        (e) => {
          if (!selectionMode && e.pointerType === 'mouse' && e.button === 0) {
            onSelectionGestureCandidateStart?.(
              e.pointerId,
              e.clientX,
              e.clientY,
            );
            return;
          }
          if (!selectionMode) return;
          if (e.pointerType === 'touch') return;
          e.preventDefault();
          suppressSelectionClickRef.current = true;
          onPointerSelectStart?.(e.pointerId);
        }
      }
      onClick={
        selectionMode && onToggleSelect
          ? () => {
              if (suppressSelectionClickRef.current) {
                suppressSelectionClickRef.current = false;
                return;
              }
              onToggleSelect();
            }
          : undefined
      }
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
