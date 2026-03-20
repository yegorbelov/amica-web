import React, { memo, useCallback } from 'react';
import SearchInput from '@/components/ui/searchInput/SearchInput';
import Contacts from '@/components/Contacts/Contacts';
import styles from './LeftSideBar.module.scss';
import { SearchProvider } from '@/contexts/search/SearchContext';
import { useSearchContext } from '@/contexts/search/SearchContextCore';
import { useContacts } from '@/contexts/contacts/useContacts';
import { useTranslation } from '@/contexts/languageCore';
import type { Contact } from '@/types';

function ContactsListWithSearch() {
  const { contacts } = useContacts();
  const { term, results } = useSearchContext<Contact>();
  const contactsToShow = term.length >= 1 ? results : contacts;
  return <Contacts contactsToShow={contactsToShow} />;
}

const ContactsTabView: React.FC = () => {
  const { t } = useTranslation();
  const { searchContacts } = useContacts();
  const searchFn = useCallback(
    (query: string) => Promise.resolve(searchContacts(query)),
    [searchContacts],
  );

  return (
    <SearchProvider searchFn={searchFn} minLength={1}>
      <SearchInput placeholder={t('search.default')} />
      <div
        className={`${styles['tab-content']} ${styles['tab-content--contacts']}`}
      >
        <ContactsListWithSearch />
      </div>
    </SearchProvider>
  );
};

export default memo(ContactsTabView);
