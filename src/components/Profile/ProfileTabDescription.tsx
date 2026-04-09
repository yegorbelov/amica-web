import styles from './Profile.module.scss';
import { Icon, type IconName } from '../Icons/AutoIcons';

const ProfileTabDescription = ({
  title,
  description,
  iconName,
  backgroundColor,
  iconFill = '#fff',
}: {
  title: string;
  description: string;
  /** Omit to show title and description only (no leading icon). */
  iconName?: IconName;
  backgroundColor?: string;
  iconFill?: string;
}) => {
  return (
    <div className={styles['profile-tab-description']}>
      {iconName ? (
        <Icon
          name={iconName}
          className={styles['profile-tab-description__icon']}
          style={
            {
              '--background-color': backgroundColor,
              '--icon-fill': iconFill,
            } as React.CSSProperties
          }
        />
      ) : null}
      <div className={styles['profile-tab-description__title']}>{title}</div>
      <p className={styles['profile-tab-description__description']}>
        {description}
      </p>
    </div>
  );
};

export default ProfileTabDescription;
