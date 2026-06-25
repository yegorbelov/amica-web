import React, { memo } from 'react';
import AudioLayout from '@/components/Message/AudioLayout';
import type { File } from '@/types';
import styles from './SideBarMedia.module.scss';

interface AudioGridProps {
  files: File[];
}

const AudioGrid: React.FC<AudioGridProps> = ({ files }) => (
  <div className={styles.audioGrid}>
    {files.map((file) => (
      <AudioLayout
        key={file.id}
        name={file.original_name}
        waveform={file.waveform ?? null}
        duration={file.duration ?? 0}
        id={file.id ?? 0}
        cover_url={file.cover_url ?? null}
      />
    ))}
  </div>
);

export default memo(AudioGrid);
