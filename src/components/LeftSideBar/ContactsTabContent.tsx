import React, { memo, useState } from 'react';
import SearchInput from '@/components/ui/searchInput/SearchInput';
import Contacts from '@/components/Contacts/Contacts';
import { useContacts } from '@/contexts/contacts/useContacts';
import { useTranslation } from '@/contexts/languageCore';
import styles from './LeftSideBar.module.scss';

const ContactsTabContent: React.FC = () => {
  const { t } = useTranslation();
  const [term, setTerm] = useState('');
  const { searchContacts } = useContacts();
  const filtered = searchContacts(term);

  return (
    <>
      <div className={styles['global-search-input-container']}>
        <SearchInput
          placeholder={t('search.contactsPlaceholder')}
          value={term}
          onChange={setTerm}
          onClear={() => setTerm('')}
        />
      </div>
      <Contacts contactsToShow={filtered} />
    </>
  );
};

export default memo(ContactsTabContent);
