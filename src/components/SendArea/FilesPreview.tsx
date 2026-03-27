import React, { memo, useEffect, useMemo } from 'react';
import { Icon } from '../Icons/AutoIcons';
import formatFileSize from '@/utils/formatFileSize';
import { useTranslation } from '@/contexts/languageCore';
import styles from './SendArea.module.scss';
import Button from '../ui/button/Button';

interface FilesPreviewProps {
  files: File[];
  onClearAll: () => void;
  onRemoveFile: (index: number) => void;
  isUploading?: boolean;
  uploadProgress?: number;
}

const crossIcon = <Icon name='Cross' />;

function getFileKind(file: File): 'image' | 'video' | 'pdf' | 'file' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type === 'application/pdf') return 'pdf';
  return 'file';
}

const FilesPreview: React.FC<FilesPreviewProps> = ({
  files,
  onClearAll,
  onRemoveFile,
  isUploading = false,
  uploadProgress = 0,
}) => {
  const { t } = useTranslation();

  const formatPreviewTitle = (filesCount: number) =>
    filesCount === 1
      ? `1 ${t('sendArea.file')}`
      : `${filesCount} ${t('sendArea.files')}`;

  const previewSources = useMemo(() => {
    if (files.length === 0) return [];
    return files.map((file) => {
      const kind = getFileKind(file);
      if (kind === 'image' || kind === 'video') {
        return { kind, url: URL.createObjectURL(file) as string };
      }
      return { kind, url: null as string | null };
    });
  }, [files]);

  useEffect(() => {
    return () => {
      previewSources.forEach((s) => {
        if (s.url) URL.revokeObjectURL(s.url);
      });
    };
  }, [previewSources]);

  if (files.length === 0) return null;

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
          disabled={isUploading}
        >
          {t('sendArea.clearAll')}
        </Button>
      </div>
      <div className={styles['files-preview-list']}>
        {files.map((file, index) => {
          const source = previewSources[index];
          const fileType = source?.kind ?? getFileKind(file);
          const previewUrl = source?.url ?? null;

          return (
            <div
              key={`${file.name}-${file.size}-${index}`}
              className={styles['file-preview-item']}
              aria-busy={isUploading}
            >
              {fileType === 'image' && previewUrl && (
                <img
                  src={previewUrl}
                  alt={file.name}
                  className={styles['file-preview-image']}
                />
              )}

              {fileType === 'video' && previewUrl && (
                <video
                  src={previewUrl}
                  muted
                  autoPlay
                  playsInline
                  className={styles['file-preview-image']}
                />
              )}
              {(fileType === 'pdf' || fileType === 'file') && (
                <div className={styles['file-preview-file']}>
                  {fileType === 'pdf' ? '📕' : '📄'}
                </div>
              )}

              <div className={styles['file-info']}>
                <span className={styles['file-name']}>{file.name}</span>
                <span className={styles['file-size']}>
                  <span>{formatFileSize(file.size)}</span>
                </span>
              </div>

              {isUploading && (
                <div
                  className={styles['file-preview-upload-overlay']}
                  aria-hidden
                >
                  <span
                    className={styles['file-preview-upload-overlay__spinner']}
                  />
                  <span className={styles['file-preview-upload-overlay__text']}>
                    {uploadProgress > 0
                      ? `${uploadProgress}%`
                      : t('sendArea.fileItemUploading')}
                  </span>
                  {uploadProgress > 0 && (
                    <div className={styles['file-preview-upload-overlay__track']}>
                      <div
                        className={styles['file-preview-upload-overlay__bar']}
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {!isUploading && (
                <button
                  onClick={() => onRemoveFile(index)}
                  type='button'
                  className={styles['remove-file-btn']}
                  aria-label={t('sendArea.removeFile')}
                >
                  {crossIcon}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(FilesPreview);
