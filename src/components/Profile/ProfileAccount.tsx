import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useUser } from '@/contexts/UserContextCore';
import styles from './Profile.module.scss';
import { useTranslation } from '@/contexts/languageCore';
import { useToast } from '@/contexts/toast/ToastContextCore';
import { Icon } from '../Icons/AutoIcons';
import Input from '@/components/SideBarMedia/Input';
import SideBarAvatarSection from '@/components/SideBarMedia/SideBarAvatarSection';
import { useProfileAccountSaveRegistrationSetter } from './ProfileAccountSaveContext';
import { useAvatarRoller } from '@/components/SideBarMedia/hooks/useAvatarRoller';
import { websocketManager } from '@/utils/websocket-manager';
import type { WebSocketMessage } from '@/utils/websocket-manager';
import type { DisplayMedia, User, UserProfile } from '@/types';
import {
  deleteDisplayMediaById,
  setDisplayMediaAsPrimary,
} from '@/utils/deleteDisplayMedia';

const logoutIcon = <Icon name='Logout' className={styles.logoutIcon} />;

export default function ProfileAccount() {
  const { user, logout, setUser, refreshUser } = useUser();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const setHeaderRegistration = useProfileAccountSaveRegistrationSetter();
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameEditing, setUsernameEditing] = useState(false);

  const avatarLayoutRef = useRef<HTMLDivElement>(null);
  const wheelTargetRef = useRef<HTMLElement | null>(null);
  const [wheelTargetKey, setWheelTargetKey] = useState(0);

  const chatIdKey = user?.id != null ? String(user.id) : '';
  const profileMedia = user?.profile?.media ?? [];
  const primaryMedia = user?.profile?.primary_media;
  const profileId = user?.profile?.id ?? 0;
  const displayName = user?.username || '';

  useLayoutEffect(() => {
    const bumpKey = () =>
      queueMicrotask(() => setWheelTargetKey((k) => k + 1));
    const start = avatarLayoutRef.current;
    if (!start) {
      wheelTargetRef.current = null;
      bumpKey();
      return;
    }
    let p: HTMLElement | null = start.parentElement;
    while (p) {
      const { overflowY } = getComputedStyle(p);
      if (overflowY === 'auto' || overflowY === 'scroll') {
        wheelTargetRef.current = p;
        bumpKey();
        return;
      }
      p = p.parentElement;
    }
    wheelTargetRef.current = start;
    bumpKey();
  }, [chatIdKey]);

  const {
    isAvatarRollerOpen,
    setIsAvatarRollerOpen,
    effectiveRollPosition,
    handleRollPositionChange,
    setRollPosition,
  } = useAvatarRoller(
    chatIdKey,
    profileMedia.length,
    !!primaryMedia,
    avatarLayoutRef,
    usernameEditing,
    true,
    wheelTargetRef,
    wheelTargetKey,
  );

  useEffect(() => {
    if (!usernameEditing) return;
    queueMicrotask(() => {
      setIsAvatarRollerOpen(false);
      setRollPosition(0);
    });
  }, [usernameEditing, setIsAvatarRollerOpen, setRollPosition]);

  const enterUsernameEdit = useCallback(() => {
    setUsernameEditing(true);
    setUsernameDraft(user?.username ?? '');
  }, [user?.username]);

  const saveUsername = useCallback(() => {
    const next = usernameDraft.trim();
    if (!next || next.length > 64) {
      showToast(t('profile.usernameInvalid'));
      return;
    }
    if (next === (user?.username ?? '').trim()) {
      setUsernameEditing(false);
      return;
    }

    const onResp = (
      data: WebSocketMessage & { user?: unknown; error?: string },
    ) => {
      if (data.type !== 'update_username_response') return;
      websocketManager.off('update_username_response', onResp);
      if (data.error) showToast(data.error);
      else if (data.user) {
        setUser(data.user as User);
        setUsernameEditing(false);
      }
    };

    websocketManager.on('update_username_response', onResp);
    if (!websocketManager.sendUpdateUsername(next)) {
      websocketManager.off('update_username_response', onResp);
      showToast(t('toast.wsSendFailed'));
    }
  }, [usernameDraft, user?.username, setUser, showToast, t]);

  const saveDisabled = useMemo(() => {
    const next = usernameDraft.trim();
    return !next || next.length > 64;
  }, [usernameDraft]);

  const discardUsernameEdit = useCallback(() => {
    setUsernameEditing(false);
    setUsernameDraft(user?.username ?? '');
  }, [user?.username]);

  useEffect(() => {
    if (!setHeaderRegistration) return;
    setHeaderRegistration({
      usernameEditing,
      onPrimaryAction: usernameEditing ? saveUsername : enterUsernameEdit,
      primaryDisabled: usernameEditing ? saveDisabled : false,
      discardUsernameEdit,
    });
    return () => setHeaderRegistration(null);
  }, [
    setHeaderRegistration,
    usernameEditing,
    saveUsername,
    enterUsernameEdit,
    saveDisabled,
    discardUsernameEdit,
  ]);

  const handleRollerMediaDelete = useCallback(
    async (media: DisplayMedia) => {
      if (!user?.profile) return;
      try {
        await deleteDisplayMediaById(media.id);
        const profile = user.profile;
        const remaining = profile.media.filter((m) => m.id !== media.id);
        const wasPrimary = profile.primary_media?.id === media.id;
        const primary_media = wasPrimary
          ? (remaining[0] ?? profile.primary_media)
          : profile.primary_media;
        setUser({
          ...user,
          profile: {
            ...profile,
            media: remaining,
            primary_media,
          } as UserProfile,
        });
        setRollPosition(0);
        void refreshUser();
      } catch {
        showToast(t('toast.avatarDeleteFailed'));
      }
    },
    [user, setUser, setRollPosition, refreshUser, showToast, t],
  );

  const handleRollerMediaSetPrimary = useCallback(
    async (media: DisplayMedia) => {
      if (!user?.profile) return;
      try {
        const updated = await setDisplayMediaAsPrimary(media.id);
        setUser({
          ...user,
          profile: {
            ...user.profile,
            primary_media: updated,
          } as UserProfile,
        });
        setRollPosition(0);
        void refreshUser();
      } catch {
        showToast(t('toast.setPrimaryFailed'));
      }
    },
    [user, setUser, setRollPosition, refreshUser, showToast, t],
  );

  return (
    <div className={styles.section}>
      <div ref={avatarLayoutRef} className={styles.accountAvatarOuter}>
        {user?.id != null && (
          <SideBarAvatarSection
            chatId={user.id}
            chatName={displayName}
            primaryMedia={primaryMedia}
            media={profileMedia}
            interlocutorContactId={profileId}
            avatarContentType='profile'
            isAvatarEditable={usernameEditing}
            onAvatarChange={(media: DisplayMedia) => {
              setUser({
                ...(user as User | null),
                profile: {
                  ...(user?.profile as UserProfile),
                  primary_media: media,
                } as UserProfile,
              } as User);
            }}
            isAvatarRollerOpen={isAvatarRollerOpen}
            interlocutorEditVisible={usernameEditing}
            effectiveRollPosition={effectiveRollPosition}
            onRollPositionChange={handleRollPositionChange}
            onAvatarRollerOpen={() => setIsAvatarRollerOpen(true)}
            rollerActionsEnabled
            onRollerMediaDelete={handleRollerMediaDelete}
            onRollerMediaSetPrimary={handleRollerMediaSetPrimary}
          />
        )}
      </div>

      <div className={styles.accountUsernameRow}>
        {usernameEditing ? (
          <Input
            placeholder={t('profile.username')}
            value={usernameDraft}
            onChange={(v) => setUsernameDraft(v.slice(0, 64))}
          />
        ) : (
          <div className={styles.accountUsernameReadonly} aria-readonly>
            {user?.username || '—'}
          </div>
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.email}>{user?.email || ''}</div>
      </div>

      <div tabIndex={0} onClick={logout} className={styles.logoutBtn}>
        {logoutIcon}
        {t('profile.signOut')}
      </div>
    </div>
  );
}
