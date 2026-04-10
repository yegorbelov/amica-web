import React, {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import EditableAvatar from '@/components/Avatar/EditableAvatar';
import Avatar from '@/components/Avatar/Avatar';
import type { DisplayMedia } from '@/types';
import styles from './SideBarMedia.module.scss';
import { Menu, type MenuItem } from '@/components/ui/menu/Menu';
import { useTranslation } from '@/contexts/languageCore';

const LONG_PRESS_MS = 520;
const MOVE_CANCEL_PX = 14;

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
  onRollPositionChange: () => void;
  onAvatarRollerOpen: () => void;
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
}: {
  chatName: string;
  displayMedia: DisplayMedia;
  isAvatarRollerOpen: boolean;
  interlocutorEditVisible: boolean;
  showRollerMenu: boolean;
  openMenu: (x: number, y: number, media: DisplayMedia) => void;
}) {
  const handlers = useOpenRollerMediaMenu(
    showRollerMenu,
    openMenu,
    displayMedia,
  );

  return (
    <div
      className={styles['sidebar__avatar-slot']}
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
  avatarContentType = 'contact',
  isAvatarEditable = false,
  onAvatarChange = () => {},
  rollerActionsEnabled = false,
  onRollerMediaDelete,
  onRollerMediaSetPrimary,
}) => {
  const { t } = useTranslation();
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(
    null,
  );
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

  const menuItems = useMemo((): MenuItem<'delete' | 'setPrimary'>[] => {
    if (!menuMedia) return [];
    const isAlreadyPrimary =
      primaryMedia != null &&
      String(primaryMedia.id) === String(menuMedia.id);
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
        style={{
          transform: `translateX(${effectiveRollPosition * -100}%)`,
        }}
        onClick={onRollPositionChange}
      >
        <div
          className={styles['sidebar__avatar-slot']}
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
            {media.map((m: DisplayMedia) => (
              <SecondaryRollerAvatar
                key={m.id}
                chatName={chatName}
                displayMedia={m}
                isAvatarRollerOpen={isAvatarRollerOpen}
                interlocutorEditVisible={interlocutorEditVisible}
                showRollerMenu={showRollerMenu}
                openMenu={openMenu}
              />
            ))}
          </>
        )}
      </div>

      {menuPos && menuMedia && menuItems.length > 0 && (
        <Menu items={menuItems} position={menuPos} onClose={closeMenu} />
      )}
    </div>
  );
};

export default memo(SideBarAvatarSection);
