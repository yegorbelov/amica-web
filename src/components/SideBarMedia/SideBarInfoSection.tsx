import React, { memo } from 'react';
import styles from './SideBarMedia.module.scss';

interface SideBarInfoSectionProps {
  tabsRef: React.RefObject<HTMLDivElement | null>;
  nameEditRef: React.RefObject<HTMLDivElement | null>;
  visibleName: string;
  subtitle: string;
  interlocutorEditVisible: boolean;
  effectiveNameLength: number;
  onNameEditInput: (e: React.FormEvent<HTMLDivElement>) => void;
  onNameEditBeforeInput: (e: React.FormEvent<HTMLDivElement>) => void;
  onNameEditKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  showEmail: boolean;
  email: string | undefined;
  onCopyEmail: () => void;
  showChannelLink?: boolean;
  /** Full URL shown in the row; tap copies it */
  channelLinkUrl?: string;
  onCopyChannelLink?: () => void;
}

const SideBarInfoSection: React.FC<SideBarInfoSectionProps> = ({
  tabsRef,
  nameEditRef,
  visibleName,
  subtitle,
  interlocutorEditVisible,
  effectiveNameLength,
  onNameEditInput,
  onNameEditBeforeInput,
  onNameEditKeyDown,
  showEmail,
  email,
  onCopyEmail,
  showChannelLink = false,
  channelLinkUrl,
  onCopyChannelLink,
}) => (
  <>
    <div className={styles['sidebar__info']} ref={tabsRef}>
      <div
        ref={nameEditRef}
        contentEditable={interlocutorEditVisible}
        suppressContentEditableWarning
        autoCorrect='off'
        className={`${styles['sidebar__name']} ${
          interlocutorEditVisible ? styles['sidebar__name--editing'] : ''
        }`}
        onInput={interlocutorEditVisible ? onNameEditInput : undefined}
        onBeforeInput={interlocutorEditVisible ? onNameEditBeforeInput : undefined}
        onKeyDown={interlocutorEditVisible ? onNameEditKeyDown : undefined}
      >
        {!interlocutorEditVisible ? visibleName : undefined}
      </div>
      {interlocutorEditVisible && effectiveNameLength > 47 && (
        <span
          className={
            effectiveNameLength > 64
              ? styles['sidebar__name-counter--over']
              : styles['sidebar__name-counter']
          }
        >
          {64 - effectiveNameLength}
        </span>
      )}
      <span className={styles['sidebar__subtitle']}>{subtitle}</span>
    </div>
    {!interlocutorEditVisible && showEmail && (
      <div className={styles['sidebar__info-secondary']}>
        <button
          className={styles['sidebar__info-secondary__item']}
          type='button'
          onClick={onCopyEmail}
        >
          {email}
        </button>
      </div>
    )}
    {!interlocutorEditVisible &&
      showChannelLink &&
      channelLinkUrl &&
      onCopyChannelLink && (
        <div className={styles['sidebar__info-secondary']}>
          <button
            className={`${styles['sidebar__info-secondary__item']} ${styles['sidebar__info-secondary__item--url']}`}
            type='button'
            onClick={onCopyChannelLink}
          >
            {channelLinkUrl}
          </button>
        </div>
      )}
  </>
);

export default memo(SideBarInfoSection);
