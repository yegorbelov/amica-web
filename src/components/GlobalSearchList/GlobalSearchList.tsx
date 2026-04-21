import { useMemo } from 'react';
import { useSearchContext } from '@/contexts/search/SearchContextCore';
import type { GlobalSearchItem } from '@/contexts/search/globalSearchTypes';
import styles from './GlobalSearchList.module.scss';
import Avatar from '../Avatar/Avatar';
import { useChatMeta } from '@/contexts/ChatContextCore';
import { useSettings } from '@/contexts/settings/context';
import { useTabs } from '@/components/Tabs/tabsShared';
import { useTranslation } from '@/contexts/languageCore';
import { useToast } from '@/contexts/toast/ToastContextCore';
import { Icon } from '../Icons/AutoIcons';
import { joinGroup } from '@/providers/searchGlobal';

const GlobalSearchList: React.FC = () => {
  const { results, clear, term } = useSearchContext<GlobalSearchItem>();
  const {
    handleCreateTemporaryChat,
    handleChatClick,
    fetchChats,
    handleCreateTemporaryChannelPreview,
  } = useChatMeta();
  const { setActiveProfileTab } = useSettings();
  const { setActiveTab } = useTabs();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const handleSelect = (item: GlobalSearchItem) => {
    if (item.type === 'user') {
      const dmId = item.data.dm_chat_id;
      if (dmId != null) {
        window.history.pushState({}, '', `#${dmId}`);
        handleChatClick(dmId);
      } else {
        handleCreateTemporaryChat(item.data);
      }
      clear();
      return;
    }
    if (item.type === 'contact') {
      handleChatClick(item.data.chat_id);
      clear();
      return;
    }
    if (item.type === 'group') {
      const row = item.data;
      const chatId = row.id;
      if (row.is_member) {
        window.history.pushState({}, '', `#${chatId}`);
        handleChatClick(chatId);
        clear();
        return;
      }
      if (row.type === 'C') {
        handleCreateTemporaryChannelPreview(row);
        clear();
        return;
      }
      void (async () => {
        const ok = await joinGroup(chatId);
        if (!ok) {
          showToast(t('toast.joinGroupFailed'));
          clear();
          return;
        }
        await fetchChats();
        window.history.pushState({}, '', `#${chatId}`);
        handleChatClick(chatId);
        clear();
      })();
      return;
    }
    if (item.type === 'setting' && item.data.id) {
      setActiveProfileTab(item.data.id);
      setActiveTab('profile');
    }
    clear();
  };

  // if (loading) return <div className={styles.loading}>Loading...</div>;
  // if (error) return <div className={styles.error}>{error}</div>;
  const { users, contacts, groups, settings } = useMemo(() => {
    return {
      users: results.filter(
        (r): r is GlobalSearchItem & { type: 'user' } => r.type === 'user',
      ),
      contacts: results.filter(
        (r): r is GlobalSearchItem & { type: 'contact' } =>
          r.type === 'contact',
      ),
      groups: results.filter(
        (r): r is GlobalSearchItem & { type: 'group' } => r.type === 'group',
      ),
      settings: results.filter(
        (r): r is GlobalSearchItem & { type: 'setting' } =>
          r.type === 'setting',
      ),
    };
  }, [results]);

  const renderItem = (item: GlobalSearchItem, key: string) => (
    <li
      key={key}
      className={styles['search-item']}
      onMouseDown={(e) => {
        e.preventDefault();
        handleSelect(item);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelect(item);
        }
      }}
      role='button'
      tabIndex={0}
    >
      {item.type === 'user' && (
        <>
          <Avatar
            displayName={item.data.username}
            displayMedia={item.data.profile.primary_media}
            className={styles.avatar}
          />
          <div className={styles.info}>
            <span className={styles.name}>{item.data.username}</span>
            <span className={styles.meta}>{item.data.email}</span>
          </div>
        </>
      )}
      {item.type === 'contact' && (
        <>
          <Avatar
            displayName={item.data.name}
            displayMedia={item.data.primary_media}
            className={styles.avatar}
          />
          <div className={styles.info}>
            <span className={styles.name}>{item.data.name}</span>
            <span className={styles.meta}>
              {(item.data as { email?: string }).email}
            </span>
          </div>
        </>
      )}
      {item.type === 'group' && (
        <>
          <Avatar
            displayName={item.data.name ?? ''}
            displayMedia={item.data.primary_media}
            className={styles.avatar}
          />
          <div className={styles.info}>
            <span className={styles.name}>{item.data.name ?? ''}</span>
            <span className={styles.meta}>
              {item.data.type === 'C'
                ? `${t('sidebar.channelBadge')} · ${item.data.info ?? ''} ${t('sidebar.subscribersCount')}`.trim()
                : `${item.data.info ?? ''} ${t('sidebar.membersCount')}`.trim()}
            </span>
          </div>
        </>
      )}
      {item.type === 'setting' && item.data.id && (
        <>
          <Icon name='Appearance' className={styles['setting-icon']} />
          <div className={styles.info}>
            <span className={styles.name}>
              {t(`profileTabs.${item.data.id}`)}
            </span>
          </div>
        </>
      )}
    </li>
  );

  return (
    <ul
      className={`${styles['search-list']}  ${term.length > 0 && results.length > 0 ? styles['search-list--active'] : ''}`}
    >
      {groups.length > 0 && (
        <>
          {groups.map((item, i) =>
            renderItem(item, `group-${item.data.id}-${i}`),
          )}
        </>
      )}
      {users.length > 0 && (
        <>
          {/* <li className={styles['search-section']}> */}
          {/* {t('search.users') ?? 'Users'} */}
          {/* </li> */}
          {users.map((item, i) =>
            renderItem(item, `user-${item.data.id}-${i}`),
          )}
        </>
      )}
      {contacts.length > 0 && (
        <>
          {/* <li className={styles['search-section']}>
            {t('search.contacts') ?? 'Contacts'}
          </li> */}
          {contacts.map((item, i) =>
            renderItem(item, `contact-${item.data.id}-${i}`),
          )}
        </>
      )}
      {settings.length > 0 && (
        <>
          <li className={styles['search-section']}>
            {t('search.settings') ?? 'Settings'}
          </li>
          {settings.map((item, i) =>
            renderItem(item, `setting-${item.data.id}-${i}`),
          )}
        </>
      )}
    </ul>
  );
};

export default GlobalSearchList;
