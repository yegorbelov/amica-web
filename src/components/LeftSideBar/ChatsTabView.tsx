// components/Search/UserSearch.tsx
import React, { memo, useCallback, useState } from 'react';
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

const ChatsTabView: React.FC = () => {
  const leftBarLayout = useLeftSideBarLayout();
  const chatsChromeCollapsed = leftBarLayout?.chatsChromeCollapsed ?? false;
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { handleChatClick, setChats } = useChatMeta();
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  const closeCreateModal = useCallback(() => {
    if (creating) return;
    setCreateOpen(false);
    setGroupName('');
  }, [creating]);

  const submitCreateGroup = useCallback(async () => {
    const name = groupName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const { chat } = await apiJson<{ chat: Chat }>('/api/groups/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      setChats((prev) => {
        if (prev.some((c) => c.id === chat.id)) return prev;
        return [chat, ...prev];
      });
      setCreateOpen(false);
      setGroupName('');
      handleChatClick(chat.id);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : t('toast.createGroupTimeout');
      showToast(msg);
    } finally {
      setCreating(false);
    }
  }, [creating, groupName, handleChatClick, setChats, showToast, t]);

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
            type='button'
            className={styles['add-plus-button']}
            onClick={() => setCreateOpen(true)}
            aria-label={t('sidebar.newGroupTitle')}
          >
            <Icon name='AddPlus' className={styles['add-plus-icon']} />
          </Button>
        </div>
        <div className={styles['tab-content']}>
          <ChatList />
          <GlobalSearchList />
        </div>
      </div>

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
                  {t('sidebar.newGroupTitle')}
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
                  {t('sidebar.createGroupButton')}
                </Button>
              </div>

              <Input
                placeholder={t('sidebar.newGroupNamePlaceholder')}
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
