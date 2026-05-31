import React, { forwardRef, memo } from 'react';
import ProgressiveImage from '@/components/Message/ProgressiveImage';
import VideoLayout from '@/components/Message/VideoLayout';
import type { File } from '@/types';
import {
  isLikelyImageFile,
  isLikelyVideoFile,
} from '@/utils/mediaAttachmentKind';
import styles from './SideBarMedia.module.scss';

interface MediaGridProps {
  files: File[];
  rowScale: number;
  className?: string;
  style?: React.CSSProperties;
}

const MediaGrid = memo(
  forwardRef<HTMLDivElement, MediaGridProps>(function MediaGrid(
    { files, rowScale, className, style },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={[styles.grid, className].filter(Boolean).join(' ')}
        style={{
          gridTemplateColumns: `repeat(${rowScale}, 1fr)`,
          ...style,
        }}
      >
        {files.map((file) => (
          <div
            key={file.id}
            className={styles.mediaWrapper}
            data-media-id={String(file.id)}
          >
            {isLikelyImageFile(file) && (
              <ProgressiveImage
                small={file.thumbnail_small_url ?? null}
                full={(file.thumbnail_medium_url ?? file.file_url) as string}
                dominant_color={file.dominant_color ?? undefined}
              />
            )}
            {isLikelyVideoFile(file) && <VideoLayout file={file} />}
          </div>
        ))}
      </div>
    );
  }),
);

export default MediaGrid;
