import React, { useRef, useMemo, type CSSProperties } from 'react';
import type { Message as MessageType } from '@/types';
import styles from './Message.module.scss';
import { useMessageDimensions } from './useMessageDimensions';
import MessageContent from './MessageContent';
import { Icon } from '../Icons/AutoIcons';

export interface MessageProps {
  message: MessageType;
  reelItems?: MessageType[];
  onReactionClick?: (message: MessageType, reactionType: string) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onPointerSelectStart?: (pointerId: number) => void;
  onSelectionGestureCandidateStart?: (
    pointerId: number,
    clientX: number,
    clientY: number,
  ) => void;
  /** In a same-sender group: false when there is a newer message from same sender (below in list) */
  isFirstInGroup?: boolean;
  /** In a same-sender group: false when there is an older message from same sender (above in list) */
  isLastInGroup?: boolean;
  /** Delay for initial appear animation (ms) */
  appearDelayMs?: number;
}

const Message: React.FC<MessageProps> = ({
  message,
  reelItems,
  onReactionClick,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  onPointerSelectStart,
  onSelectionGestureCandidateStart,
  isFirstInGroup = true,
  isLastInGroup = true,
  appearDelayMs,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressSelectionClickRef = useRef(false);
  const lastPointerTapRef = useRef<{
    ts: number;
    x: number;
    y: number;
    pointerType: string;
  } | null>(null);
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

  const messageDivStyle: CSSProperties | undefined =
    typeof appearDelayMs === 'number'
      ? ({ '--message-appear-delay': `${appearDelayMs}ms` } as CSSProperties)
      : undefined;

  return (
    <div
      className={`temp_full ${isOwn ? 'own-message' : 'other-message'} ${selectionMode && isSelected ? 'selected' : ''} ${selectionMode ? 'selection-mode' : ''}`}
      data-message-id={message.id}
      onPointerDown={(e) => {
        if (!selectionMode && e.button === 0) {
          const target = e.target as HTMLElement | null;
          if (
            !target?.closest('button') &&
            !target?.closest('a') &&
            !target?.closest('[data-reaction-type]')
          ) {
            const now = performance.now();
            const prevTap = lastPointerTapRef.current;
            const isDoubleTap =
              prevTap &&
              prevTap.pointerType === e.pointerType &&
              now - prevTap.ts <= 280 &&
              Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) <= 24;

            if (isDoubleTap) {
              onReactionClick?.(message, 'heart');
              lastPointerTapRef.current = null;
              return;
            }

            lastPointerTapRef.current = {
              ts: now,
              x: e.clientX,
              y: e.clientY,
              pointerType: e.pointerType,
            };
          }
        }

        if (!selectionMode && e.pointerType === 'mouse' && e.button === 0) {
          onSelectionGestureCandidateStart?.(e.pointerId, e.clientX, e.clientY);
          return;
        }
        if (!selectionMode) return;
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        suppressSelectionClickRef.current = true;
        onPointerSelectStart?.(e.pointerId);
      }}
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
        <span className='message_select_check' aria-hidden>
          <Icon name={isSelected ? 'Select' : 'Circle'} />
        </span>
      )}
      <div
        ref={containerRef}
        className={`${styles.message_div} ${isOwn ? `${styles.darker} ${styles.right}` : ''} ${selectionMode ? styles.selected_prepare : ''} ${!isFirstInGroup ? styles.groupedWithNewer : ''} ${!isLastInGroup ? styles.groupedWithOlder : ''} ${typeof appearDelayMs === 'number' ? styles.initialAppear : ''}`}
        style={messageDivStyle}
      >
        <MessageContent
          message={message}
          reelItems={reelItems}
          isOwn={isOwn}
          hasOnlyMediaFiles={hasOnlyMediaFiles}
          onReactionClick={(reactionType) =>
            onReactionClick?.(message, reactionType)
          }
        />
      </div>
    </div>
  );
};

export default React.memo(Message);
