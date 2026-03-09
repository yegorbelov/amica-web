import { useSearchContext } from '@/contexts/search/SearchContextCore';
import type { User } from '@/types';
import styles from './GlobalSearchList.module.scss';
import Avatar from '../Avatar/Avatar';
import { useChatMeta } from '@/contexts/ChatContextCore';

const GlobalSearchList: React.FC = () => {
  const { results, loading, error, clear } = useSearchContext<User>();
  const { handleCreateTemporaryChat } = useChatMeta();

  const handleUserSelect = (user: User) => {
    handleCreateTemporaryChat(user);
    clear();
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className='text-red-500'>{error}</div>;
  return (
    <ul className={styles['search-list']}>
      {results.map((user) => (
        <li
          key={user.id}
          className={styles['search-item']}
          onMouseDown={(e) => {
            e.preventDefault();
            handleUserSelect(user);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleUserSelect(user);
            }
          }}
          role='button'
          tabIndex={0}
        >
          <Avatar
            displayName={user.username}
            displayMedia={user.profile.primary_media}
            className={styles.avatar}
          />
          <div className={styles.info}>
            <span className={styles.name}>{user.username}</span>
            <span className={styles.email}>{user.email}</span>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default GlobalSearchList;
