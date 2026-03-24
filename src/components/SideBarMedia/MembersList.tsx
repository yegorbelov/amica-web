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
  members: User[];
}

const MembersList: React.FC<MembersListProps> = ({ chatId, members }) => {
  const { t } = useTranslation();
  const { formatLastSeen } = useFormatLastSeen();
  const { showToast } = useToast();
  const { showSnackbar } = useSnackbar();
  const { fetchChats, handleChatClick } = useChatMeta();
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
    for (const contact of selectedContacts) {
      const uid = contact.user_id;
      if (uid == null) continue;
      const sent = websocketManager.sendAddGroupMember(chatId, uid);
      if (!sent) {
        showToast(t('toast.wsSendFailed'));
        return;
      }
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

  const handleMemberContextMenu = useCallback(
    (userId: number, position: { x: number; y: number }) => {
      setContextMenuUserId(userId);
      setMenuPosition(position);
      setContextMenuInstanceKey((prev) => prev + 1);
    },
    [],
  );

  const contextMenuItems = useMemo<MenuItem<string>[]>(() => {
    if (contextMenuUserId == null) return [];
    const targetId = contextMenuUserId;
    return [
      {
        label: t('sidebar.removeMember'),
        icon: 'Delete',
        destructive: true,
        onClick: () => {
          setContextMenuUserId(null);
          removeMember(targetId);
        },
      },
    ];
  }, [contextMenuUserId, removeMember, t]);

  const handleLeaveGroup = useCallback(() => {
    if (me?.id == null) return;
    leaveGroupSnackPendingRef.current = true;
    removeMember(me.id);
  }, [me, removeMember]);

  return (
    <div className={styles.membersList}>
      <Button className={styles.membersListButton} onClick={handleAddMember}>
        {t('sidebar.addMember')}
      </Button>
      {me?.id != null && (
        <Button
          variant='secondary'
          className={styles.membersListLeaveButton}
          onClick={handleLeaveGroup}
        >
          {t('sidebar.leaveGroup')}
        </Button>
      )}
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
    </div>
  );
};

export default memo(MembersList);
