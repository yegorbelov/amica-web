import { useState } from 'react';
import { useTranslation } from '@/contexts/languageCore';
import Button from '../ui/button/Button';
import { Icon } from '../Icons/AutoIcons';
import styles from './AppearanceMenu.module.scss';
import { useSettings } from '@/contexts/settings/context';
import { useTabs } from '@/components/Tabs/tabsShared';
import { useChatMeta } from '@/contexts/ChatContextCore';
import { useSortedChats } from '@/components/ChatList/useSortedChats';
import Avatar from '../Avatar/Avatar';
import type { Settings } from '@/contexts/settings/types';

const tabs: Array<'chats' | 'appearance'> = ['chats', 'appearance'];

const THEME_OPTIONS: Array<Settings['theme']> = ['light', 'dark', 'system'];

const crossIcon = <Icon name='Cross' />;
const arrowLeftIcon = (
  <Icon
    name='Arrow'
    className={styles.arrowIcon}
    style={{ transform: 'rotate(180deg)' }}
  />
);
const arrowRightIcon = <Icon name='Arrow' className={styles.arrowIcon} />;

const AppearanceMenu: React.FC = () => {
  const { t } = useTranslation();
  const { settings, setSetting, setActiveProfileTab } = useSettings();
  const { setActiveTab } = useTabs();
  const { chats, handleChatClick } = useChatMeta();
  const sortedChats = useSortedChats(chats);
  const recentChats = sortedChats.slice(0, 6);

  const [visible, setVisible] = useState(true);
  const [activeTab, setActiveTabState] = useState<'chats' | 'appearance'>(
    'appearance',
  );

  const handleNextTab = () => {
    const currentIndex = tabs.indexOf(activeTab);
    const nextIndex = (currentIndex + 1) % tabs.length;
    setActiveTabState(tabs[nextIndex]);
  };

  const handlePrevTab = () => {
    const currentIndex = tabs.indexOf(activeTab);
    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    setActiveTabState(tabs[prevIndex]);
  };

  const handleOpenAppearanceSettings = () => {
    setActiveProfileTab('appearance');
    setActiveTab('profile');
  };

  return (
    <div className={styles.container}>
      <Button
        className={styles.menuSwitch}
        onClick={() => setVisible(!visible)}
      >
        {visible ? crossIcon : '?'}
      </Button>
      {!visible && (
        <div className={styles.noChatText}>{t('chat.selectToStart')}</div>
      )}
      {visible && (
        <div className={styles.tipsMenu}>
          <div className={styles.mainContentWrapper}>
            <div
              className={`${styles.mainContent} ${styles.tabPanel} ${
                activeTab === 'appearance' ? styles.tabPanelActive : ''
              }`}
            >
              <div className={styles.header}>{t('tipsMenu.appearance')}</div>
              <div className={styles.themeSection}>
                <div className={styles.themeLabel}>{t('tipsMenu.theme')}</div>
                <div className={styles.themeButtons}>
                  {THEME_OPTIONS.map((theme) => (
                    <Button
                      key={theme}
                      className={`${styles.themeButton} ${
                        settings.theme === theme ? styles.themeButtonActive : ''
                      }`}
                      onClick={() => setSetting('theme', theme)}
                    >
                      {t(
                        `tipsMenu.theme${theme.charAt(0).toUpperCase() + theme.slice(1)}`,
                      )}
                    </Button>
                  ))}
                </div>
                <div className={styles.themePreview}>
                  <div className={styles.themePreviewItemWrapper}>
                    <div
                      onClick={() => setSetting('theme', 'light')}
                      className={`${styles.themePreviewItem} ${settings.theme === 'light' ? styles.themePreviewItemActive : ''}`}
                    >
                      <img
                        src='../src/assets/Screenshots/themes/light.jpg'
                        alt='Theme Light'
                      />
                    </div>
                    <span className={styles.themePreviewItemText}>
                      {t('tipsMenu.themeLight')}
                    </span>
                  </div>
                  <div className={styles.themePreviewItemWrapper}>
                    <div
                      onClick={() => setSetting('theme', 'dark')}
                      className={`${styles.themePreviewItem} ${settings.theme === 'dark' ? styles.themePreviewItemActive : ''}`}
                    >
                      <img
                        src='../src/assets/Screenshots/themes/dark.jpg'
                        alt='Theme Dark'
                      />
                    </div>
                    <span className={styles.themePreviewItemText}>
                      {t('tipsMenu.themeDark')}
                    </span>
                  </div>
                </div>
              </div>
              <button
                className={styles.appearanceLink}
                onClick={handleOpenAppearanceSettings}
              >
                {t('tipsMenu.openAppearanceSettings')}
              </button>
            </div>
            <div
              className={`${styles.mainContent} ${styles.tabPanel} ${
                activeTab === 'chats' ? styles.tabPanelActive : ''
              }`}
            >
              <div className={styles.header}>{t('tipsMenu.chats')}</div>
              <div className={styles.chatsGrid}>
                {recentChats.map((chat) => (
                  <button
                    key={chat.id}
                    type='button'
                    className={styles.chatGridItem}
                    onClick={() => handleChatClick(chat.id)}
                  >
                    <Avatar
                      displayName={chat.name || ''}
                      displayMedia={chat.primary_media}
                      className={styles.chatGridAvatar}
                    />
                    <span
                      className={styles.chatGridName}
                      title={chat.name || ''}
                    >
                      {chat.name || t('chat.chat')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.pageSwitch}>
            <Button
              key={'appearance-menu-previous-button'}
              className={styles.switchButton}
              onClick={handlePrevTab}
            >
              {arrowLeftIcon}
              {t('tipsMenu.previousTip')}
            </Button>
            <Button
              key={'appearance-menu-next-button'}
              className={styles.switchButton}
              onClick={handleNextTab}
            >
              {t('tipsMenu.nextTip')}
              {arrowRightIcon}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppearanceMenu;
