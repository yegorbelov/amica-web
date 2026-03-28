import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from 'react';
import { stringToColor, pSBC } from '@/utils/index';
import styles from './Avatar.module.scss';
import type { DisplayMedia, MediaLayer, File } from '@/types';
import { apiFetch } from '@/utils/apiFetch';

export interface AvatarProps {
  displayName: string;
  displayMedia?: DisplayMedia;
  className?: string;
  size?: 'small' | 'medium';
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

interface MediaLayerWithUrl extends MediaLayer {
  url?: string;
  ready?: boolean;
}

const FADE_DURATION = 1000;

function getInitials(name: string): string {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (
    words[0].charAt(0).toUpperCase() +
    words[words.length - 1].charAt(0).toUpperCase()
  );
}

async function fetchPrivateMedia(url: string): Promise<string> {
  const res = await apiFetch(url);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function isDisplayMediaReadyForAvatar(
  media: DisplayMedia | undefined,
): media is DisplayMedia {
  if (!media) return false;
  if (media.type === 'photo') {
    return Boolean(media.small && media.medium);
  }
  if (media.type === 'video') {
    return Boolean(media.url);
  }
  return false;
}

function getProtectedUrl(
  displayMedia: DisplayMedia | File,
  size?: 'small' | 'medium',
): string {
  if (displayMedia && 'type' in displayMedia) {
    const dm = displayMedia as DisplayMedia;
    return dm.type === 'photo'
      ? size === 'medium' && dm.medium
        ? dm.medium!
        : dm.small || ''
      : (dm.url ?? '');
  }
  const f = displayMedia as File;
  return f?.file_url || f?.thumbnail_small_url || '';
}

const Avatar = memo(function Avatar({
  displayName,
  displayMedia,
  className = '',
  size,
  onClick,
}: AvatarProps) {
  const avatarRef = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<MediaLayerWithUrl[]>([]);
  const [fontSize, setFontSize] = useState(12);
  const [currentMedia, setCurrentMedia] = useState<DisplayMedia | File | null>(
    displayMedia ?? null,
  );
  const [url, setUrl] = useState<string | null>(null);

  const initials = useMemo(() => getInitials(displayName), [displayName]);

  const { avatarStyle } = useMemo(() => {
    const color = stringToColor(displayName);
    const middle = pSBC(-0.6, color);
    const darker = pSBC(-0.8, color);
    return {
      avatarStyle: !isDisplayMediaReadyForAvatar(displayMedia)
        ? {
            background: `linear-gradient(0deg, ${darker} 0%, ${middle} 35%, ${color} 100%)`,
          }
        : undefined,
    };
  }, [displayName, displayMedia]);

  useEffect(() => {
    const el = avatarRef.current;
    if (!el) return;
    const updateFont = () => {
      const next = Math.round(el.clientWidth * 0.45);
      setFontSize((prev) => (prev === next ? prev : next));
    };
    updateFont();
    const obs = new ResizeObserver(updateFont);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!isDisplayMediaReadyForAvatar(displayMedia)) return;
    const id = crypto.randomUUID();
    const newLayer: MediaLayerWithUrl = {
      id,
      media: displayMedia,
      ready: false,
    };
    const frameId = requestAnimationFrame(() => {
      setLayers((prev) => [...prev, newLayer]);
    });
    const protectedUrl = getProtectedUrl(displayMedia, size);
    if (!protectedUrl) {
      return () => cancelAnimationFrame(frameId);
    }
    fetchPrivateMedia(protectedUrl).then((objectUrl) => {
      setUrl(objectUrl);
      setLayers((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, url: objectUrl, ready: true } : l,
        ),
      );
    });
    return () => cancelAnimationFrame(frameId);
  }, [displayMedia, size]);

  const handleLayerAnimationEnd = useCallback((layer: MediaLayerWithUrl) => {
    setCurrentMedia(layer.media);
    setLayers((prev) => prev.slice(-1));
  }, []);

  const mediaUrl = url ?? undefined;
  const showMedia = currentMedia && mediaUrl;

  return (
    <div
      ref={avatarRef}
      className={`${styles.profilePicture} ${className}`}
      style={avatarStyle}
      title={displayName}
      onClick={onClick}
    >
      <div className={styles.avatarLayer}>
        {showMedia ? (
          'type' in currentMedia && currentMedia.type === 'video' ? (
            <video
              className={styles.avatarImage}
              src={mediaUrl}
              muted
              autoPlay
              loop
              playsInline
              preload='metadata'
            />
          ) : (
            <img
              className={styles.avatarImage}
              src={mediaUrl}
              alt={`${displayName} avatar`}
              draggable={false}
            />
          )
        ) : (
          <span className={styles.avatarInitials} style={{ fontSize }}>
            {initials}
          </span>
        )}
      </div>

      {layers.map((layer) =>
        layer.ready ? (
          <AvatarLayer
            key={layer.id}
            layer={layer}
            displayName={displayName}
            fontSize={fontSize}
            initials={initials}
            onAnimationEnd={() => handleLayerAnimationEnd(layer)}
          />
        ) : null,
      )}
    </div>
  );
});

const AvatarLayer = memo(function AvatarLayer({
  layer,
  displayName,
  fontSize,
  initials,
  onAnimationEnd,
}: {
  layer: MediaLayerWithUrl;
  displayName: string;
  fontSize: number;
  initials: string;
  onAnimationEnd: () => void;
}) {
  const media = layer.media;
  const mediaUrl = layer.url;
  const isVideo =
    media &&
    'type' in (media as DisplayMedia) &&
    (media as DisplayMedia).type === 'video';

  return (
    <div
      className={styles.avatarLayer}
      style={{
        opacity: 0,
        animation: `fadeIn ${FADE_DURATION}ms ease forwards`,
      }}
      onAnimationEnd={onAnimationEnd}
    >
      {mediaUrl ? (
        isVideo ? (
          <video
            className={styles.avatarImage}
            src={mediaUrl}
            muted
            autoPlay
            loop
            playsInline
            preload='metadata'
          />
        ) : (
          <img
            className={styles.avatarImage}
            src={mediaUrl}
            alt={`${displayName} avatar`}
            draggable={false}
          />
        )
      ) : (
        <span className={styles.avatarInitials} style={{ fontSize }}>
          {initials}
        </span>
      )}
    </div>
  );
});

export default Avatar;
