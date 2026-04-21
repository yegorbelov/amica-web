import React, { memo } from 'react';
import { useTranslation } from '@/contexts/languageCore';
import Input from './Input';
import Button from '@/components/ui/button/Button';
import styles from './SideBarMedia.module.scss';

interface InterlocutorEditFormProps {
  chatType: 'D' | 'G' | 'C';
  editValue: string;
  onValueChange: (value: string) => void;
  onDelete: (contactId: number | undefined) => void;
  contactId: number | undefined;
  originalUsername?: string;
  displayName?: string;
}

const InterlocutorEditForm: React.FC<InterlocutorEditFormProps> = ({
  chatType,
  editValue,
  onValueChange,
  onDelete,
  contactId,
  originalUsername,
  displayName,
}) => {
  const { t } = useTranslation();

  const notes =
    chatType === 'D' &&
    originalUsername != null &&
    originalUsername !== displayName
      ? `${t('sidebar.originalUsername')}: ${originalUsername}`
      : null;

  return (
    <div className={`${styles.interlocutorEdit} ${styles.visible}`}>
      <div className={styles.form}>
        {chatType === 'D' && (
          <Input
            placeholder={t('sidebar.contactName')}
            isRequired
            value={editValue}
            onChange={onValueChange}
            notes={notes}
          />
        )}
        {(chatType === 'G' || chatType === 'C') && (
          <Input
            placeholder={
              chatType === 'C'
                ? t('sidebar.channelName')
                : t('sidebar.groupName')
            }
            isRequired
            value={editValue}
            onChange={onValueChange}
          />
        )}
        {chatType === 'D' && (
          <Button
            key='sidebar-media-delete-button'
            className={`${styles.button} ${styles.delete}`}
            type='button'
            onClick={() => onDelete(contactId)}
          >
            {t('sidebar.deleteFromContacts')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default memo(InterlocutorEditForm);
