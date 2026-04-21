import React, { useLayoutEffect, useState, memo } from 'react';
import type { SideBarTab } from './hooks/useSideBarMediaData';
import { useTranslation } from '@/contexts/languageCore';
import styles from './SideBarMedia.module.scss';

interface SideBarTabsProps {
  activeTab: SideBarTab | null;
  availableTabs: SideBarTab[];
  onTabChange: (tab: SideBarTab) => void;
  membersRef: React.RefObject<HTMLButtonElement | null>;
  mediaRef: React.RefObject<HTMLButtonElement | null>;
  audioRef: React.RefObject<HTMLButtonElement | null>;
  selectedChatType: 'D' | 'G' | 'C';
  hasMembers: boolean;
  mediaFilesCount: number;
  audioFilesCount: number;
}

const SideBarTabs: React.FC<SideBarTabsProps> = ({
  activeTab,
  availableTabs,
  onTabChange,
  membersRef,
  mediaRef,
  audioRef,
  selectedChatType,
  hasMembers,
  mediaFilesCount,
  audioFilesCount,
}) => {
  const { t } = useTranslation();
  const [indicatorPosition, setIndicatorPosition] = useState(0);
  const [indicatorWidth, setIndicatorWidth] = useState(0);

  useLayoutEffect(() => {
    let ref: React.RefObject<HTMLButtonElement | null> | null = null;
    if (activeTab === 'members') ref = membersRef;
    if (activeTab === 'media') ref = mediaRef;
    if (activeTab === 'audio') ref = audioRef;

    if (ref?.current) {
      const { offsetLeft, offsetWidth } = ref.current;
      requestAnimationFrame(() => {
        setIndicatorPosition(offsetLeft);
        setIndicatorWidth(offsetWidth);
      });
    }
  }, [activeTab, availableTabs, membersRef, mediaRef, audioRef]);

  return (
    <div className={styles.tabs}>
      <div className={styles['tabs-inner']}>
        <div
          className={styles.indicator}
          style={{
            transform: `translateX(${indicatorPosition}px)`,
            width: `${indicatorWidth - 4}px`,
          }}
        />
        {hasMembers &&
          (selectedChatType === 'G' || selectedChatType === 'C') && (
          <button
            ref={membersRef}
            type="button"
            className={`${styles.tab} ${
              activeTab === 'members' ? styles.active : ''
            }`}
            onClick={() => onTabChange('members')}
          >
            {selectedChatType === 'C'
              ? t('sidebar.subscribers')
              : t('sidebar.members')}
          </button>
        )}
        {mediaFilesCount > 0 && (
          <button
            ref={mediaRef}
            type="button"
            className={`${styles.tab} ${
              activeTab === 'media' ? styles.active : ''
            }`}
            onClick={() => onTabChange('media')}
          >
            {t('sidebar.media')}
          </button>
        )}
        {audioFilesCount > 0 && (
          <button
            ref={audioRef}
            type="button"
            className={`${styles.tab} ${
              activeTab === 'audio' ? styles.active : ''
            }`}
            onClick={() => onTabChange('audio')}
          >
            {t('sidebar.audio')}
          </button>
        )}
      </div>
    </div>
  );
};

export default memo(SideBarTabs);
