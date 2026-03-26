import { useState, useCallback, useMemo, useRef } from 'react';
import type { ContextMenuAnimatedIcon } from '../ContextMenu/ContextMenuItemLottie';
import type { MenuItem } from '../ui/menu/Menu';
import type { IconName } from '../Icons/AutoIcons';
import type { Message as MessageType, File } from '@/types';
import { apiFetch } from '@/utils/apiFetch';
import { websocketManager } from '@/utils/websocket-manager';
import { fallbackCopy } from './clipboardUtils';
import { MESSAGE_REACTION_OPTIONS } from '@/constants/messageReactions';
import { buildOptimisticReactionUpdate } from './reactionOptimistic';
import { useTranslation } from '@/contexts/languageCore';
import type { Viewer } from '@/types';

/** Cancel long-press if finger moves past this distance (scroll / drag). */
const LONG_PRESS_MOVE_CANCEL_PX = 10;

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
  triggerClipboardCheck?: () => void;
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
  menuItems: MenuItem<string | number>[];
  viewers: Viewer[];
  menuPos: { x: number; y: number } | null;
  menuVisible: boolean;
  isMenuHiding: boolean;
  menuInstanceKey: number;
  menuMessage: MessageType | null;
  isNestedViewersMenuOpen: boolean;
  closeNestedViewersMenu: () => void;
  submenuPosition: { x: number; y: number } | null;
  submenuWidth: number | null;
  onDropdownItemClick: (rect: { itemRect: DOMRect; menuRect: DOMRect }) => void;
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
  handleTouchMove: (e: React.TouchEvent | TouchEvent) => void;
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
  const longPressTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextContextMenuRef = useRef(false);
  const [isNestedViewersMenuOpen, setIsNestedViewersMenuOpen] = useState(false);
  const [submenuContext, setSubmenuContext] = useState<{
    position: { x: number; y: number };
    width: number;
  } | null>(null);
  const handleClose = useCallback(() => setIsMenuHiding(true), []);

  const onDropdownItemClick = useCallback(
    (rect: { itemRect: DOMRect; menuRect: DOMRect }) => {
      const gap = 4;
      setSubmenuContext({
        position: {
          x: rect.menuRect.left + gap,
          y: rect.itemRect.bottom + gap,
        },
        width: rect.menuRect.width,
      });
    },
    [],
  );

  const handleAnimationEnd = useCallback(() => {
    setIsMenuHiding((prev) => {
      if (prev) {
        setMenuVisible(false);
        setIsNestedViewersMenuOpen(false);
        setSubmenuContext(null);
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
      updateMessageInChat(selectedChat.id, menuMessage.id, (currentMessage) =>
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

  const menuItems = useMemo<MenuItem<string | number>[]>(
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
              animatedIcon: 'photo' as ContextMenuAnimatedIcon,
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
              animatedIcon: 'edit' as ContextMenuAnimatedIcon,
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
      ...(menuMessage?.viewers?.length && menuMessage?.is_own
        ? [
            { separator: true, label: '', onClick: () => {} },
            {
              label: `${menuMessage.viewers.length} ${t('messageContextMenu.seen')}`,
              isDropdown: true,
              dropdownExpanded: isNestedViewersMenuOpen,
              icon: 'Read' as IconName,
              onClick: () => setIsNestedViewersMenuOpen((prev) => !prev),
            },
          ]
        : []),
      ...(menuMessage?.is_own
        ? [
            { separator: true, label: '', onClick: () => {} },
            {
              label: t('messageContextMenu.delete'),
              animatedIcon: 'delete' as ContextMenuAnimatedIcon,
              onClick: () => menuMessage && handleDeleteMessage(menuMessage),
              destructive: true,
            },
          ]
        : []),
    ],
    [
      menuMessage,
      isNestedViewersMenuOpen,
      canCopyToClipboard,
      handleCopyMessage,
      handleCopyMedia,
      handleSaveFile,
      handleEditMessage,
      handleDeleteMessage,
      onSelectMessage,
      t,
    ],
  );

  const handleMessageContextMenu = useCallback(
    (e: React.MouseEvent | React.TouchEvent, message: MessageType) => {
      e.preventDefault();
      triggerClipboardCheck?.();
      setMenuVisible(false);
      setIsNestedViewersMenuOpen(false);
      setSubmenuContext(null);
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
      const t = e.touches[0];
      longPressTouchStartRef.current = t
        ? { x: t.clientX, y: t.clientY }
        : null;
      timerRef.current = window.setTimeout(() => {
        suppressNextContextMenuRef.current = true;
        handleMessageContextMenu(e, msg);
      }, 200);
    },
    [handleMessageContextMenu],
  );

  const handleTouchMove = useCallback((e: React.TouchEvent | TouchEvent) => {
    if (timerRef.current == null || longPressTouchStartRef.current == null)
      return;
    const t = e.touches[0];
    if (!t) return;
    const { x: sx, y: sy } = longPressTouchStartRef.current;
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    if (
      dx * dx + dy * dy >
      LONG_PRESS_MOVE_CANCEL_PX * LONG_PRESS_MOVE_CANCEL_PX
    ) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      longPressTouchStartRef.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    longPressTouchStartRef.current = null;
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
    isNestedViewersMenuOpen,
    closeNestedViewersMenu: () => {
      setIsNestedViewersMenuOpen(false);
      setSubmenuContext(null);
    },
    submenuPosition: submenuContext?.position ?? null,
    submenuWidth: submenuContext?.width ?? null,
    onDropdownItemClick,
    viewers: menuMessage?.viewers ?? [],
    reactionItems: MESSAGE_REACTION_OPTIONS,
    selectedReactionTypes:
      menuMessage?.user_reactions ??
      (menuMessage?.user_reaction ? [menuMessage.user_reaction] : []),
    handleReactionSelect,
    handleClose,
    handleAnimationEnd,
    handleMessageContextMenu,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    consumeNextContextMenuSuppression,
  };
}
