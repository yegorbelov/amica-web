import { TabsProvider } from '../Tabs/TabsContext';
import { Tabs } from '../Tabs/Tabs';
import { Tab } from '../Tabs/Tab';
import Contacts from '@/components/Contacts/Contacts';
import Profile from '@/components/Profile/Profile';
import ChatsTabView from './ChatsTabView';
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
    <div className='choose_list'>
      <TabsProvider>
        <div className='left-menu'>
          <Tab id='contacts'>
            <div
              className={`${styles['tab-content']} ${styles['tab-content--contacts']}`}
            >
              <Contacts />
            </div>
          </Tab>
          <Tab id='chats'>
            {/* <div className='chat-list-title'>Messages</div> */}
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
        <Tabs />
      </TabsProvider>
    </div>
  );
};

export default LeftSideBar;
