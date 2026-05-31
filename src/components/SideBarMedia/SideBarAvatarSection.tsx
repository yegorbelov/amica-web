import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import EditableAvatar from '@/components/Avatar/EditableAvatar';
import Avatar from '@/components/Avatar/Avatar';
import type { DisplayMedia } from '@/types';
import styles from './SideBarMedia.module.scss';
import { Menu, type MenuItem } from '@/components/ui/menu/Menu';
import { useTranslation } from '@/contexts/languageCore';

const LONG_PRESS_MS = 520;
const MOVE_CANCEL_PX = 14;
const MAX_ROLLER_DOTS = 5;
const ROLLER_DOT_SIZE_PX = 6;
const ROLLER_DOT_GAP_PX = 5;
const ROLLER_DOT_STEP_PX = ROLLER_DOT_SIZE_PX + ROLLER_DOT_GAP_PX;

function getRollerDotsWindow(active: number, total: number) {
  if (total <= MAX_ROLLER_DOTS) {
    return { start: 0, offsetPx: 0, viewportWidthPx: total * ROLLER_DOT_STEP_PX - ROLLER_DOT_GAP_PX };
  }

  const half = Math.floor(MAX_ROLLER_DOTS / 2);
  let start = Math.max(0, active - half);
  const end = start + MAX_ROLLER_DOTS;

  if (end > total) {
    start = total - MAX_ROLLER_DOTS;
  }

  return {
    start,
    offsetPx: start * ROLLER_DOT_STEP_PX,
    viewportWidthPx:
      MAX_ROLLER_DOTS * ROLLER_DOT_STEP_PX - ROLLER_DOT_GAP_PX,
  };
}

const DUMMY_DISPLAY_MEDIA: DisplayMedia = { id: -1, type: 'photo' };

interface SideBarAvatarSectionProps {
  chatId: number;
  chatName: string;
  primaryMedia: DisplayMedia | null | undefined;
  media: DisplayMedia[] | undefined;
  interlocutorContactId?: number;
  isAvatarRollerOpen: boolean;
  interlocutorEditVisible: boolean;
  effectiveRollPosition: number;
  onRollPositionChange: (clickX?: number, containerWidth?: number) => void;
  onAvatarRollerOpen: () => void;
  rollerScrollRef?: React.RefObject<HTMLDivElement | null>;
  avatarContentType?: string;
  isAvatarEditable?: boolean;
  onAvatarChange?: (media: DisplayMedia) => void;
  /** Long-press / right-click on a roller avatar opens a context menu. */
  rollerActionsEnabled?: boolean;
  onRollerMediaDelete?: (media: DisplayMedia) => Promise<void>;
  onRollerMediaSetPrimary?: (media: DisplayMedia) => Promise<void>;
}

function useOpenRollerMediaMenu(
  enabled: boolean,
  openMenu: (x: number, y: number, media: DisplayMedia) => void,
  media: DisplayMedia,
) {
  const timerRef = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      if (e.button !== 0) return;
      originRef.current = { x: e.clientX, y: e.clientY };
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        openMenu(e.clientX, e.clientY, media);
      }, LONG_PRESS_MS);
    },
    [enabled, openMenu, media, clearTimer],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (timerRef.current == null) return;
      const dx = e.clientX - originRef.current.x;
      const dy = e.clientY - originRef.current.y;
      if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
        clearTimer();
      }
    },
    [clearTimer],
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      clearTimer();
      openMenu(e.clientX, e.clientY, media);
    },
    [enabled, openMenu, media, clearTimer],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clearTimer,
    onPointerCancel: clearTimer,
    onPointerLeave: clearTimer,
    onContextMenu,
  };
}

const SecondaryRollerAvatar = memo(function SecondaryRollerAvatar({
  chatName,
  displayMedia,
  isAvatarRollerOpen,
  interlocutorEditVisible,
  showRollerMenu,
  openMenu,
  slotIndex,
}: {
  chatName: string;
  displayMedia: DisplayMedia;
  isAvatarRollerOpen: boolean;
  interlocutorEditVisible: boolean;
  showRollerMenu: boolean;
  openMenu: (x: number, y: number, media: DisplayMedia) => void;
  slotIndex: number;
}) {
  const handlers = useOpenRollerMediaMenu(
    showRollerMenu,
    openMenu,
    displayMedia,
  );

  return (
    <div
      className={styles['sidebar__avatar-slot']}
      data-roller-slot={slotIndex}
      {...(showRollerMenu ? handlers : {})}
    >
      <Avatar
        displayName={chatName}
        displayMedia={displayMedia}
        size={isAvatarRollerOpen ? 'medium' : 'small'}
        className={`${styles['sidebar__avatar']} ${
          isAvatarRollerOpen && !interlocutorEditVisible ? '' : styles.hidden
        }`}
      />
    </div>
  );
});

const SideBarAvatarSection: React.FC<SideBarAvatarSectionProps> = ({
  chatId,
  chatName,
  primaryMedia,
  media,
  interlocutorContactId,
  isAvatarRollerOpen,
  interlocutorEditVisible,
  effectiveRollPosition,
  onRollPositionChange,
  onAvatarRollerOpen,
  rollerScrollRef,
  avatarContentType = 'contact',
  isAvatarEditable = false,
  onAvatarChange = () => {},
  rollerActionsEnabled = false,
  onRollerMediaDelete,
  onRollerMediaSetPrimary,
}) => {
  const { t } = useTranslation();
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [menuMedia, setMenuMedia] = useState<DisplayMedia | null>(null);

  const showRollerMenu =
    rollerActionsEnabled &&
    !!(onRollerMediaDelete || onRollerMediaSetPrimary) &&
    isAvatarRollerOpen &&
    !interlocutorEditVisible;

  const openMenu = useCallback((x: number, y: number, m: DisplayMedia) => {
    setMenuPos({ x, y });
    setMenuMedia(m);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuPos(null);
    setMenuMedia(null);
  }, []);

  const primaryHandlers = useOpenRollerMediaMenu(
    showRollerMenu && !!primaryMedia,
    openMenu,
    primaryMedia ?? DUMMY_DISPLAY_MEDIA,
  );

  const totalRollerSlides = 1 + (media?.length ?? 0);
  const showRollerDots =
    isAvatarRollerOpen && !interlocutorEditVisible && totalRollerSlides > 1;

  const rollerDotsWindow = useMemo(
    () => getRollerDotsWindow(effectiveRollPosition, totalRollerSlides),
    [effectiveRollPosition, totalRollerSlides],
  );

  const handleRollerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isAvatarRollerOpen || interlocutorEditVisible) return;
      const { left, width } = e.currentTarget.getBoundingClientRect();
      onRollPositionChange(e.clientX - left, width);
    },
    [interlocutorEditVisible, isAvatarRollerOpen, onRollPositionChange],
  );

  const menuItems = useMemo((): MenuItem<'delete' | 'setPrimary'>[] => {
    if (!menuMedia) return [];
    const isAlreadyPrimary =
      primaryMedia != null && String(primaryMedia.id) === String(menuMedia.id);
    const items: MenuItem<'delete' | 'setPrimary'>[] = [];
    if (!isAlreadyPrimary && onRollerMediaSetPrimary) {
      items.push({
        label: t('sidebar.setAsPrimaryRollerAvatar'),
        icon: 'Photo',
        value: 'setPrimary',
        onClick: () => {
          const m = menuMedia;
          void (async () => {
            try {
              await onRollerMediaSetPrimary(m);
            } catch {
              /* parent shows toast */
            }
          })();
        },
      });
    }
    if (onRollerMediaDelete) {
      items.push({
        label: t('sidebar.deleteRollerAvatar'),
        icon: 'Delete',
        value: 'delete',
        destructive: true,
        onClick: () => {
          const m = menuMedia;
          void (async () => {
            try {
              await onRollerMediaDelete(m);
            } catch {
              /* parent shows toast */
            }
          })();
        },
      });
    }
    return items;
  }, [
    menuMedia,
    primaryMedia,
    onRollerMediaDelete,
    onRollerMediaSetPrimary,
    t,
  ]);

  return (
    <div
      className={`${styles['sidebar__avatar-container']} ${
        isAvatarRollerOpen && !interlocutorEditVisible
          ? styles['sidebar__avatar-container--roller']
          : ''
      }`}
    >
      <div
        className={`${styles['sidebar__avatar-wrapper']} ${
          interlocutorEditVisible ? styles['sidebar__avatar-wrapper--edit'] : ''
        } ${
          isAvatarRollerOpen && !interlocutorEditVisible
            ? styles['sidebar__avatar-wrapper--roller']
            : ''
        }`}
        onClick={isAvatarRollerOpen ? handleRollerClick : undefined}
      >
        <div
          ref={rollerScrollRef}
          className={`${styles['sidebar__avatar-roller-viewport']} ${
            isAvatarRollerOpen && !interlocutorEditVisible
              ? styles['sidebar__avatar-roller-viewport--active']
              : ''
          }`}
        >
          <div className={styles['sidebar__avatar-roller-track']}>
            <div
              className={styles['sidebar__avatar-slot']}
              data-roller-slot={0}
              {...(showRollerMenu && primaryMedia ? primaryHandlers : {})}
            >
              <EditableAvatar
                key={chatId}
                displayName={chatName}
                avatar={primaryMedia}
                objectId={interlocutorContactId ?? 0}
                contentType={avatarContentType}
                className={styles['sidebar__avatar']}
                classNameAvatar={styles['sidebar__editable-avatar']}
                isAvatarRollerOpen={isAvatarRollerOpen}
                onClick={
                  primaryMedia && !interlocutorEditVisible
                    ? (e) => {
                        if (!isAvatarRollerOpen) {
                          e.stopPropagation();
                          onAvatarRollerOpen();
                        }
                      }
                    : undefined
                }
                onAvatarChange={onAvatarChange}
                isEditable={isAvatarEditable || interlocutorEditVisible}
              />
            </div>
            {media && media.length > 0 && (
              <>
                {media.map((m: DisplayMedia, index: number) => (
                  <SecondaryRollerAvatar
                    key={m.id}
                    chatName={chatName}
                    displayMedia={m}
                    isAvatarRollerOpen={isAvatarRollerOpen}
                    interlocutorEditVisible={interlocutorEditVisible}
                    showRollerMenu={showRollerMenu}
                    openMenu={openMenu}
                    slotIndex={index + 1}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {showRollerDots && (
          <div
            className={styles['sidebar__avatar-roller-dots']}
            aria-hidden
          >
            <div
              className={styles['sidebar__avatar-roller-dots-viewport']}
              style={{ width: rollerDotsWindow.viewportWidthPx }}
            >
              <div
                className={styles['sidebar__avatar-roller-dots-track']}
                style={{ transform: `translateX(-${rollerDotsWindow.offsetPx}px)` }}
              >
                {Array.from({ length: totalRollerSlides }, (_, index) => {
                  const isActive = index === effectiveRollPosition;
                  const isEdgeLeft =
                    !isActive &&
                    totalRollerSlides > MAX_ROLLER_DOTS &&
                    index === rollerDotsWindow.start &&
                    rollerDotsWindow.start > 0;
                  const isEdgeRight =
                    !isActive &&
                    totalRollerSlides > MAX_ROLLER_DOTS &&
                    index === rollerDotsWindow.start + MAX_ROLLER_DOTS - 1 &&
                    rollerDotsWindow.start + MAX_ROLLER_DOTS < totalRollerSlides;

                  return (
                    <span
                      key={index}
                      className={`${styles['sidebar__avatar-roller-dot']} ${
                        isActive
                          ? styles['sidebar__avatar-roller-dot--active']
                          : ''
                      } ${
                        isEdgeLeft || isEdgeRight
                          ? styles['sidebar__avatar-roller-dot--edge']
                          : ''
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {menuPos && menuMedia && menuItems.length > 0 && (
        <Menu items={menuItems} position={menuPos} onClose={closeMenu} />
      )}
    </div>
  );
};

export default memo(SideBarAvatarSection);
