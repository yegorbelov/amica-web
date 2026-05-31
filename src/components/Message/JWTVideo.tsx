import {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useState,
  memo,
} from 'react';
import { getAccessTokenOrThrow, refreshTokenIfNeeded } from '@/utils/authStore';
import { resolveApiUrl } from '@/utils/resolveApiUrl';

interface JWTVideoProps {
  url: string;
  autoPlay?: boolean;
  className?: string;
  muted?: boolean;
  playing?: boolean;
  loop?: boolean;
  /** Play/pause driven by AudioContext (pip) or playing prop */
  externallyControlled?: boolean;
  /** With externallyControlled: only src sync, play/pause via AudioContext DOM */
  playbackFromContext?: boolean;
}

const JWTVideoInner = forwardRef<HTMLVideoElement, JWTVideoProps>(
  (
    {
      url,
      className,
      muted = false,
      autoPlay = true,
      playing = true,
      loop = true,
      externallyControlled = false,
      playbackFromContext = false,
    },
    ref,
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [signedUrl, setSignedUrl] = useState<string | null>(null);

    useImperativeHandle(ref, () => videoRef.current!);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const base = resolveApiUrl(url);
          if (!base) return;
          await refreshTokenIfNeeded();
          const token = await getAccessTokenOrThrow();
          const separator = base.includes('?') ? '&' : '?';
          const next = `${base}${separator}token=${encodeURIComponent(token)}`;
          if (cancelled) {
            return;
          }
          setSignedUrl((prev) => (prev === next ? prev : next));
        } catch (e) {
          console.error(e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [url]);

    useEffect(() => {
      if (externallyControlled) return;
      const video = videoRef.current;
      if (!video || !signedUrl) return;
      if (video.src !== signedUrl) video.src = signedUrl;
    }, [signedUrl, externallyControlled]);

    useEffect(() => {
      if (!externallyControlled || !playbackFromContext) return;
      const video = videoRef.current;
      if (!video || !signedUrl) return;
      if (!video.src) video.src = signedUrl;
    }, [signedUrl, externallyControlled, playbackFromContext]);

    useEffect(() => {
      if (!externallyControlled || playbackFromContext) return;
      const video = videoRef.current;
      if (!video || !signedUrl) return;
      if (!video.src) video.src = signedUrl;
      if (playing && video.paused) void video.play().catch(() => {});
      if (!playing && !video.paused) video.pause();
    }, [playing, signedUrl, externallyControlled, playbackFromContext]);

    useEffect(() => {
      if (externallyControlled) return;
      const video = videoRef.current;
      if (!video || !signedUrl) return;
      if (playing && video.paused) void video.play().catch(() => {});
      if (!playing && !video.paused) video.pause();
    }, [playing, signedUrl, externallyControlled]);

    useEffect(() => {
      if (externallyControlled) return;
      const video = videoRef.current;
      if (!video || !signedUrl) return;
      const nudgeFirstFrame = () => {
        if (playing) return;
        try {
          if (video.currentTime === 0) video.currentTime = 0.001;
        } catch {
          /* seek may throw before metadata */
        }
      };
      video.addEventListener('loadeddata', nudgeFirstFrame);
      return () => video.removeEventListener('loadeddata', nudgeFirstFrame);
    }, [signedUrl, playing, externallyControlled]);

    return (
      <video
        ref={videoRef}
        playsInline
        autoPlay={autoPlay && !externallyControlled}
        muted={muted}
        controlsList='nodownload'
        loop={loop}
        preload={externallyControlled ? 'auto' : 'metadata'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          background: '#000',
        }}
        className={className}
        disablePictureInPicture
        // pip='false'
      />
    );
  },
);

JWTVideoInner.displayName = 'JWTVideo';

export const JWTVideo = memo(JWTVideoInner);
