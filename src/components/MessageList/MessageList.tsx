import Message from '../Message/Message';
import {
  useSelectedChat,
  useChatMessages,
  useChatMeta,
} from '@/contexts/ChatContextCore';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  memo,
  useCallback,
  useMemo,
} from 'react';
import styles from './MessageList.module.scss';
import { useJumpActions } from '@/hooks/useJump';
import { useLazyCanCopyToClipboard } from '@/hooks/useCanCopyToClipboard';
import { useToast } from '@/contexts/toast/ToastContextCore';
import { useTranslation } from '@/contexts/languageCore';
import type { Message as MessageType } from '@/types';
import { useMessageContextMenu } from './useMessageContextMenu';
import { websocketManager } from '@/utils/websocket-manager';
import { buildOptimisticReactionUpdate } from './reactionOptimistic';
import DateSeparator from './DateSeparator';
import DatePickerModal from './DatePickerModal';
import type { DateKey } from './DateSeparator';
import { useUser } from '@/contexts/UserContextCore';
import { Menu } from '../ui/menu/Menu';
import { ReactionsPanel } from '../ContextMenu/ReactionsPanel';
import { formatDateViewed } from '@/utils/formatDateViewed';

const VISIBLE_BUFFER = 7;
const PAGINATION_THRESHOLD_PX = 300;
const MIN_MESSAGES_TO_TRIM = 40;
const TRIM_DEBOUNCE_MS = 1000;
const SELECTION_DRAG_THRESHOLD_PX = 8;

function getDateKey(msg: MessageType): DateKey {
  const d = msg.date ?? '';
  return d.slice(0, 10) || new Date().toISOString().slice(0, 10);
}

/** Map app locale to BCP 47 for Intl (e.g. ua -> uk) */
const LOCALE_MAP: Record<string, string> = { ua: 'uk' };

interface MessageListProps {
  isSelectionMode: boolean;
  selectedMessageIds: Set<number>;
  onSelectMessage: (message: MessageType) => void;
  onToggleMessageSelection: (messageId: number) => void;
  onSetMessageSelection: (messageId: number, selected: boolean) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  isSelectionMode,
  selectedMessageIds,
  onSelectMessage,
  onToggleMessageSelection,
  onSetMessageSelection,
}) => {
  const { selectedChat } = useSelectedChat();
  const { handleCreateTemporaryChat } = useChatMeta();
  const {
    messages,
    messagesLoading,
    loadingOlderMessages,
    loadingNewerMessages,
    loadOlderMessages,
    loadNewerMessages,
    trimMessagesToRange,
    setEditingMessage,
    removeMessageFromChat,
    updateMessageInChat,
    initialWsChatLoadAnimation,
  } = useChatMessages();
  const { selectedChatId } = useSelectedChat();
  const { containerRef: jumpContainerRef } = useJumpActions();
  const { showToast } = useToast();
  const { canCopy: canCopyToClipboard, triggerCheck: triggerClipboardCheck } =
    useLazyCanCopyToClipboard();
  const { t, locale } = useTranslation();
  const intlLocale = LOCALE_MAP[locale] ?? locale;
  const { user } = useUser();
  const userId = user?.id;

  const formatDateSeparatorLabel = useCallback(
    (dateKey: DateKey): string => {
      const d = new Date(dateKey + 'T12:00:00');
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const todayKey = today.toISOString().slice(0, 10);
      const yesterdayKey = yesterday.toISOString().slice(0, 10);
      if (dateKey === todayKey) return t('dateGroup.today');
      if (dateKey === yesterdayKey) return t('dateGroup.yesterday');
      return d.toLocaleDateString(intlLocale, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    },
    [t, intlLocale],
  );

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerInitialDate, setDatePickerInitialDate] =
    useState<DateKey | null>(null);

  const selectedChatIdForReaction = selectedChat?.id;
  const handleMessageReactionClick = useCallback(
    (message: MessageType, reactionType: string) => {
      if (!selectedChatIdForReaction) return;
      updateMessageInChat(
        selectedChatIdForReaction,
        message.id,
        (currentMessage) =>
          buildOptimisticReactionUpdate(currentMessage, reactionType),
      );
      websocketManager.sendMessageReaction(
        selectedChatIdForReaction,
        message.id,
        reactionType,
      );
    },
    [selectedChatIdForReaction, updateMessageInChat],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const viewedSet = new Set<number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const node = entry.target as HTMLElement;
          const messageId = Number(node.dataset.messageId);

          if (messageId && !viewedSet.has(messageId)) {
            viewedSet.add(messageId);

            websocketManager.sendMessageViewed(selectedChatId, messageId);

            observer.unobserve(node);
          }
        });
      },
      {
        root: el,
        threshold: 0.6,
      },
    );

    messages
      .filter((m) => {
        const hasUserViewed = m.viewers?.some((v) => v?.user.id === userId);

        const isOwnMsg = Boolean(m.is_own);

        return !hasUserViewed && !isOwnMsg;
      })
      .forEach((m) => {
        const node = el.querySelector(`[data-message-id="${m.id}"]`);
        if (node) observer.observe(node);
      });

    return () => observer.disconnect();
  }, [messages, userId, selectedChatId]);

  const {
    menuItems,
    menuPos,
    menuVisible,
    menuInstanceKey,
    isMenuHiding,
    isNestedViewersMenuOpen,
    closeNestedViewersMenu,
    submenuPosition,
    submenuWidth,
    onDropdownItemClick,
    reactionItems,
    viewers,
    selectedReactionTypes,
    handleReactionSelect,
    handleClose,
    handleAnimationEnd,
    handleMessageContextMenu,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    consumeNextContextMenuSuppression,
  } = useMessageContextMenu({
    selectedChat,
    setEditingMessage,
    removeMessageFromChat,
    updateMessageInChat,
    showToast,
    canCopyToClipboard,
    triggerClipboardCheck,
    onSelectMessage,
  });

  const [positionedMenu, setPositionedMenu] = useState<{
    key: number;
    rect: DOMRect;
  } | null>(null);
  const handleMenuPositioned = useCallback(
    (rect: DOMRect) => {
      setPositionedMenu((prev) => {
        if (
          prev &&
          prev.key === menuInstanceKey &&
          prev.rect.left === rect.left &&
          prev.rect.top === rect.top
        ) {
          return prev;
        }
        return { key: menuInstanceKey, rect };
      });
    },
    [menuInstanceKey],
  );
  const menuRect =
    positionedMenu?.key === menuInstanceKey ? positionedMenu.rect : null;

  const containerRef = useRef<HTMLDivElement>(null);
  const loadOlderTriggeredRef = useRef(false);
  const loadNewerTriggeredRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const isFirstScrollAfterOpenRef = useRef(true);
  const scrollRestoreRef = useRef<{
    chatId: number;
    scrollHeight: number;
    scrollTop: number;
    anchorMessageId?: string | null;
    anchorOffsetFromTop?: number;
  } | null>(null);
  const fillNoMoreOlderRef = useRef(false);
  const trimDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trimScrollAnchorRef = useRef<{
    messageId: string;
    offsetFromTop: number;
  } | null>(null);
  const isRestoringRef = useRef(false);
  const lastScrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const loadingOlderRef = useRef(loadingOlderMessages);
  const loadingNewerRef = useRef(loadingNewerMessages);
  const selectedChatIdRef = useRef(selectedChatId);
  useEffect(() => {
    loadingOlderRef.current = loadingOlderMessages;
    loadingNewerRef.current = loadingNewerMessages;
    selectedChatIdRef.current = selectedChatId;
  }, [loadingOlderMessages, loadingNewerMessages, selectedChatId]);
  const scrollContainerRef = jumpContainerRef;
  const mergedRef = containerRef;
  const messagesRef = useRef(messages);
  const messagesByIdRef = useRef(new Map<string, MessageType>());
  const isSelectionModeRef = useRef(isSelectionMode);
  const selectedMessageIdsRef = useRef(selectedMessageIds);
  const selectionGestureCandidateRef = useRef<{
    kind: 'mouse' | 'touch';
    messageId: number;
    isSelected: boolean;
    startX: number;
    startY: number;
    pointerId?: number;
  } | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragSelectionModeRef = useRef<'select' | 'deselect' | null>(null);
  const dragVisitedIdsRef = useRef<Set<number>>(new Set());
  const handlersRef = useRef({
    handleMessageContextMenu,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    consumeNextContextMenuSuppression,
  });

  useEffect(() => {
    messagesRef.current = messages;
    const byId = messagesByIdRef.current;
    byId.clear();
    for (const m of messages) byId.set(String(m.id), m);
  }, [messages]);

  useEffect(() => {
    isSelectionModeRef.current = isSelectionMode;
  }, [isSelectionMode]);

  useEffect(() => {
    selectedMessageIdsRef.current = selectedMessageIds;
  }, [selectedMessageIds]);

  useEffect(() => {
    handlersRef.current = {
      handleMessageContextMenu,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      consumeNextContextMenuSuppression,
    };
  }, [
    handleMessageContextMenu,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    consumeNextContextMenuSuppression,
  ]);

  const stopPointerSelection = useCallback(() => {
    selectionGestureCandidateRef.current = null;
    dragPointerIdRef.current = null;
    dragSelectionModeRef.current = null;
    dragVisitedIdsRef.current.clear();
  }, []);

  const beginPointerSelection = useCallback(
    (messageId: number, isSelected: boolean, pointerId: number | null) => {
      dragPointerIdRef.current = pointerId;
      dragSelectionModeRef.current = isSelected ? 'deselect' : 'select';
      dragVisitedIdsRef.current = new Set([messageId]);
      onSetMessageSelection(
        messageId,
        dragSelectionModeRef.current === 'select',
      );
    },
    [onSetMessageSelection],
  );

  const handlePointerSelectionStart = useCallback(
    (messageId: number, isSelected: boolean, pointerId: number) => {
      if (!isSelectionMode) return;
      beginPointerSelection(messageId, isSelected, pointerId);
    },
    [beginPointerSelection, isSelectionMode],
  );

  const applyPointerSelectionAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      const target = document.elementFromPoint(clientX, clientY);
      const messageEl = target?.closest('[data-message-id]');
      const messageIdAttr = messageEl?.getAttribute('data-message-id');
      if (messageIdAttr == null) return;
      const messageId = Number(messageIdAttr);
      if (
        Number.isNaN(messageId) ||
        dragVisitedIdsRef.current.has(messageId) ||
        dragSelectionModeRef.current == null
      )
        return;
      dragVisitedIdsRef.current.add(messageId);
      onSetMessageSelection(
        messageId,
        dragSelectionModeRef.current === 'select',
      );
    },
    [onSetMessageSelection],
  );

  const beginSelectionGestureCandidate = useCallback(
    (
      messageId: number,
      isSelected: boolean,
      pointerId: number,
      startX: number,
      startY: number,
    ) => {
      selectionGestureCandidateRef.current = {
        kind: 'mouse',
        messageId,
        isSelected,
        startX,
        startY,
        pointerId,
      };
    },
    [],
  );

  const maybeActivateSelectionGesture = useCallback(
    (clientX: number, clientY: number, pointerId?: number) => {
      const candidate = selectionGestureCandidateRef.current;
      if (!candidate) return false;
      if (
        pointerId != null &&
        candidate.pointerId != null &&
        candidate.pointerId !== pointerId
      )
        return false;
      const distance = Math.hypot(
        clientX - candidate.startX,
        clientY - candidate.startY,
      );
      if (distance < SELECTION_DRAG_THRESHOLD_PX) return false;
      selectionGestureCandidateRef.current = null;
      beginPointerSelection(
        candidate.messageId,
        candidate.isSelected,
        candidate.pointerId ?? null,
      );
      applyPointerSelectionAtPoint(clientX, clientY);
      return true;
    },
    [applyPointerSelectionAtPoint, beginPointerSelection],
  );

  const getTouchesCenter = useCallback((touches: TouchList) => {
    const first = touches[0];
    const second = touches[1];
    return {
      x: (first.clientX + second.clientX) / 2,
      y: (first.clientY + second.clientY) / 2,
    };
  }, []);

  useEffect(() => {
    const endSelection = () => {
      stopPointerSelection();
    };
    window.addEventListener('pointerup', endSelection, { passive: true });
    window.addEventListener('pointercancel', endSelection, { passive: true });
    return () => {
      window.removeEventListener('pointerup', endSelection);
      window.removeEventListener('pointercancel', endSelection);
    };
  }, [stopPointerSelection]);

  const clearScheduledTrim = useCallback(() => {
    if (trimDebounceRef.current) {
      clearTimeout(trimDebounceRef.current);
      trimDebounceRef.current = null;
    }
  }, []);

  const getTopVisibleAnchor = useCallback(
    (el: HTMLDivElement, listEl: HTMLDivElement) => {
      const scrollRect = el.getBoundingClientRect();
      const messageEls = listEl.querySelectorAll('[data-message-id]');
      let anchorMessageId: string | null = null;
      let anchorOffsetFromTop = 0;
      let topmostTop = Infinity;
      for (let i = 0; i < messageEls.length; i++) {
        const msgEl = messageEls[i] as HTMLElement;
        const rect = msgEl.getBoundingClientRect();
        if (rect.bottom <= scrollRect.top || rect.top >= scrollRect.bottom)
          continue;
        if (rect.top < topmostTop) {
          topmostTop = rect.top;
          anchorMessageId = msgEl.getAttribute('data-message-id');
          anchorOffsetFromTop = rect.top - scrollRect.top;
        }
      }
      return { anchorMessageId, anchorOffsetFromTop };
    },
    [],
  );

  const restoreAnchorPosition = useCallback(
    (
      el: HTMLDivElement,
      listEl: HTMLDivElement,
      anchorMessageId?: string | null,
      anchorOffsetFromTop = 0,
      fallback?: { scrollHeight: number; scrollTop: number },
    ) => {
      if (anchorMessageId) {
        const anchorEl = listEl.querySelector(
          `[data-message-id="${CSS.escape(anchorMessageId)}"]`,
        ) as HTMLElement | null;
        if (anchorEl) {
          void listEl.offsetHeight;
          const scrollRect = el.getBoundingClientRect();
          const anchorRect = anchorEl.getBoundingClientRect();
          const currentOffsetFromTop = anchorRect.top - scrollRect.top;
          const diff = currentOffsetFromTop - anchorOffsetFromTop;
          const minScrollTop = -(el.scrollHeight - el.clientHeight);
          const newScrollTop = Math.max(minScrollTop, el.scrollTop - diff);
          el.scrollTo({ top: newScrollTop, behavior: 'auto' });
          return;
        }
      }
      if (!fallback) return;
      const delta = el.scrollHeight - fallback.scrollHeight;
      if (delta <= 0) return;
      const minScrollTop = -(el.scrollHeight - el.clientHeight);
      const newScrollTop = Math.max(minScrollTop, fallback.scrollTop - delta);
      el.scrollTo({ top: newScrollTop, behavior: 'auto' });
    },
    [],
  );

  const runTrim = useCallback(() => {
    const el = scrollContainerRef.current;
    const listEl = containerRef.current;
    const chatId = selectedChatIdRef.current;
    const n = messagesRef.current.length;
    if (
      !el ||
      !listEl ||
      chatId == null ||
      n <= MIN_MESSAGES_TO_TRIM ||
      loadingOlderRef.current ||
      loadingNewerRef.current ||
      loadOlderTriggeredRef.current ||
      loadNewerTriggeredRef.current
    )
      return;
    const scrollRect = el.getBoundingClientRect();
    const messageEls = listEl.querySelectorAll('[data-message-id]');
    let bottommostVisibleIndex = -1;
    let bottommostBottom = -Infinity;
    let topmostVisibleIndex = -1;
    let topmostMessageId: string | null = null;
    let topmostOffsetFromTop = 0;
    let topmostTop = Infinity;
    for (let i = 0; i < messageEls.length; i++) {
      const cacheIndex = n - 1 - i;
      const msgEl = messageEls[i] as HTMLElement;
      const rect = msgEl.getBoundingClientRect();
      const visible =
        rect.bottom > scrollRect.top && rect.top < scrollRect.bottom;
      if (visible) {
        if (rect.bottom > bottommostBottom) {
          bottommostBottom = rect.bottom;
          bottommostVisibleIndex = cacheIndex;
        }
        if (rect.top < topmostTop) {
          topmostTop = rect.top;
          topmostVisibleIndex = cacheIndex;
          topmostMessageId = msgEl.getAttribute('data-message-id');
          topmostOffsetFromTop = rect.top - scrollRect.top;
        }
      }
    }
    if (bottommostVisibleIndex < 0 || topmostVisibleIndex < 0) return;

    const scrollingDown = lastScrollDirectionRef.current === 'down';
    if (scrollingDown) {
      const start = Math.max(0, topmostVisibleIndex - VISIBLE_BUFFER);
      if (start > 0) {
        if (topmostMessageId)
          trimScrollAnchorRef.current = {
            messageId: topmostMessageId,
            offsetFromTop: topmostOffsetFromTop,
          };
        trimMessagesToRange(chatId, start, n - 1);
      }
    } else {
      const end = Math.min(n - 1, bottommostVisibleIndex + VISIBLE_BUFFER);
      if (end < n - 1) {
        if (topmostMessageId)
          trimScrollAnchorRef.current = {
            messageId: topmostMessageId,
            offsetFromTop: topmostOffsetFromTop,
          };
        trimMessagesToRange(chatId, 0, end);
      }
    }
  }, [trimMessagesToRange, scrollContainerRef]);

  const scheduleTrimAfterScrollEnd = useCallback(() => {
    clearScheduledTrim();
    trimDebounceRef.current = setTimeout(() => {
      trimDebounceRef.current = null;
      runTrim();
    }, TRIM_DEBOUNCE_MS);
  }, [clearScheduledTrim, runTrim]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onContextMenu = (e: MouseEvent) => {
      if (handlersRef.current.consumeNextContextMenuSuppression()) {
        e.preventDefault();
        return;
      }
      const msgEl = (e.target as HTMLElement).closest('[data-message-id]');
      const id = msgEl?.getAttribute('data-message-id');
      if (id == null) return;
      const message = messagesByIdRef.current.get(id);
      if (message)
        handlersRef.current.handleMessageContextMenu(
          e as unknown as React.MouseEvent,
          message,
        );
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        handlersRef.current.handleTouchEnd();
        const msgEl = (e.target as HTMLElement).closest('[data-message-id]');
        const id = msgEl?.getAttribute('data-message-id');
        if (id == null) return;
        const messageId = Number(id);
        if (Number.isNaN(messageId)) return;
        const center = getTouchesCenter(e.touches);
        selectionGestureCandidateRef.current = {
          kind: 'touch',
          messageId,
          isSelected: selectedMessageIdsRef.current.has(messageId),
          startX: center.x,
          startY: center.y,
        };
        return;
      }
      if (isSelectionModeRef.current) {
        handlersRef.current.handleTouchEnd();
        return;
      }
      selectionGestureCandidateRef.current = null;
      const msgEl = (e.target as HTMLElement).closest('[data-message-id]');
      const id = msgEl?.getAttribute('data-message-id');
      if (id == null) return;
      const message = messagesByIdRef.current.get(id);
      if (message)
        handlersRef.current.handleTouchStart(
          e as unknown as React.TouchEvent<HTMLDivElement>,
          message,
        );
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handlersRef.current.handleTouchMove(e);
      }
      const hasTwoFingerSelectionFlow =
        e.touches.length === 2 &&
        (selectionGestureCandidateRef.current?.kind === 'touch' ||
          dragSelectionModeRef.current != null);

      if (!hasTwoFingerSelectionFlow) {
        if (
          selectionGestureCandidateRef.current?.kind === 'touch' &&
          dragSelectionModeRef.current == null
        ) {
          selectionGestureCandidateRef.current = null;
        }
        return;
      }

      e.preventDefault();

      const center = getTouchesCenter(e.touches);
      if (maybeActivateSelectionGesture(center.x, center.y)) {
        return;
      }
      if (dragSelectionModeRef.current != null) {
        applyPointerSelectionAtPoint(center.x, center.y);
      }
    };
    const onTouchEnd = () => {
      handlersRef.current.handleTouchEnd();
      if (selectionGestureCandidateRef.current?.kind === 'touch') {
        selectionGestureCandidateRef.current = null;
      }
      if (dragSelectionModeRef.current != null) {
        stopPointerSelection();
      }
    };
    el.addEventListener('contextmenu', onContextMenu);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [
    applyPointerSelectionAtPoint,
    getTouchesCenter,
    maybeActivateSelectionGesture,
    stopPointerSelection,
  ]);

  useEffect(() => {
    let cancelled = false;
    let teardown: (() => void) | void;
    // const THROTTLE_MS = 100;
    // const SCROLL_END_MS = 120;

    const attach = (): void => {
      const el = scrollContainerRef.current;
      if (!el) {
        if (!cancelled) setTimeout(attach, 30);
        return;
      }

      let rafId: number | null = null;

      const onScroll = () => {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;

          const listEl = containerRef.current;
          const chatId = selectedChatIdRef.current;
          const scrollRange = el.scrollHeight - el.clientHeight;
          const minScrollTop = scrollRange > 0 ? -scrollRange : 0;
          const nearTop =
            scrollRange > 0 &&
            el.scrollTop <= minScrollTop + PAGINATION_THRESHOLD_PX;

          if (
            chatId != null &&
            !loadingOlderRef.current &&
            !loadOlderTriggeredRef.current &&
            !loadNewerTriggeredRef.current &&
            nearTop
          ) {
            const { anchorMessageId, anchorOffsetFromTop } =
              listEl != null
                ? getTopVisibleAnchor(el, listEl)
                : { anchorMessageId: null, anchorOffsetFromTop: 0 };
            clearScheduledTrim();
            loadOlderTriggeredRef.current = true;
            loadingOlderRef.current = true;
            scrollRestoreRef.current = {
              chatId,
              scrollHeight: el.scrollHeight,
              scrollTop: el.scrollTop,
              anchorMessageId,
              anchorOffsetFromTop,
            };
            loadOlderMessages(chatId).then((started) => {
              if (!started) {
                loadOlderTriggeredRef.current = false;
                loadingOlderRef.current = false;
              }
            });
          }

          if (isFirstScrollAfterOpenRef.current) {
            isFirstScrollAfterOpenRef.current = false;
            lastScrollTopRef.current = el.scrollTop;
          } else {
            const delta = el.scrollTop - lastScrollTopRef.current;
            if (delta < 0) lastScrollDirectionRef.current = 'up';
            else if (delta > 0) lastScrollDirectionRef.current = 'down';
            const scrollingDown = el.scrollTop > lastScrollTopRef.current;
            lastScrollTopRef.current = el.scrollTop;
            if (
              chatId != null &&
              !loadingNewerRef.current &&
              !loadNewerTriggeredRef.current &&
              !loadOlderTriggeredRef.current &&
              scrollingDown
            ) {
              const isNearNewest =
                el.scrollTop >= -PAGINATION_THRESHOLD_PX &&
                el.scrollTop <= PAGINATION_THRESHOLD_PX;
              if (isNearNewest) {
                const { anchorMessageId, anchorOffsetFromTop } =
                  listEl != null
                    ? getTopVisibleAnchor(el, listEl)
                    : { anchorMessageId: null, anchorOffsetFromTop: 0 };
                clearScheduledTrim();
                loadNewerTriggeredRef.current = true;
                loadingNewerRef.current = true;
                scrollRestoreRef.current = {
                  chatId,
                  scrollHeight: el.scrollHeight,
                  scrollTop: el.scrollTop,
                  anchorMessageId,
                  anchorOffsetFromTop,
                };
                loadNewerMessages(chatId).then((started) => {
                  if (!started) {
                    loadNewerTriggeredRef.current = false;
                    loadingNewerRef.current = false;
                  }
                });
              }
            }
          }
          if (!isRestoringRef.current) scheduleTrimAfterScrollEnd();
        });
      };

      el.addEventListener('scroll', onScroll, { passive: true });

      teardown = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        if (trimDebounceRef.current) {
          clearTimeout(trimDebounceRef.current);
          trimDebounceRef.current = null;
        }
        el.removeEventListener('scroll', onScroll);
      };
    };

    attach();
    return () => {
      cancelled = true;
      if (typeof teardown === 'function') teardown();
    };
  }, [
    selectedChatId,
    loadOlderMessages,
    loadNewerMessages,
    getTopVisibleAnchor,
    clearScheduledTrim,
    scheduleTrimAfterScrollEnd,
    scrollContainerRef,
  ]);

  useEffect(() => {
    if (!loadingOlderMessages && loadOlderTriggeredRef.current) {
      loadOlderTriggeredRef.current = false;
    }
    if (!loadingNewerMessages && loadNewerTriggeredRef.current) {
      loadNewerTriggeredRef.current = false;
    }
  }, [loadingOlderMessages, loadingNewerMessages]);

  useEffect(() => {
    fillNoMoreOlderRef.current = false;
  }, [selectedChatId]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) lastScrollTopRef.current = el.scrollTop;
    isFirstScrollAfterOpenRef.current = true;
  }, [selectedChatId, scrollContainerRef]);

  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (
      !el ||
      selectedChatId == null ||
      messages.length === 0 ||
      loadingOlderMessages ||
      loadingNewerMessages ||
      fillNoMoreOlderRef.current
    )
      return;
    const needsMore = el.scrollHeight <= el.clientHeight;
    if (!needsMore) return;
    const listEl = containerRef.current;
    const { anchorMessageId, anchorOffsetFromTop } =
      listEl != null
        ? getTopVisibleAnchor(el, listEl)
        : { anchorMessageId: null, anchorOffsetFromTop: 0 };
    clearScheduledTrim();
    loadingOlderRef.current = true;
    scrollRestoreRef.current = {
      chatId: selectedChatId,
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
      anchorMessageId,
      anchorOffsetFromTop,
    };
    loadOlderMessages(selectedChatId).then((started) => {
      if (!started) {
        fillNoMoreOlderRef.current = true;
        loadingOlderRef.current = false;
      }
    });
  }, [
    selectedChatId,
    messages.length,
    loadingOlderMessages,
    loadingNewerMessages,
    loadOlderMessages,
    getTopVisibleAnchor,
    clearScheduledTrim,
    scrollContainerRef,
  ]);

  useEffect(() => {
    return () => {
      scrollRestoreRef.current = null;
      trimScrollAnchorRef.current = null;
      lastScrollDirectionRef.current = null;
      clearScheduledTrim();
    };
  }, [selectedChatId, clearScheduledTrim]);

  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    const listEl = containerRef.current;
    if (!el || selectedChatId == null) return;

    // 1) Restore after prepend (load older)
    const saved = scrollRestoreRef.current;
    if (saved && saved.chatId === selectedChatId) {
      scrollRestoreRef.current = null;
      if (listEl) {
        isRestoringRef.current = true;
        restoreAnchorPosition(
          el,
          listEl,
          saved.anchorMessageId,
          saved.anchorOffsetFromTop ?? 0,
          {
            scrollHeight: saved.scrollHeight,
            scrollTop: saved.scrollTop,
          },
        );
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 0);
      }
      scheduleTrimAfterScrollEnd();
      return;
    }

    // 2) Restore after trim
    const anchor = trimScrollAnchorRef.current;
    if (anchor && listEl) {
      trimScrollAnchorRef.current = null;
      isRestoringRef.current = true;
      restoreAnchorPosition(el, listEl, anchor.messageId, anchor.offsetFromTop);
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 0);
    }
  }, [
    messages.length,
    selectedChatId,
    restoreAnchorPosition,
    scheduleTrimAfterScrollEnd,
    scrollContainerRef,
  ]);

  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const reelItems = useMemo(
    () => messages.filter((m) => Array.isArray(m.files) && m.files.length > 0),
    [messages],
  );

  type DateGroupedMessage = {
    message: MessageType;
    isFirstInGroup: boolean;
    isLastInGroup: boolean;
  };
  type DateGroup = {
    dateKey: DateKey;
    messages: DateGroupedMessage[];
  };

  const dateGroups = useMemo((): DateGroup[] => {
    const groups: DateGroup[] = [];
    const n = reversedMessages.length;
    const visible = (m: MessageType) =>
      !m.is_deleted && (!!m.value || (m.files?.length ?? 0) > 0);
    const findNextVisible = (from: number) => {
      for (let j = from + 1; j < n; j++) {
        if (visible(reversedMessages[j])) return j;
      }
      return -1;
    };
    const findPrevVisible = (from: number) => {
      for (let j = from - 1; j >= 0; j--) {
        if (visible(reversedMessages[j])) return j;
      }
      return -1;
    };
    for (let i = 0; i < n; i++) {
      const message = reversedMessages[i];
      if (!visible(message)) continue;
      const dateKey = getDateKey(message);
      const nextVisible = findNextVisible(i);
      const prevVisible = findPrevVisible(i);
      const isFirstInGroup =
        nextVisible === -1 ||
        reversedMessages[nextVisible].user !== message.user ||
        getDateKey(reversedMessages[nextVisible]) !== dateKey;
      const isLastInGroup =
        prevVisible === -1 ||
        reversedMessages[prevVisible].user !== message.user ||
        getDateKey(reversedMessages[prevVisible]) !== dateKey;

      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.dateKey !== dateKey) {
        groups.push({
          dateKey,
          messages: [],
        });
      }
      groups[groups.length - 1].messages.push({
        message,
        isFirstInGroup,
        isLastInGroup,
      });
    }
    return groups;
  }, [reversedMessages]);

  const availableDates = useMemo(
    () => Array.from(new Set(messages.map(getDateKey))),
    [messages],
  );
  const scrollToDate = useCallback(
    (dateKey: DateKey) => {
      const listEl = containerRef.current;
      if (!listEl) return;
      const firstMessageOfDay = reversedMessages.find(
        (m) => getDateKey(m) === dateKey,
      );
      if (!firstMessageOfDay) return;
      const el = listEl.querySelector(
        `[data-message-id="${CSS.escape(String(firstMessageOfDay.id))}"]`,
      ) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    },
    [reversedMessages],
  );

  const handleDateSeparatorClick = useCallback((dateKey: DateKey) => {
    setDatePickerInitialDate(dateKey);
    setDatePickerOpen(true);
  }, []);

  const handleDatePickerSelect = useCallback(
    (dateKey: DateKey) => {
      setDatePickerOpen(false);
      setDatePickerInitialDate(null);
      scrollToDate(dateKey);
    },
    [scrollToDate],
  );

  const shouldAnimateInitialWsBatch =
    selectedChatId != null &&
    initialWsChatLoadAnimation?.chatId === selectedChatId &&
    Array.isArray(initialWsChatLoadAnimation.messageIds);

  const animatedMessageIds = useMemo(
    () =>
      shouldAnimateInitialWsBatch ? initialWsChatLoadAnimation!.messageIds : [],
    [shouldAnimateInitialWsBatch, initialWsChatLoadAnimation],
  );
  const animatedOrder = useMemo(() => {
    const map = new Map<number, number>();
    animatedMessageIds.forEach((id, index) => {
      map.set(id, index);
    });
    return map;
  }, [animatedMessageIds]);
  const animatedTotalCount = animatedMessageIds.length;

  const viewersMenuItems = useMemo(
    () =>
      viewers.map((viewer) => ({
        label: viewer.user.username,
        subtitle: formatDateViewed(viewer.read_date),
        primaryMedia: selectedChat?.members?.find(
          (member) => member.id === viewer.user.id,
        )?.profile.primary_media,
        onClick: () => {
          handleCreateTemporaryChat(
            selectedChat?.members?.find((m) => m.id === viewer.user.id),
          );
        },
      })),
    [viewers, selectedChat?.members, handleCreateTemporaryChat],
  );

  return (
    <div
      className='room_div'
      ref={mergedRef}
      onPointerMove={(e) => {
        if (
          dragSelectionModeRef.current != null &&
          dragPointerIdRef.current === e.pointerId
        ) {
          applyPointerSelectionAtPoint(e.clientX, e.clientY);
          return;
        }
        const candidate = selectionGestureCandidateRef.current;
        if (
          candidate?.kind === 'mouse' &&
          candidate.pointerId === e.pointerId &&
          (e.buttons & 1) === 1
        ) {
          maybeActivateSelectionGesture(e.clientX, e.clientY, e.pointerId);
        }
      }}
      onPointerUp={stopPointerSelection}
      onPointerCancel={stopPointerSelection}
    >
      {menuVisible && (
        <>
          <Menu
            key={`message-context-menu-${menuInstanceKey}`}
            items={menuItems}
            position={menuPos || { x: 0, y: 0 }}
            hideToggle
            onClose={handleClose}
            isHiding={isMenuHiding}
            onAnimationEnd={handleAnimationEnd}
            onPositioned={handleMenuPositioned}
            onDropdownItemClick={onDropdownItemClick}
            menuGroupId={`message-context-${menuInstanceKey}`}
          />
          {menuRect && (
            <ReactionsPanel
              reactions={reactionItems}
              selectedReactionTypes={selectedReactionTypes}
              onReactionSelect={handleReactionSelect}
              menuRect={menuRect}
              visible={true}
              isHiding={isMenuHiding}
              menuGroupId={`message-context-${menuInstanceKey}`}
              onAnimationEnd={handleAnimationEnd}
            />
          )}
          {isNestedViewersMenuOpen && submenuPosition && submenuWidth && (
            <Menu
              key={`viewers-message-context-menu-${menuInstanceKey}`}
              items={viewersMenuItems}
              position={submenuPosition}
              open={true}
              onClose={closeNestedViewersMenu}
              hideToggle
              width={submenuWidth}
              openRight
              menuGroupId={`message-context-${menuInstanceKey}`}
            />
          )}
        </>
        // <ContextMenu
        //   key={`message-context-menu-${menuInstanceKey}`}
        //   items={menuItems}
        //   reactions={reactionItems}
        //   viewers={viewers}
        //   showViewers={viewersVisible}
        //   setShowViewers={setViewersVisible}
        //   selectedReactionTypes={selectedReactionTypes}
        //   onReactionSelect={handleReactionSelect}
        //   position={menuPos || { x: 0, y: 0 }}
        //   onClose={handleClose}
        //   onAnimationEnd={handleAnimationEnd}
        //   isHiding={isMenuHiding}
        // />
      )}

      <DatePickerModal
        isOpen={datePickerOpen}
        onClose={() => {
          setDatePickerOpen(false);
          setDatePickerInitialDate(null);
        }}
        availableDates={availableDates}
        initialDateKey={datePickerInitialDate}
        onSelectDate={handleDatePickerSelect}
      />

      {/* {messagesLoading && (
        <div className={styles['messages-loading']}>Loading</div>
      )} */}
      {/* {loadingOlderMessages && (
        <div className={styles['messages-loading']}>Loading older…</div>
      )}
      {loadingNewerMessages && (
        <div className={styles['messages-loading']}>Loading newer…</div>
      )} */}
      {messages.length === 0 && !messagesLoading && (
        <div className={styles['no-messages']}>No messages yet</div>
      )}
      {dateGroups.map((group) => (
        <div key={`date-group-${group.dateKey}`} className={styles.dateGroup}>
          <DateSeparator
            dateKey={group.dateKey}
            label={formatDateSeparatorLabel(group.dateKey)}
            onClick={() => handleDateSeparatorClick(group.dateKey)}
          />
          {group.messages
            .slice()
            .reverse()
            .map(({ message, isFirstInGroup, isLastInGroup }) => {
              const shouldAnimate =
                shouldAnimateInitialWsBatch && animatedOrder.has(message.id);
              let appearDelayMs: number | undefined;
              if (shouldAnimate) {
                const order = animatedOrder.get(message.id);
                if (order != null) {
                  if (order !== animatedTotalCount - 1) {
                    const reversedIndex = animatedTotalCount - 1 - order;
                    appearDelayMs = reversedIndex * 20;
                  }
                }
              }
              return (
                <Message
                  key={message.id}
                  message={message}
                  reelItems={reelItems}
                  onReactionClick={handleMessageReactionClick}
                  selectionMode={isSelectionMode}
                  isSelected={selectedMessageIds.has(message.id)}
                  onToggleSelect={() => onToggleMessageSelection(message.id)}
                  onPointerSelectStart={(pointerId) =>
                    handlePointerSelectionStart(
                      message.id,
                      selectedMessageIds.has(message.id),
                      pointerId,
                    )
                  }
                  onSelectionGestureCandidateStart={(
                    pointerId,
                    clientX,
                    clientY,
                  ) =>
                    beginSelectionGestureCandidate(
                      message.id,
                      selectedMessageIds.has(message.id),
                      pointerId,
                      clientX,
                      clientY,
                    )
                  }
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  appearDelayMs={appearDelayMs}
                />
              );
            })}
        </div>
      ))}
    </div>
  );
};

export default memo(MessageList);
