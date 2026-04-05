import React, { useEffect, useRef, useState } from 'react';
import styles from './RoomPage.module.scss';
import { useSettings, useBlur } from '@/contexts/settings/context';

const DESKTOP_BREAKPOINT = 768;

type Props = {
  glow?: boolean;
  isChatWindow?: boolean;
  isMainOverlay?: boolean;
};

const Wallpaper: React.FC<Props> = ({
  glow = false,
  isChatWindow = true,
  isMainOverlay = false,
}) => {
  const { settings } = useSettings();
  const { blur } = useBlur();
  const activeWallpaper = settings.activeWallpaper;
  const [isDesktopWidth, setIsDesktopWidth] = useState(
    () =>
      typeof window !== 'undefined' && window.innerWidth > DESKTOP_BREAKPOINT,
  );
  const lastIsDesktopRef = useRef(isDesktopWidth);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [, setIsPlaying] = useState(false);

  console.log('activeWallpaper', activeWallpaper);

  const colourWash = settings.activeWallpaperEditMode === 'colour-wash';
  const blackAndWhite = settings.activeWallpaperEditMode === 'black-and-white';

  useEffect(() => {
    const handleResize = () => {
      const next = window.innerWidth > DESKTOP_BREAKPOINT;
      if (next !== lastIsDesktopRef.current) {
        lastIsDesktopRef.current = next;
        setIsDesktopWidth(next);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (glow) return;
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    video.currentTime = 0;

    const playVideo = async () => {
      try {
        video.muted = true;
        await video.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    };

    if (video.readyState >= 2) {
      playVideo();
    } else {
      video.addEventListener('canplay', playVideo, { once: true });
    }

    const unlock = () => {
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
      document.removeEventListener('touchstart', unlock);
    };
    document.addEventListener('touchstart', unlock, { once: true });

    return () => {
      video.removeEventListener('canplay', playVideo);
      document.removeEventListener('touchstart', unlock);
    };
  }, [glow, activeWallpaper?.url]);

  const showWallpaper =
    (isDesktopWidth ||
      isChatWindow ||
      settings.useBackgroundThroughoutTheApp) &&
    activeWallpaper?.url;

  if (glow) {
    if (!showWallpaper || !isDesktopWidth) return null;
    return (
      <div
        className={styles.wallpaperGlow}
        style={{
          backgroundColor: colourWash ? 'var(--mainColor)' : 'transparent',
          filter: `blur(50px) ${blackAndWhite ? 'grayscale(100%)' : ''}`,
        }}
      >
        {activeWallpaper.type === 'video' ? (
          <video
            src={activeWallpaper.url + '#t=0.001'}
            playsInline
            muted
            preload='metadata'
            className='wallpaper'
            style={{
              mixBlendMode: colourWash ? 'multiply' : 'normal',
            }}
          />
        ) : (
          <img
            decoding='async'
            src={activeWallpaper.url}
            alt='Wallpaper'
            className='wallpaper'
            style={{
              mixBlendMode: colourWash ? 'multiply' : 'normal',
            }}
          />
        )}
      </div>
    );
  }

  if (!showWallpaper) return null;
  return (
    <div
      className={`${styles.wallpaperContainer} ${isMainOverlay ? styles.wallpaperMainOverlay : ''}`}
      style={{
        backgroundColor: colourWash ? 'var(--mainColor)' : 'transparent',
      }}
    >
      {activeWallpaper.type === 'photo' && (
        <img
          decoding='async'
          src={activeWallpaper.url}
          alt='Wallpaper'
          className='wallpaper'
          style={{
            filter: `blur(${blur}px) ${blackAndWhite ? 'grayscale(100%)' : ''}`,
            mixBlendMode: colourWash ? 'overlay' : 'normal',
          }}
        />
      )}
      {activeWallpaper.type === 'video' && (
        <video
          ref={videoRef}
          src={activeWallpaper.url + '#t=0.001'}
          playsInline
          muted
          loop
          preload='metadata'
          className='wallpaper'
          style={{
            filter: `blur(${blur}px) ${blackAndWhite ? 'grayscale(100%)' : ''}`,
            mixBlendMode: colourWash ? 'overlay' : 'normal',
          }}
        />
      )}
    </div>
  );
};

export default Wallpaper;
