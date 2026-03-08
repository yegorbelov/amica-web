import { useTranslation } from '@/contexts/languageCore';
import Avatar from '@/components/Avatar/Avatar';
import styles from './Contacts.module.scss';
import { useChatMeta } from '@/contexts/ChatContextCore';
import { useContacts } from '@/contexts/contacts/useContacts';
import { formatLastSeen } from '@/utils/activityFormatter';

const Contacts = () => {
  const { t } = useTranslation();
  const { handleChatClick } = useChatMeta();
  const { contacts, loading, error } = useContacts();

  if (loading) return <div>{t('contacts.loading') ?? 'Loading...'}</div>;
  if (error) return <div>{t('contacts.error') ?? `Error: ${error}`}</div>;

  return (
    <div className={styles.contacts}>
      {contacts.length > 0 && (
        <ul>
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
    </div>
  );
};

export default Contacts;
