import React, { useState, memo } from 'react';
import { useSelectedChat } from '@/contexts/ChatContextCore';
import { useTranslation } from '@/contexts/languageCore';
import { useFormatLastSeen } from '@/hooks/useFormatLastSeen';
import Avatar from '../Avatar/Avatar';
import styles from './ChatHeader.module.scss';
import { Icon } from '../Icons/AutoIcons';
import { MediaHeader } from './MediaHeader';
import Button from '../ui/button/Button';

interface ChatHeaderProps {
  onGoHome?: () => void;
  onChatInfoClick?: () => void;
}

const arrowIcon = <Icon name='Arrow' />;

const ChatHeader: React.FC<ChatHeaderProps> = ({
  onGoHome,
  onChatInfoClick,
}) => {
  const { t } = useTranslation();
  const { formatLastSeen } = useFormatLastSeen();
  const { selectedChat } = useSelectedChat();
  const [, setAvatarModalVisible] = useState(false);

  const subtitle =
    selectedChat?.type === 'G'
      ? `${selectedChat?.info || ''} ${t('sidebar.membersCount')}`
      : selectedChat?.type === 'C'
        ? `${selectedChat?.info || ''} ${t('sidebar.subscribersCount')}`
        : formatLastSeen(selectedChat?.info || '');

  if (!selectedChat) return;

  const handleGoHome = (e: React.MouseEvent) => {
    e.stopPropagation();
    onGoHome?.();
  };

  const avatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAvatarModalVisible(true);
  };

  return (
    <div className={styles['header-container']}>
      <div className={styles['chat-header']} onClick={onChatInfoClick}>
        <Button
          key={'chat-header-back-button'}
          onClick={handleGoHome}
          className={styles['chat-header__back-button']}
        >
          {arrowIcon}
        </Button>

        <div className={styles['chat-header__title']}>
          <span className={styles['chat-header__title-name']}>
            {selectedChat.name}
          </span>
          {subtitle && (
            <span className={styles['chat-header__title-sub']}>{subtitle}</span>
          )}
        </div>

        <Avatar
          key={selectedChat.id}
          displayName={selectedChat.name || ''}
          displayMedia={selectedChat.primary_media}
          className={styles['chat-header__avatar']}
          onClick={avatarClick}
        />
      </div>
      <MediaHeader />
    </div>
  );
};

export default memo(ChatHeader);
