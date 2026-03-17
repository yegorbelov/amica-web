import ProfileLanguage from '@/components/Profile/ProfileLanguage';
import ProfilePrivacy from '@/components/Profile/ProfilePrivacy';
import ProfileAccount from '@/components/Profile/ProfileAccount';
import ProfileAppearance from '@/components/Profile/ProfileAppearance';
import ProfileSessions from '@/components/Profile/ProfileSessions';
import { useSettings } from '@/contexts/settings/context';
import type { SubTab } from '@/contexts/settings/types';
import styles from './Profile.module.scss';
// import { Icon } from '../Icons/AutoIcons';

function TabContent({ tabId }: { tabId: SubTab }) {
  return (
    <div className={styles.content}>
      {tabId === 'language' && <ProfileLanguage />}
      {tabId === 'privacy' && <ProfilePrivacy />}
      {tabId === 'account' && <ProfileAccount />}
      {tabId === 'appearance' && <ProfileAppearance />}
      {tabId === 'active_sessions' && <ProfileSessions />}
    </div>
  );
}

export const ActiveProfileTab = () => {
  const { activeProfileTab } = useSettings();
  if (!activeProfileTab) {
    return null;
  }
  return <TabContent tabId={activeProfileTab} />;
};

export { TabContent };
