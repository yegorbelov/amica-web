import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Avatar from '@/components/Avatar/Avatar';
import { useFormatLastSeen } from '@/hooks/useFormatLastSeen';
import { useTranslation } from '@/contexts/languageCore';
import { useToast } from '@/contexts/toast/ToastContextCore';
import { useSnackbar } from '@/contexts/snackbar/SnackbarContextCore';
import { useContacts } from '@/contexts/contacts/useContacts';
import { useUser } from '@/contexts/UserContextCore';
import { useChatMeta } from '@/contexts/ChatContextCore';
import { websocketManager } from '@/utils/websocket-manager';
import { joinGroup } from '@/providers/searchGlobal';
import type { Contact, User } from '@/types';
import type { WebSocketMessage } from '@/utils/websocket-manager';
import styles from './SideBarMedia.module.scss';
import Button from '../ui/button/Button';
import { Menu } from '../ui/menu/Menu';
import { Icon } from '../Icons/AutoIcons';
import type { MenuItem } from '../ui/menu/Menu';
import { formatLastSeenShort } from '@/utils/activityFormatter';
import SearchInput from '../ui/searchInput/SearchInput';

interface MembersListProps {
  chatId: number;
  chatType: 'G' | 'C';
  myRole?: 'owner' | 'admin' | 'member' | 'subscriber' | null;
  members: User[];
  onCloseSidebar?: () => void;
}

const MembersList: React.FC<MembersListProps> = ({
  chatId,
  chatType,
  myRole,
  members,
  onCloseSidebar,
}) => {
  const { t } = useTranslation();
  const { formatLastSeen } = useFormatLastSeen();
  const { showToast } = useToast();
  const { showSnackbar } = useSnackbar();
  const { fetchChats, handleChatClick, leaveChannelToPreview } =
    useChatMeta();
  const { contacts } = useContacts();
  const { user: me } = useUser();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pendingWsListenerRef = useRef<
    ((data: WebSocketMessage) => void) | null
  >(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuInstanceKey, setContextMenuInstanceKey] = useState(0);
  const [contextMenuUserId, setContextMenuUserId] = useState<number | null>(
    null,
  );
  const leaveGroupSnackPendingRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [soleAdminModalOpen, setSoleAdminModalOpen] = useState(false);
  const [soleAdminSearchQuery, setSoleAdminSearchQuery] = useState('');

  const isSoleAdmin = useMemo(() => {
    if (chatType !== 'C' || myRole !== 'admin' || me?.id == null) return false;
    const admins = members.filter((m) => m.chat_role === 'admin');
    return admins.length === 1 && admins[0]?.id === me.id;
  }, [chatType, myRole, members, me?.id]);

  const subscriberMemberIds = useMemo(() => {
    const s = new Set<number>();
    for (const m of members) {
      if (m.id === me?.id) continue;
      if (m.chat_role === 'owner' || m.chat_role === 'admin') continue;
      s.add(m.id);
    }
    return s;
  }, [members, me?.id]);

  const successorCandidates = useMemo(() => {
    return contacts.filter((c: Contact) => {
      if (c.user_id == null) return false;
      return subscriberMemberIds.has(c.user_id);
    });
  }, [contacts, subscriberMemberIds]);

  const filteredSuccessorContacts = useMemo(() => {
    const q = soleAdminSearchQuery.toLowerCase();
    return successorCandidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false),
    );
  }, [successorCandidates, soleAdminSearchQuery]);

  const showAddMember = chatType === 'G';
  const showLeave =
    (chatType === 'G' || chatType === 'C') && me?.id != null;
  const canModerateChannel =
    chatType === 'C' &&
    (myRole === 'owner' || myRole === 'admin');

  useEffect(() => {
    return () => {
      if (pendingWsListenerRef.current) {
        websocketManager.off('message', pendingWsListenerRef.current);
        pendingWsListenerRef.current = null;
      }
      leaveGroupSnackPendingRef.current = false;
    };
  }, []);

  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);

  const addableContacts = useMemo(() => {
    return contacts.filter((c: Contact) => {
      if (c.user_id == null) return false;
      if (me?.id != null && c.user_id === me.id) return false;
      return !memberIds.has(c.user_id);
    });
  }, [contacts, memberIds, me]);

  const filteredContacts = useMemo(() => {
    return addableContacts.filter(
      (c: Contact) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [addableContacts, searchQuery]);

  const clearPendingWs = useCallback(() => {
    if (pendingWsListenerRef.current) {
      websocketManager.off('message', pendingWsListenerRef.current);
      pendingWsListenerRef.current = null;
    }
  }, []);

  const closePicker = useCallback(() => {
    clearPendingWs();
    setPickerOpen(false);
  }, [clearPendingWs]);

  const handleAddMember = useCallback(() => {
    setPickerOpen(true);
  }, []);

  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);

  const handleSelectContact = useCallback((contact: Contact) => {
    setSelectedContacts((prev) => [...prev, contact]);
  }, []);

  const handleUnselectContact = useCallback((contact: Contact) => {
    setSelectedContacts((prev) => prev.filter((c) => c.id !== contact.id));
  }, []);

  const handleSaveContacts = useCallback(() => {
    const userIds = selectedContacts
      .map((c) => c.user_id)
      .filter((uid): uid is number => uid != null);
    if (userIds.length === 0) {
      closePicker();
      return;
    }
    const sent = websocketManager.sendAddGroupMembers(chatId, userIds);
    if (!sent) {
      showToast(t('toast.wsSendFailed'));
      return;
    }
    setSelectedContacts([]);
    closePicker();
  }, [chatId, closePicker, selectedContacts, showToast, t]);

  const handleCancelContacts = useCallback(() => {
    setSelectedContacts([]);
    closePicker();
  }, [closePicker]);

  const pickContact = useCallback(
    (contact: Contact) => {
      if (selectedContacts.some((c) => c.id === contact.id)) {
        handleUnselectContact(contact);
      } else {
        handleSelectContact(contact);
      }
    },
    [handleSelectContact, handleUnselectContact, selectedContacts],
  );

  const removeMember = useCallback(
    (targetUserId: number) => {
      clearPendingWs();

      const onMessage = (data: WebSocketMessage) => {
        if (data.type === 'error' && typeof data.message === 'string') {
          leaveGroupSnackPendingRef.current = false;
          showToast(data.message);
          clearPendingWs();
          return;
        }
        if (data.type === 'group_members_updated' && data.chat_id === chatId) {
          clearPendingWs();
          return;
        }
        if (data.type === 'chat_deleted' && data.chat_id === chatId) {
          if (leaveGroupSnackPendingRef.current) {
            leaveGroupSnackPendingRef.current = false;
            const rejoinedId = chatId;
            showSnackbar(t('chat.leftGroup'), {
              duration: 5000,
              actionLabel: t('buttons.undo'),
              onAction: () => {
                void (async () => {
                  const ok = await joinGroup(rejoinedId);
                  if (!ok) {
                    showToast(t('toast.joinGroupFailed'));
                    return;
                  }
                  await fetchChats();
                  handleChatClick(rejoinedId);
                })();
              },
            });
          }
          clearPendingWs();
        }
      };

      pendingWsListenerRef.current = onMessage;
      websocketManager.on('message', onMessage);
      const sent = websocketManager.sendRemoveGroupMember(chatId, targetUserId);
      if (!sent) {
        leaveGroupSnackPendingRef.current = false;
        clearPendingWs();
        showToast(t('toast.wsSendFailed'));
      }
    },
    [
      chatId,
      clearPendingWs,
      fetchChats,
      handleChatClick,
      showSnackbar,
      showToast,
      t,
    ],
  );

  const sendChannelRoleChange = useCallback(
    (targetUserId: number, role: 'admin' | 'subscriber') => {
      clearPendingWs();
      const onMessage = (data: WebSocketMessage) => {
        if (data.type === 'error' && typeof data.message === 'string') {
          showToast(data.message);
          clearPendingWs();
          return;
        }
        if (data.type === 'group_members_updated' && data.chat_id === chatId) {
          clearPendingWs();
        }
      };
      pendingWsListenerRef.current = onMessage;
      websocketManager.on('message', onMessage);
      if (!websocketManager.sendSetChannelMemberRole(chatId, targetUserId, role)) {
        clearPendingWs();
        showToast(t('toast.wsSendFailed'));
      }
    },
    [chatId, clearPendingWs, showToast, t],
  );

  const removeMemberRef = useRef(removeMember);
  const sendChannelRoleChangeRef = useRef(sendChannelRoleChange);
  useEffect(() => {
    removeMemberRef.current = removeMember;
    sendChannelRoleChangeRef.current = sendChannelRoleChange;
  }, [removeMember, sendChannelRoleChange]);

  const onMembersMenuAction = useCallback(
    (
      action: 'remove' | 'promote' | 'demote',
      targetUserId: number,
    ) => {
      setContextMenuUserId(null);
      if (action === 'remove') {
        removeMemberRef.current(targetUserId);
      } else if (action === 'promote') {
        sendChannelRoleChangeRef.current(targetUserId, 'admin');
      } else {
        sendChannelRoleChangeRef.current(targetUserId, 'subscriber');
      }
    },
    [],
  );

  const handleMemberContextMenu = useCallback(
    (userId: number, position: { x: number; y: number }) => {
      setContextMenuUserId(userId);
      setMenuPosition(position);
      setContextMenuInstanceKey((prev) => prev + 1);
    },
    [],
  );

  /* eslint-disable react-hooks/refs -- item onClick runs on user gesture; stable handler uses refs updated in useEffect */
  let contextMenuItems: MenuItem<string>[] = [];
  if (contextMenuUserId != null) {
    const targetId = contextMenuUserId;
    const target = members.find((m) => m.id === targetId);
    if (target && me?.id !== targetId) {
      if (chatType === 'G') {
        contextMenuItems = [
          {
            label: t('sidebar.removeMember'),
            icon: 'Delete',
            destructive: true,
            onClick: () => onMembersMenuAction('remove', targetId),
          },
        ];
      } else if (canModerateChannel) {
        const role = target.chat_role;
        if (role !== 'owner') {
          const items: MenuItem<string>[] = [];

          if (role === 'subscriber' || role === undefined) {
            items.push({
              label: t('sidebar.promoteToAdmin'),
              icon: 'Edit',
              onClick: () => onMembersMenuAction('promote', targetId),
            });
          }

          if (role === 'admin' && myRole === 'owner') {
            items.push({
              label: t('sidebar.demoteToSubscriber'),
              onClick: () => onMembersMenuAction('demote', targetId),
            });
          }

          items.push({
            label: t('sidebar.removeMember'),
            icon: 'Delete',
            destructive: true,
            onClick: () => onMembersMenuAction('remove', targetId),
          });

          contextMenuItems = items;
        }
      }
    }
  }
  /* eslint-enable react-hooks/refs */

  const handleAppointSuccessorAndLeave = useCallback(
    (contact: Contact) => {
      const uid = contact.user_id;
      if (uid == null) return;
      clearPendingWs();
      const onMessage = (data: WebSocketMessage) => {
        if (data.type === 'error' && typeof data.message === 'string') {
          showToast(data.message);
          clearPendingWs();
          return;
        }
        if (data.type === 'group_members_updated' && data.chat_id === chatId) {
          clearPendingWs();
          setSoleAdminModalOpen(false);
          setSoleAdminSearchQuery('');
          void leaveChannelToPreview(chatId).then((ok) => {
            if (ok) onCloseSidebar?.();
            else showToast(t('toast.wsSendFailed'));
          });
        }
      };
      pendingWsListenerRef.current = onMessage;
      websocketManager.on('message', onMessage);
      if (!websocketManager.sendSetChannelMemberRole(chatId, uid, 'admin')) {
        clearPendingWs();
        showToast(t('toast.wsSendFailed'));
      }
    },
    [
      chatId,
      clearPendingWs,
      leaveChannelToPreview,
      onCloseSidebar,
      showToast,
      t,
    ],
  );

  const handleSoleAdminLeaveAnyway = useCallback(() => {
    setSoleAdminModalOpen(false);
    setSoleAdminSearchQuery('');
    void leaveChannelToPreview(chatId).then((ok) => {
      if (ok) onCloseSidebar?.();
      else showToast(t('toast.wsSendFailed'));
    });
  }, [chatId, leaveChannelToPreview, onCloseSidebar, showToast, t]);

  const handleLeaveGroup = useCallback(() => {
    if (me?.id == null) return;
    if (chatType === 'G') {
      leaveGroupSnackPendingRef.current = true;
      removeMember(me.id);
      return;
    }
    if (chatType === 'C') {
      if (isSoleAdmin) {
        setSoleAdminModalOpen(true);
        return;
      }
      void leaveChannelToPreview(chatId).then((ok) => {
        if (ok) onCloseSidebar?.();
        else showToast(t('toast.wsSendFailed'));
      });
    }
  }, [
    chatId,
    chatType,
    isSoleAdmin,
    leaveChannelToPreview,
    me,
    onCloseSidebar,
    removeMember,
    showToast,
    t,
  ]);

  return (
    <div className={styles.membersList}>
      {showAddMember ? (
        <Button className={styles.membersListButton} onClick={handleAddMember}>
          {t('sidebar.addMember')}
        </Button>
      ) : null}
      {showLeave ? (
        <Button
          variant='secondary'
          className={styles.membersListLeaveButton}
          onClick={handleLeaveGroup}
        >
          {chatType === 'C'
            ? t('sidebar.leaveChannel')
            : t('sidebar.leaveGroup')}
        </Button>
      ) : null}
      {contextMenuUserId != null && (
        <Menu
          key={`members-context-menu-${contextMenuInstanceKey}`}
          position={menuPosition}
          items={contextMenuItems}
          hideToggle
          onClose={() => setContextMenuUserId(null)}
        />
      )}
      {members.map((member) => (
        <div
          key={member.id}
          className={styles.memberItem}
          onContextMenu={(e) => {
            if (chatType === 'G') {
              e.preventDefault();
              handleMemberContextMenu(member.id, {
                x: e.clientX,
                y: e.clientY,
              });
              return;
            }
            if (!canModerateChannel) return;
            if (member.chat_role === 'owner') return;
            e.preventDefault();
            handleMemberContextMenu(member.id, {
              x: e.clientX,
              y: e.clientY,
            });
          }}
        >
          <Avatar
            className={styles.memberAvatar}
            displayMedia={member.profile.primary_media}
            displayName={member.username}
          />
          <div className={styles.memberInfo}>
            <span className={styles.memberName}>{member.username}</span>
            <span className={styles.memberLastSeen}>
              {formatLastSeen(member.last_seen)}
            </span>
          </div>
        </div>
      ))}

      {pickerOpen && (
        <div
          className={styles.membersPickerOverlay}
          role='presentation'
          onClick={closePicker}
        >
          <div
            className={styles.membersPickerModal}
            role='dialog'
            aria-labelledby='members-picker-title'
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.membersPickerHeader}>
              <div className={styles.membersPickerHeaderTitle}>
                <h2
                  id='members-picker-title'
                  className={styles.membersPickerTitle}
                >
                  {t('sidebar.addMemberTitle')}
                </h2>
                <Button
                  className={styles.membersPickerClose}
                  onClick={handleCancelContacts}
                  aria-label={t('buttons.close')}
                >
                  Cancel
                </Button>
                <Button
                  className={styles.membersPickerClose}
                  onClick={handleSaveContacts}
                  aria-label={t('buttons.close')}
                >
                  Save
                </Button>
              </div>
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder='Search for usernames'
              />
            </div>
            <ul className={styles.membersPickerList}>
              {filteredContacts.length === 0 && (
                <li className={styles.membersPickerEmpty}>
                  {t('sidebar.addMemberNoContacts')}
                </li>
              )}
              {filteredContacts.map((contact: Contact) => (
                <li key={contact.id}>
                  <button
                    type='button'
                    className={`${styles.membersPickerRow} ${selectedContacts.some((c) => c.id === contact.id) ? styles.membersPickerRowSelected : ''}`}
                    onClick={() => pickContact(contact)}
                  >
                    <div className={styles.membersPickerRowCheckbox}>
                      <Icon
                        name={
                          selectedContacts.some((c) => c.id === contact.id)
                            ? 'Select'
                            : 'Circle'
                        }
                        className={styles.membersPickerRowCheckboxIcon}
                      />
                    </div>
                    <Avatar
                      className={styles.membersPickerAvatar}
                      displayName={contact.name}
                      displayMedia={contact.primary_media}
                    />
                    <div className={styles.membersPickerInfoContainer}>
                      <span className={styles.membersPickerName}>
                        {contact.name}
                      </span>
                      <span className={styles.membersPickerInfo}>
                        {formatLastSeenShort(contact.last_seen)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {soleAdminModalOpen && (
        <div
          className={styles.membersPickerOverlay}
          role='presentation'
          onClick={() => {
            setSoleAdminModalOpen(false);
            setSoleAdminSearchQuery('');
          }}
        >
          <div
            className={`${styles.membersPickerModal} ${styles.soleAdminLeaveModal}`}
            role='alertdialog'
            aria-labelledby='sole-admin-leave-title'
            aria-describedby='sole-admin-leave-desc'
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id='sole-admin-leave-title'
              className={styles.membersPickerTitle}
            >
              {t('sidebar.soleAdminLeaveTitle')}
            </h2>
            <div
              id='sole-admin-leave-desc'
              className={styles.soleAdminWarning}
            >
              {t('sidebar.soleAdminLeaveWarning')}
            </div>
            <p className={styles.soleAdminPickHint}>
              {t('sidebar.soleAdminPickHint')}
            </p>
            <SearchInput
              value={soleAdminSearchQuery}
              onChange={setSoleAdminSearchQuery}
              placeholder={t('sidebar.soleAdminSearchPlaceholder')}
            />
            <ul className={styles.membersPickerList}>
              {filteredSuccessorContacts.length === 0 && (
                <li className={styles.membersPickerEmpty}>
                  {successorCandidates.length === 0
                    ? t('sidebar.soleAdminNoSubscribersInContacts')
                    : t('sidebar.soleAdminNoSearchResults')}
                </li>
              )}
              {filteredSuccessorContacts.map((contact: Contact) => (
                <li key={contact.id}>
                  <button
                    type='button'
                    className={styles.membersPickerRow}
                    onClick={() => handleAppointSuccessorAndLeave(contact)}
                  >
                    <Avatar
                      className={styles.membersPickerAvatar}
                      displayName={contact.name}
                      displayMedia={contact.primary_media}
                    />
                    <div className={styles.membersPickerInfoContainer}>
                      <span className={styles.membersPickerName}>
                        {contact.name}
                      </span>
                      <span className={styles.membersPickerInfo}>
                        {formatLastSeenShort(contact.last_seen)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className={styles.soleAdminActions}>
              <Button
                type='button'
                variant='secondary'
                onClick={() => {
                  setSoleAdminModalOpen(false);
                  setSoleAdminSearchQuery('');
                }}
              >
                {t('buttons.cancel')}
              </Button>
              <Button
                type='button'
                variant='secondary'
                onClick={handleSoleAdminLeaveAnyway}
              >
                {t('sidebar.soleAdminLeaveAnyway')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(MembersList);
