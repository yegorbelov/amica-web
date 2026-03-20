import React, { memo } from 'react';
import { Icon } from '../Icons/AutoIcons';
import formatFileSize from '@/utils/formatFileSize';
import { useTranslation } from '@/contexts/languageCore';
import styles from './SendArea.module.scss';
import Button from '../ui/button/Button';

interface FilesPreviewProps {
  files: File[];
  onClearAll: () => void;
  onRemoveFile: (index: number) => void;
}

const crossIcon = <Icon name='Cross' />;

const FilesPreview: React.FC<FilesPreviewProps> = ({
  files,
  onClearAll,
  onRemoveFile,
}) => {
  const { t } = useTranslation();
  if (files.length === 0) return null;

  const formatPreviewTitle = (filesCount: number) =>
    filesCount === 1
      ? `1 ${t('sendArea.file')}`
      : `${filesCount} ${t('sendArea.files')}`;

  const getFileType = (file: File) => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type === 'application/pdf') return 'pdf';
    return 'file';
  };

  return (
    <div className={styles['files-preview']}>
      <div className={styles['files-preview-header']}>
        <span className={styles['files-preview-header-title']}>
          {formatPreviewTitle(files.length)}
        </span>
        <Button
          key={'send-area-clear-all-button'}
          className={styles['clear-all-btn']}
          onClick={onClearAll}
          aria-label={t('sendArea.clearAllFiles')}
          type='button'
        >
          {t('sendArea.clearAll')}
        </Button>
      </div>
      <div className={styles['files-preview-list']}>
        {files.map((file, index) => {
          const fileType = getFileType(file);

          const previewUrl =
            fileType === 'image' || fileType === 'video'
              ? URL.createObjectURL(file)
              : null;

          return (
            <div key={index} className={styles['file-preview-item']}>
              {fileType === 'image' && (
                <img
                  src={previewUrl || ''}
                  alt={file.name}
                  className={styles['file-preview-image']}
                />
              )}

              {fileType === 'video' && (
                <video
                  src={previewUrl || ''}
                  muted
                  autoPlay
                  playsInline
                  className={styles['file-preview-image']}
                />
              )}
              {fileType === 'file' && (
                <div className={styles['file-preview-file']}>📄</div>
              )}

              <div className={styles['file-info']}>
                <span className={styles['file-name']}>{file.name}</span>
                <span className={styles['file-size']}>
                  <span>{formatFileSize(file.size)}</span>
                </span>
              </div>

              <button
                onClick={() => onRemoveFile(index)}
                type='button'
                className={styles['remove-file-btn']}
              >
                {crossIcon}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(FilesPreview);
