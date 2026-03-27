import { useTranslation } from '@/contexts/languageCore';
import Avatar from '@/components/Avatar/Avatar';
import styles from './Contacts.module.scss';
import { useChatMeta } from '@/contexts/ChatContextCore';
import { useContacts } from '@/contexts/contacts/useContacts';
import { useFormatLastSeen } from '@/hooks/useFormatLastSeen';
import type { Contact } from '@/types';

const Contacts = ({
  contactsToShow,
}: {
  contactsToShow?: Contact[];
} = {}) => {
  const { t } = useTranslation();
  const { formatLastSeen } = useFormatLastSeen();
  const { handleChatClick } = useChatMeta();
  const { contacts: contactsFromHook } = useContacts();
  const contacts = contactsToShow ?? contactsFromHook;

  // if (loading) return <div>{t('contacts.loading') ?? 'Loading...'}</div>;
  // if (error) return <div>{t('contacts.error') ?? `Error: ${error}`}</div>;

  return (
    <>
      {contacts.length > 0 && (
        <ul className={styles.contacts}>
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className={styles.contactItem}
              onClick={() => handleChatClick(contact.chat_id)}
            >
              <Avatar
                className={styles.avatar}
                displayName={contact.name}
                displayMedia={contact.primary_media}
              />
              <div className={styles.contactInfo}>
                <span className={styles.username}>{contact.name}</span>
                <span className={styles.lastSeen}>
                  {formatLastSeen(contact.last_seen)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {contacts.length === 0 && (
        <div className={styles.emptyContact}>{t('contacts.empty')}</div>
      )}
    </>
  );
};

export default Contacts;
