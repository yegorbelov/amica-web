import { memo, useCallback } from 'react';
import Message from '@/components/Message/Message';
import type { Message as MessageType } from '@/types';

export type MessageListItemProps = {
  message: MessageType;
  reelItems: MessageType[];
  onReactionClick: (message: MessageType, reactionType: string) => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleMessageSelection: (messageId: number) => void;
  handlePointerSelectionStart: (
    messageId: number,
    isSelected: boolean,
    pointerId: number,
  ) => void;
  beginSelectionGestureCandidate: (
    messageId: number,
    isSelected: boolean,
    pointerId: number,
    startX: number,
    startY: number,
  ) => void;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  appearDelayMs?: number;
};

function MessageListItem({
  message,
  reelItems,
  onReactionClick,
  selectionMode,
  isSelected,
  onToggleMessageSelection,
  handlePointerSelectionStart,
  beginSelectionGestureCandidate,
  isFirstInGroup,
  isLastInGroup,
  appearDelayMs,
}: MessageListItemProps) {
  const onToggleSelect = useCallback(() => {
    onToggleMessageSelection(message.id);
  }, [message.id, onToggleMessageSelection]);

  const onPointerSelectStart = useCallback(
    (pointerId: number) => {
      handlePointerSelectionStart(message.id, isSelected, pointerId);
    },
    [message.id, isSelected, handlePointerSelectionStart],
  );

  const onSelectionGestureCandidateStart = useCallback(
    (pointerId: number, clientX: number, clientY: number) => {
      beginSelectionGestureCandidate(
        message.id,
        isSelected,
        pointerId,
        clientX,
        clientY,
      );
    },
    [message.id, isSelected, beginSelectionGestureCandidate],
  );

  return (
    <Message
      message={message}
      reelItems={reelItems}
      onReactionClick={onReactionClick}
      selectionMode={selectionMode}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect}
      onPointerSelectStart={onPointerSelectStart}
      onSelectionGestureCandidateStart={onSelectionGestureCandidateStart}
      isFirstInGroup={isFirstInGroup}
      isLastInGroup={isLastInGroup}
      appearDelayMs={appearDelayMs}
    />
  );
}

export default memo(MessageListItem);
