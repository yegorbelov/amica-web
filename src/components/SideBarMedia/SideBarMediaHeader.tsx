import React, { memo } from 'react';
import { useTranslation } from '@/contexts/languageCore';
import { Icon } from '@/components/Icons/AutoIcons';
import { Dropdown } from '@/components/Dropdown/Dropdown';
import type { DropdownItem } from '@/components/Dropdown/Dropdown';
import Button from '@/components/ui/button/Button';
import styles from './SideBarMedia.module.scss';

interface SideBarMediaHeaderProps {
  onBackOrClose: () => void;
  showEditButton: boolean;
  onEditClick: () => void;
  editLabel: string;
  attachmentsActive: boolean;
  showFilterDropdown: boolean;
  interlocutorEditVisible: boolean;
  saveDisabled?: boolean;
  filterItems: DropdownItem<number>[];
  effectiveFilterType: string;
  onFilterChange: (label: string) => void;
  /** Channel owner/admin: delete channel */
  showChannelAdminToolbar?: boolean;
  onDeleteChannel?: () => void;
}

const SideBarMediaHeader: React.FC<SideBarMediaHeaderProps> = ({
  onBackOrClose,
  showEditButton,
  onEditClick,
  editLabel,
  attachmentsActive,
  showFilterDropdown,
  interlocutorEditVisible,
  saveDisabled = false,
  filterItems,
  effectiveFilterType,
  onFilterChange,
  showChannelAdminToolbar = false,
  onDeleteChannel,
}) => {
  const { t } = useTranslation();
  const backButtonIcon = React.useMemo(
    () => (interlocutorEditVisible ? <>Cancel</> : <Icon name='Cross' />),
    [interlocutorEditVisible],
  );
  return (
    <div className={styles.header}>
      <Button
        key='sidebar-header-button'
        onClick={onBackOrClose}
        className={styles.button}
      >
        {backButtonIcon}
      </Button>

      <div className={styles.headerTrailing}>
        {showChannelAdminToolbar && !attachmentsActive && onDeleteChannel && (
          <Button
            type='button'
            className={`${styles.button} ${styles.buttonDestructive}`}
            onClick={onDeleteChannel}
            aria-label={t('sidebar.deleteChannel')}
          >
            <Icon name='Delete' />
          </Button>
        )}

        {showEditButton && !attachmentsActive && (
          <Button
            key='sidebar-header-button-edit'
            className={`${styles.button}`}
            onClick={onEditClick}
            disabled={interlocutorEditVisible && saveDisabled}
          >
            {interlocutorEditVisible ? t('buttons.save') : editLabel}
          </Button>
        )}

        {attachmentsActive && showFilterDropdown && (
          <Dropdown
            items={filterItems}
            placeholder=''
            value={
              filterItems.find((item) => item.label === effectiveFilterType)
                ?.value ?? 0
            }
            onChange={(value) => {
              const selected = filterItems.find((item) => item.value === value);
              if (selected) {
                const key = (selected as { filterKey?: string }).filterKey;
                onFilterChange(key ?? selected.label);
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

export default memo(SideBarMediaHeader);
