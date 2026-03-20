import { useState, useCallback, useMemo, useRef } from 'react';
import type { MenuItem } from '../ContextMenu/ContextMenu';
import type { IconName } from '../Icons/AutoIcons';
import type { Message as MessageType, File } from '@/types';
import { apiFetch } from '@/utils/apiFetch';
import { websocketManager } from '@/utils/websocket-manager';
import { fallbackCopy } from './clipboardUtils';
import { MESSAGE_REACTION_OPTIONS } from '@/constants/messageReactions';
import { buildOptimisticReactionUpdate } from './reactionOptimistic';
import { useTranslation } from '@/contexts/languageCore';

export interface UseMessageContextMenuParams {
  selectedChat: { id: number } | null;
  setEditingMessage: (msg: MessageType | null) => void;
  removeMessageFromChat: (chatId: number, messageId: number) => void;
  updateMessageInChat: (
    chatId: number,
    messageId: number,
    updates:
      | Partial<MessageType>
      | ((currentMessage: MessageType) => Partial<MessageType>),
  ) => void;
  showToast: (msg: string) => void;
  canCopyToClipboard: boolean;
  onShowViewers: (msg: MessageType) => void;
  /** Call when menu opens so clipboard check can run lazily (avoids init re-render). */
  triggerClipboardCheck?: () => void;
  /** Call when user chooses "Select" to enter multi-select mode with this message. */
  onSelectMessage?: (msg: MessageType) => void;
}

export interface ReactionMenuOption {
  type: string;
  emoji: string;
  iconUrl?: string;
  webmUrl: string;
  movUrl: string;
}

export interface UseMessageContextMenuResult {
  menuItems: MenuItem[];
  menuPos: { x: number; y: number } | null;
  menuVisible: boolean;
  isMenuHiding: boolean;
  menuInstanceKey: number;
  menuMessage: MessageType | null;
  reactionItems: readonly ReactionMenuOption[];
  selectedReactionTypes: readonly string[];
  handleReactionSelect: (reactionType: string) => void;
  handleClose: () => void;
  handleAnimationEnd: () => void;
  handleMessageContextMenu: (
    e: React.MouseEvent | React.TouchEvent,
    message: MessageType,
  ) => void;
  handleTouchStart: (e: React.TouchEvent, msg: MessageType) => void;
  handleTouchEnd: () => void;
  consumeNextContextMenuSuppression: () => boolean;
}

export function useMessageContextMenu({
  selectedChat,
  setEditingMessage,
  removeMessageFromChat,
  updateMessageInChat,
  showToast,
  canCopyToClipboard,
  onShowViewers,
  triggerClipboardCheck,
  onSelectMessage,
}: UseMessageContextMenuParams): UseMessageContextMenuResult {
  const { t } = useTranslation();
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isMenuHiding, setIsMenuHiding] = useState(false);
  const [menuMessage, setMenuMessage] = useState<MessageType | null>(null);
  const [menuInstanceKey, setMenuInstanceKey] = useState(0);
  const timerRef = useRef<number | null>(null);
  const suppressNextContextMenuRef = useRef(false);

  const handleClose = useCallback(() => setIsMenuHiding(true), []);

  const handleAnimationEnd = useCallback(() => {
    setIsMenuHiding((prev) => {
      if (prev) {
        setMenuVisible(false);
        return false;
      }
      return prev;
    });
  }, []);

  const handleCopyMedia = useCallback(
    async (msg: MessageType) => {
      if (!msg?.files?.length) return;
      const firstFile = msg.files.find((f: File) => f.category === 'image');
      if (!firstFile) return;
      try {
        const response = await apiFetch(firstFile.file_url);
        const blob = await response.blob();
        try {
          const imageBlob = new Blob([blob], { type: 'image/png' });
          const clipboardItem = new ClipboardItem({ 'image/png': imageBlob });
          await navigator.clipboard.write([clipboardItem]);
          showToast(t('toast.mediaCopied'));
        } catch {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = firstFile.file_url;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          const pngBlob = await new Promise<Blob | null>((r) =>
            canvas.toBlob(r, 'image/png'),
          );
          if (!pngBlob) throw new Error('Failed to convert to PNG');
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': pngBlob }),
          ]);
          showToast(t('toast.mediaCopied'));
        }
      } catch (err) {
        console.error('Clipboard error:', err);
      }
    },
    [showToast, t],
  );

  const handleSaveFile = useCallback(
    async (msg: MessageType) => {
      if (!msg?.files?.length) return;
      const firstFile = msg.files[0];
      if (!firstFile) return;
      try {
        const response = await apiFetch(firstFile.file_url);
        const blob = await response.blob();
        const filename =
          firstFile.original_name ||
          firstFile.file_url.split('/').pop() ||
          'download';
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        showToast(t('toast.fileDownloaded'));
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error('Failed to download file', err);
        showToast(t('toast.fileDownloadFailed'));
      }
    },
    [showToast, t],
  );

  const handleEditMessage = useCallback(
    (msg: MessageType) => {
      setMenuVisible(false);
      setMenuPos(null);
      setEditingMessage(msg);
    },
    [setEditingMessage],
  );

  const handleDeleteMessage = useCallback(
    (msg: MessageType) => {
      if (!selectedChat?.id) return;
      setMenuVisible(false);
      setMenuPos(null);
      setMenuMessage(null);
      removeMessageFromChat(selectedChat.id, msg.id);
      websocketManager.sendMessage({
        type: 'delete_message',
        chat_id: selectedChat.id,
        message_id: msg.id,
      });
    },
    [selectedChat?.id, removeMessageFromChat],
  );

  const handleCopyMessage = useCallback(
    (msg: MessageType) => {
      if (!msg?.value) return;
      const text = msg.value;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => showToast(t('toast.messageCopied')))
          .catch((err) => {
            console.error('Clipboard error:', err);
            fallbackCopy(text);
          });
      } else {
        fallbackCopy(text);
      }
    },
    [showToast, t],
  );

  const handleReactionSelect = useCallback(
    (reactionType: string) => {
      if (!menuMessage || !selectedChat?.id) return;
      updateMessageInChat(
        selectedChat.id,
        menuMessage.id,
        (currentMessage) =>
          buildOptimisticReactionUpdate(currentMessage, reactionType),
      );
      websocketManager.sendMessageReaction(
        selectedChat.id,
        menuMessage.id,
        reactionType,
      );
      setIsMenuHiding(true);
    },
    [menuMessage, selectedChat?.id, updateMessageInChat],
  );

  const menuItems = useMemo<MenuItem[]>(
    () => [
      // {
      //   label: 'Reply',
      //   icon: 'Reply' as IconName,
      //   onClick: () => {},
      // },
      // { separator: true, label: '', onClick: () => {} },
      ...(menuMessage?.value
        ? [
            {
              label: t('messageContextMenu.copyText'),
              icon: 'CopyText' as IconName,
              onClick: () => handleCopyMessage(menuMessage),
            },
          ]
        : []),
      ...(menuMessage?.files?.some((f: File) =>
        ['image'].includes(f?.category || ''),
      ) && canCopyToClipboard
        ? [
            {
              label: t('messageContextMenu.copyMedia'),
              icon: 'Photo' as IconName,
              onClick: () => handleCopyMedia(menuMessage),
            },
          ]
        : []),
      ...(menuMessage?.files?.length > 0
        ? [
            {
              label: t('messageContextMenu.saveAs'),
              icon: 'SaveAs' as IconName,
              onClick: () => handleSaveFile(menuMessage),
            },
          ]
        : []),
      { separator: true, label: '', onClick: () => {} },
      ...(menuMessage?.is_own
        ? [
            {
              label: t('messageContextMenu.edit'),
              icon: 'Edit' as IconName,
              onClick: () => handleEditMessage(menuMessage),
            },
          ]
        : []),
      // { label: 'Forward', icon: 'Forward' as IconName, onClick: () => {} },
      {
        label: t('messageContextMenu.select'),
        icon: 'Select' as IconName,
        onClick: () => {
          if (menuMessage && onSelectMessage) {
            onSelectMessage(menuMessage);
            setMenuVisible(false);
            setMenuPos(null);
            setMenuMessage(null);
          }
        },
      },
      ...(menuMessage?.is_own
        ? [
            { separator: true, label: '', onClick: () => {} },
            {
              label: t('messageContextMenu.delete'),
              icon: 'Delete' as IconName,
              onClick: () => menuMessage && handleDeleteMessage(menuMessage),
              danger: true,
            },
          ]
        : []),
      ...(menuMessage?.viewers?.length && menuMessage?.is_own
        ? [
            { separator: true, label: '', onClick: () => {} },
            {
              label: `${menuMessage.viewers.length} ${t('messageContextMenu.seen')}`,
              icon: 'Read' as IconName,
              onClick: () => onShowViewers(menuMessage),
            },
          ]
        : []),
    ],
    [
      menuMessage,
      canCopyToClipboard,
      handleCopyMessage,
      handleCopyMedia,
      handleSaveFile,
      handleEditMessage,
      handleDeleteMessage,
      onShowViewers,
      onSelectMessage,
      t,
    ],
  );

  const handleMessageContextMenu = useCallback(
    (e: React.MouseEvent | React.TouchEvent, message: MessageType) => {
      e.preventDefault();
      triggerClipboardCheck?.();
      setMenuVisible(false);
      setTimeout(() => {
        setMenuMessage(message);
        setMenuPos({
          x: 'touches' in e ? e.touches[0].clientX : e.clientX,
          y: 'touches' in e ? e.touches[0].clientY : e.clientY,
        });
        setMenuInstanceKey((prev) => prev + 1);
        setMenuVisible(true);
        setIsMenuHiding(false);
      }, 0);
    },
    [triggerClipboardCheck],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, msg: MessageType) => {
      timerRef.current = window.setTimeout(() => {
        suppressNextContextMenuRef.current = true;
        handleMessageContextMenu(e, msg);
      }, 200);
    },
    [handleMessageContextMenu],
  );

  const handleTouchEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const consumeNextContextMenuSuppression = useCallback(() => {
    if (!suppressNextContextMenuRef.current) return false;
    suppressNextContextMenuRef.current = false;
    return true;
  }, []);

  return {
    menuItems,
    menuPos,
    menuVisible,
    isMenuHiding,
    menuInstanceKey,
    menuMessage,
    reactionItems: MESSAGE_REACTION_OPTIONS,
    selectedReactionTypes:
      menuMessage?.user_reactions ??
      (menuMessage?.user_reaction ? [menuMessage.user_reaction] : []),
    handleReactionSelect,
    handleClose,
    handleAnimationEnd,
    handleMessageContextMenu,
    handleTouchStart,
    handleTouchEnd,
    consumeNextContextMenuSuppression,
  };
}
