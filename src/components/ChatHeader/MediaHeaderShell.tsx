import React from 'react';
import styles from './ChatHeader.module.scss';
import { MediaHeader } from './MediaHeader';

type MediaHeaderShellProps = {
  className?: string;
};

export const MediaHeaderShell: React.FC<MediaHeaderShellProps> = ({
  className,
}) => (
  <div
    className={[styles['header-container'], className]
      .filter(Boolean)
      .join(' ')}
  >
    <MediaHeader />
  </div>
);
