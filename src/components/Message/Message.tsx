import React, {
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
  type CSSProperties,
} from 'react';
import type { Message as MessageType } from '@/types';
import styles from './Message.module.scss';
import { useMessageDimensions } from './useMessageDimensions';
import MessageContent from './MessageContent';
import { Icon } from '../Icons/AutoIcons';
import { useSettings } from '@/contexts/settings/context';
import { useSelectedChat } from '@/contexts/ChatContextCore';

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
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
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
  const { liteModeEnabled } = useSettings();
  const { selectedChat } = useSelectedChat();
  const isChannel = selectedChat?.type === 'C';
  const lastPointerTapRef = useRef<{
    ts: number;
    x: number;
    y: number;
    pointerType: string;
  } | null>(null);
  useMessageDimensions(containerRef);

  const messageRef = useRef(message);
  const selectionModeRef = useRef(selectionMode);
  const onReactionClickRef = useRef(onReactionClick);
  const onSelectionGestureCandidateStartRef = useRef(
    onSelectionGestureCandidateStart,
  );
  const onPointerSelectStartRef = useRef(onPointerSelectStart);
  const onToggleSelectRef = useRef(onToggleSelect);

  useLayoutEffect(() => {
    messageRef.current = message;
    selectionModeRef.current = selectionMode;
    onReactionClickRef.current = onReactionClick;
    onSelectionGestureCandidateStartRef.current =
      onSelectionGestureCandidateStart;
    onPointerSelectStartRef.current = onPointerSelectStart;
    onToggleSelectRef.current = onToggleSelect;
  }, [
    message,
    selectionMode,
    onReactionClick,
    onSelectionGestureCandidateStart,
    onPointerSelectStart,
    onToggleSelect,
  ]);

  const handleContentReactionClick = useCallback((reactionType: string) => {
    onReactionClickRef.current?.(messageRef.current, reactionType);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const msg = messageRef.current;
      const inSelectionMode = selectionModeRef.current;

      if (!inSelectionMode && e.button === 0) {
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
            onReactionClickRef.current?.(msg, 'heart');
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

      if (!inSelectionMode && e.pointerType === 'mouse' && e.button === 0) {
        onSelectionGestureCandidateStartRef.current?.(
          e.pointerId,
          e.clientX,
          e.clientY,
        );
        return;
      }
      if (!inSelectionMode) return;
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      suppressSelectionClickRef.current = true;
      onPointerSelectStartRef.current?.(e.pointerId);
    },
    [],
  );

  const handleSelectionClick = useCallback(() => {
    if (suppressSelectionClickRef.current) {
      suppressSelectionClickRef.current = false;
      return;
    }
    onToggleSelectRef.current?.();
  }, []);

  const handleSelectionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onToggleSelectRef.current?.();
      }
    },
    [],
  );

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
      className={`temp_full ${isOwn ? 'own-message' : 'other-message'} ${liteModeEnabled ? styles.liteMode : ''} ${selectionMode && isSelected ? 'selected' : ''} ${selectionMode ? 'selection-mode' : ''}`}
      data-message-id={message.id}
      style={messageDivStyle}
      onPointerDown={onPointerDown}
      onClick={
        selectionMode && onToggleSelect ? handleSelectionClick : undefined
      }
      role={selectionMode ? 'button' : undefined}
      tabIndex={selectionMode ? 0 : undefined}
      onKeyDown={
        selectionMode && onToggleSelect
          ? handleSelectionKeyDown
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
        className={`${styles.message_div} ${isOwn ? `${styles.darker} ${styles.right}` : ''} ${liteModeEnabled ? styles.liteMode : ''} ${selectionMode ? styles.selected_prepare : ''} ${!isFirstInGroup ? styles.groupedWithNewer : ''} ${!isLastInGroup ? styles.groupedWithOlder : ''} ${typeof appearDelayMs === 'number' ? styles.initialAppear : ''}`}
      >
        <MessageContent
          message={message}
          reelItems={reelItems}
          isOwn={isOwn}
          hasOnlyMediaFiles={hasOnlyMediaFiles}
          onReactionClick={handleContentReactionClick}
          isChannel={isChannel}
        />
      </div>
    </div>
  );
};

export default React.memo(Message);
