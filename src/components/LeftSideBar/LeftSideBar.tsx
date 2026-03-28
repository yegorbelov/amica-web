import { Tabs } from '../Tabs/Tabs';
import { Tab } from '../Tabs/Tab';
import Profile from '@/components/Profile/Profile';
import ChatsTabView from './ChatsTabView';
import ContactsTabContent from './ContactsTabContent';
import styles from './LeftSideBar.module.scss';
import { useSettings } from '@/contexts/settings/context';

interface ChooseListProps {
  userInfo?: {
    id: number;
    username: string;
    email: string;
  } | null;
  onLogout?: () => void;
  onChatSelect?: (chatId: number) => void;
}

const LeftSideBar: React.FC<ChooseListProps> = () => {
  const { activeProfileTab } = useSettings();

  return (
    <div className={styles['left-side-bar']}>
      <div className={styles['left-side-bar__inner']}>
        <div className={styles['left-side-bar__tab-panels']}>
          <Tab id='contacts'>
            <div className={`${styles['tab-content']}`}>
              <ContactsTabContent />
            </div>
          </Tab>
          <Tab id='chats'>
            <ChatsTabView />
          </Tab>
          <Tab id='profile'>
            <div
              className={`${styles['tab-content']} ${styles['tab-content--profile']}`}
              style={
                {
                  '--offset-bottom':
                    activeProfileTab === 'appearance' ? '120px' : '70px',
                } as React.CSSProperties
              }
            >
              <Profile />
            </div>
          </Tab>
        </div>
      </div>
      <Tabs />
    </div>
  );
};

export default LeftSideBar;
