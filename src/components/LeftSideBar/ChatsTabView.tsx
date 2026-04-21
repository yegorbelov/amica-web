// components/Search/UserSearch.tsx
import React, {
  memo,
  useCallback,
  useState,
  useRef,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import SearchInput from '@/components/ui/searchInput/SearchInput';
import GlobalSearchList from '@/components/GlobalSearchList/GlobalSearchList';
import ChatList from '@/components/ChatList/ChatList';
import styles from './LeftSideBar.module.scss';
import { useLeftSideBarLayout } from './leftSideBarLayoutContext';
import { SearchProvider } from '@/contexts/search/SearchContext';
import { searchChatsTab } from '@/providers/searchGlobal';
import { useTranslation } from '@/contexts/languageCore';
import Button from '../ui/button/Button';
import { Icon } from '../Icons/AutoIcons';
import { useToast } from '@/contexts/toast/ToastContextCore';
import { useChatMeta } from '@/contexts/ChatContextCore';
import { apiJson } from '@/utils/apiFetch';
import type { Chat } from '@/types';
import Input from '../SideBarMedia/Input';
import { Menu } from '@/components/ui/menu/Menu';
import type { MenuItem } from '@/components/ui/menu/Menu';

const ChatsTabView: React.FC = () => {
  const leftBarLayout = useLeftSideBarLayout();
  const chatsChromeCollapsed = leftBarLayout?.chatsChromeCollapsed ?? false;
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { handleChatClick, setChats } = useChatMeta();
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<'group' | 'channel'>('group');
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [createMenuPos, setCreateMenuPos] = useState({ x: 0, y: 0 });
  const [createMenuKey, setCreateMenuKey] = useState(0);
  const plusRef = useRef<HTMLButtonElement>(null);

  const closeCreateModal = useCallback(() => {
    if (creating) return;
    setCreateOpen(false);
    setGroupName('');
    setCreateKind('group');
  }, [creating]);

  const openCreateKindMenu = useCallback(() => {
    const r = plusRef.current?.getBoundingClientRect();
    if (!r) return;
    setCreateMenuPos({ x: r.left, y: r.bottom + 8 });
    setCreateMenuKey((k) => k + 1);
    setCreateMenuOpen(true);
  }, []);

  const createMenuItems = useMemo<MenuItem<string>[]>(
    () => [
      {
        label: t('sidebar.chatKindGroup'),
        icon: 'AddPlus',
        onClick: () => {
          setCreateKind('group');
          setCreateOpen(true);
          setCreateMenuOpen(false);
        },
      },
      {
        label: t('sidebar.chatKindChannel'),
        icon: 'AddPlus',
        onClick: () => {
          setCreateKind('channel');
          setCreateOpen(true);
          setCreateMenuOpen(false);
        },
      },
    ],
    [t],
  );

  const submitCreateGroup = useCallback(async () => {
    const name = groupName.trim();
    if (!name || creating) return;
    setCreating(true);
    const isChannel = createKind === 'channel';
    try {
      const { chat } = await apiJson<{ chat: Chat }>(
        isChannel ? '/api/channels/create/' : '/api/groups/create/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        },
      );
      setChats((prev) => {
        if (prev.some((c) => c.id === chat.id)) return prev;
        return [chat, ...prev];
      });
      setCreateOpen(false);
      setGroupName('');
      setCreateKind('group');
      handleChatClick(chat.id);
    } catch (err: unknown) {
      const fallback = isChannel
        ? t('toast.createChannelTimeout')
        : t('toast.createGroupTimeout');
      const msg = err instanceof Error ? err.message : fallback;
      showToast(msg);
    } finally {
      setCreating(false);
    }
  }, [
    createKind,
    creating,
    groupName,
    handleChatClick,
    setChats,
    showToast,
    t,
  ]);

  return (
    <SearchProvider searchFn={searchChatsTab} minLength={1}>
      <div className={styles['chats-tab-layout']}>
        <div
          className={`${styles['global-search-input-container']} ${
            chatsChromeCollapsed
              ? styles['global-search-input-container--chats-collapsed']
              : ''
          }`}
        >
          {!chatsChromeCollapsed && (
            <SearchInput placeholder={t('search.default')} />
          )}
          <Button
            ref={plusRef}
            type='button'
            className={styles['add-plus-button']}
            onClick={openCreateKindMenu}
            aria-label={t('sidebar.createChatMenuAria')}
            aria-haspopup='menu'
            aria-expanded={createMenuOpen}
            {...{ 'data-menu-group': 'create-chat-plus-menu' }}
          >
            <Icon name='AddPlus' className={styles['add-plus-icon']} />
          </Button>
        </div>
        <div className={styles['tab-content']}>
          <ChatList />
          <GlobalSearchList />
        </div>
      </div>

      {createMenuOpen && (
        <Menu
          key={`create-chat-menu-${createMenuKey}`}
          items={createMenuItems}
          position={createMenuPos}
          onClose={() => setCreateMenuOpen(false)}
          menuGroupId='create-chat-plus-menu'
        />
      )}

      {createOpen &&
        createPortal(
          <div
            className={styles.createGroupOverlay}
            role='presentation'
            onClick={closeCreateModal}
          >
            <div
              className={styles.createGroupModal}
              role='dialog'
              aria-labelledby='create-group-title'
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.createGroupActions}>
                <h2 id='create-group-title' className={styles.createGroupTitle}>
                  {createKind === 'channel'
                    ? t('sidebar.newChannelTitle')
                    : t('sidebar.newGroupTitle')}
                </h2>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={closeCreateModal}
                  disabled={creating}
                >
                  {t('buttons.cancel')}
                </Button>
                <Button
                  type='button'
                  onClick={() => void submitCreateGroup()}
                  disabled={creating || !groupName.trim()}
                >
                  {createKind === 'channel'
                    ? t('sidebar.createChannelButton')
                    : t('sidebar.createGroupButton')}
                </Button>
              </div>

              <Input
                placeholder={
                  createKind === 'channel'
                    ? t('sidebar.newChannelNamePlaceholder')
                    : t('sidebar.newGroupNamePlaceholder')
                }
                value={groupName}
                onChange={(val) => setGroupName(val)}
                isRequired={true}
              />
            </div>
          </div>,
          document.body,
        )}
    </SearchProvider>
  );
};

export default memo(ChatsTabView);
