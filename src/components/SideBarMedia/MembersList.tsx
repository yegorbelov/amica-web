import React, { memo } from 'react';
import Avatar from '@/components/Avatar/Avatar';
import { useFormatLastSeen } from '@/hooks/useFormatLastSeen';
import type { User } from '@/types';
import styles from './SideBarMedia.module.scss';
import Button from '../ui/button/Button';

interface MembersListProps {
  members: User[];
}

const MembersList: React.FC<MembersListProps> = ({ members }) => {
  const { formatLastSeen } = useFormatLastSeen();

  const handleAddMember = () => {
    return;
  };

  return (
    <div className={styles.membersList}>
      <Button className={styles.membersListButton} onClick={handleAddMember}>
        Add Member
      </Button>
      {members.map((member) => (
        <div key={member.id} className={styles.memberItem}>
          <Avatar
            className={styles.memberAvatar}
            displayMedia={member.profile.primary_media}
            displayName={member.username}
          />
          <div className={styles.memberInfo}>
            <span className={styles.memberName}>{member.username}</span>
            <span className={styles.memberLastSeen}>
              {formatLastSeen(member.last_seen)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default memo(MembersList);
