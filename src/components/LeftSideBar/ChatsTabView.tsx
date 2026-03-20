// components/Search/UserSearch.tsx
import React, { memo } from 'react';
import SearchInput from '@/components/ui/searchInput/SearchInput';
import GlobalSearchList from '@/components/GlobalSearchList/GlobalSearchList';
import ChatList from '@/components/ChatList/ChatList';
import styles from './LeftSideBar.module.scss';
import { SearchProvider } from '@/contexts/search/SearchContext';
import { searchChatsTab } from '@/providers/searchGlobal';
import { useTranslation } from '@/contexts/languageCore';

const ChatsTabView: React.FC = () => {
  const { t } = useTranslation();
  return (
  <SearchProvider searchFn={searchChatsTab} minLength={1}>
    <SearchInput placeholder={t('search.default')} />
    <div className={styles['tab-content']}>
      <ChatList />
      <GlobalSearchList />
    </div>
  </SearchProvider>
  );
};

export default memo(ChatsTabView);
