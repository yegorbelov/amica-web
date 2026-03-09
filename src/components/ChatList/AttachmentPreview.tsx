import { usePrivateMedia } from '@/hooks/usePrivateMedia';
import styles from './ChatListItem.module.scss';
import { useSettings } from '@/contexts/settings/context';
import type { File } from '@/types';

function AttachmentPreview({ file }: { file: File }) {
  const { objectUrl } = usePrivateMedia(
    file.thumbnail_small_url || file.cover_url || file.file_url,
  );
  const { autoplayVideos } = useSettings();

  // const { objectUrl: audioCoverUrl } = usePrivateMedia(file.cover_url);

  // if (!objectUrl) return null;

  switch (file.category) {
    case 'image':
      return (
        <span
          className={styles['chat-list-item__attachment']}
          style={{
            aspectRatio:
              file.width && file.height ? file.width / file.height : 1,
            backgroundColor: file.dominant_color,
          }}
        >
          {objectUrl && (
            <img src={objectUrl} alt={file.original_name || 'Attachment'} />
          )}
        </span>
      );

    case 'video':
      return (
        <span
          className={styles['chat-list-item__attachment']}
          style={{
            aspectRatio:
              file.width && file.height ? file.width / file.height : 1,
            backgroundColor: file.dominant_color,
          }}
        >
          {objectUrl && (
            <video
              className={styles['chat-list-item__attachment']}
              preload='none'
              src={file.file_url ? file.file_url + '#t=0.001' : ''}
              loop
              muted
              playsInline
              autoPlay={autoplayVideos}
            />
          )}
        </span>
      );

    case 'audio':
      return (
        <>
          {file.cover_url && (
            <span
              className={styles['chat-list-item__attachment--audio-cover']}
              style={{
                backgroundColor: file.dominant_color,
              }}
            >
              {objectUrl && (
                <img
                  className={styles['chat-list-item__attachment--audio-cover']}
                  src={objectUrl}
                  alt={file.original_name}
                />
              )}
            </span>
          )}
        </>
      );

    default:
      return (
        <a
          href={file.file_url}
          target='_blank'
          rel='noopener noreferrer'
          className={styles['chat-list-item__attachment']}
        >
          {file.original_name || 'Attachment'}
        </a>
      );
  }
}

export default AttachmentPreview;
