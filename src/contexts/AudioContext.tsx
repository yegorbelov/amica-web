import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import {
  fetchPrivateMedia,
  getSignedMediaUrl,
  PLAYBACK_SPEEDS,
  checkVolumeSupport,
} from '@/utils/audio';
import type { File } from '@/types';
import { AudioContext, type MediaType } from '@/contexts/audioContext';
import { MediaVideoPiP } from '@/components/MediaVideoPiP/MediaVideoPiP';

function getPosterSource(file: File | null | undefined) {
  return (
    file?.cover_url ??
    file?.thumbnail_medium_url ??
    file?.thumbnail_small_url ??
    null
  );
}

function sameMediaBase(a: string, b: string) {
  try {
    const urlA = new URL(a, window.location.origin);
    const urlB = new URL(b, window.location.origin);
    urlA.searchParams.delete('token');
    urlB.searchParams.delete('token');
    return urlA.toString() === urlB.toString();
  } catch {
    return a === b;
  }
}

function pauseAllVideosExcept(except: HTMLVideoElement | null | undefined) {
  document.querySelectorAll('video').forEach((element) => {
    if (element !== except) {
      element.pause();
    }
  });
}

function copyVideoPlaybackState(from: HTMLVideoElement, to: HTMLVideoElement) {
  if (from.src && (!to.src || !sameMediaBase(to.src, from.src))) {
    to.src = from.src;
  }
  try {
    to.currentTime = from.currentTime;
  } catch {
    /* not seekable yet */
  }
  to.muted = from.muted;
}

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inlineVideoRef = useRef<HTMLVideoElement | null>(null);
  const inlineVideoIdRef = useRef<number | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const inlineVideoVisibleRef = useRef(true);
  const pendingResumeTimeRef = useRef<number | null>(null);
  const coverBlobUrlRef = useRef<string | null>(null);
  const [currentMediaId, setCurrentMediaId] = useState<number | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [canChangeVolume, setCanChangeVolume] = useState(false);
  const volumeBeforeMuteRef = useRef(1);
  const [videoTargetVersion, setVideoTargetVersion] = useState(0);

  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [playlist, setPlaylistState] = useState<File[] | null>(null);
  const [currentTime, setCurrentTimeState] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasInlineVideo, setHasInlineVideo] = useState(false);
  const [inlineVideoVisible, setInlineVideoVisibleState] = useState(true);
  const seekingRef = useRef(false);
  const scrubbingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const endedHandledRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  const isMutedRef = useRef(isMuted);
  const mediaTypeRef = useRef(mediaType);
  const currentMediaIdRef = useRef(currentMediaId);
  const playlistRef = useRef(playlist);
  const inlineWatchCleanupRef = useRef<(() => void) | null>(null);

  isPlayingRef.current = isPlaying;
  isMutedRef.current = isMuted;
  mediaTypeRef.current = mediaType;
  currentMediaIdRef.current = currentMediaId;
  playlistRef.current = playlist;

  const setPlayingState = useCallback((playing: boolean) => {
    if (isPlayingRef.current === playing) return;
    isPlayingRef.current = playing;
    setIsPlaying(playing);
  }, []);

  const applyAudioPlaybackSettings = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.playbackRate = playbackSpeed;
    setCanChangeVolume(checkVolumeSupport(audio));
  }, [volume, playbackSpeed]);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolumeState(clamped);
    if (clamped > 0) volumeBeforeMuteRef.current = clamped;
    if (audioRef.current && mediaTypeRef.current === 'audio') {
      audioRef.current.volume = clamped;
    }
  }, []);

  const toggleVolumeMute = useCallback(() => {
    setVolumeState((current) => {
      const next = current > 0 ? 0 : volumeBeforeMuteRef.current || 1;
      if (current > 0) volumeBeforeMuteRef.current = current;
      if (audioRef.current && mediaTypeRef.current === 'audio') {
        audioRef.current.volume = next;
      }
      return next;
    });
  }, []);

  const cyclePlaybackSpeed = useCallback(() => {
    setPlaybackSpeed((prev) => {
      const idx = PLAYBACK_SPEEDS.indexOf(
        prev as (typeof PLAYBACK_SPEEDS)[number],
      );
      const nextIndex = (idx + 1) % PLAYBACK_SPEEDS.length;
      const next = PLAYBACK_SPEEDS[nextIndex];
      if (audioRef.current && mediaTypeRef.current === 'audio') {
        audioRef.current.playbackRate = next;
      }
      return next;
    });
  }, []);

  const resolveActiveVideo = useCallback((fileId?: number) => {
    const targetId = fileId ?? currentMediaIdRef.current;
    if (targetId == null || currentMediaIdRef.current !== targetId) return null;

    return pipVideoRef.current ?? inlineVideoRef.current ?? null;
  }, []);

  const getVideoElement = useCallback(
    () => resolveActiveVideo(),
    [resolveActiveVideo],
  );

  const resolveVideoElement = useCallback(
    (fileId?: number) => resolveActiveVideo(fileId),
    [resolveActiveVideo],
  );

  const waitForPipVideo = useCallback((maxFrames = 120) => {
    return new Promise<HTMLVideoElement | null>((resolve) => {
      let frames = 0;
      const tryResolve = () => {
        const pip = pipVideoRef.current;
        if (pip) {
          resolve(pip);
          return;
        }
        if (frames++ >= maxFrames) {
          resolve(null);
          return;
        }
        requestAnimationFrame(tryResolve);
      };
      tryResolve();
    });
  }, []);

  const applyVideoMuted = useCallback(() => {
    const muted = isMutedRef.current;
    if (pipVideoRef.current) pipVideoRef.current.muted = muted;
    if (inlineVideoRef.current) inlineVideoRef.current.muted = true;
  }, []);

  const pauseUnmanagedVideos = useCallback(() => {
    const managed = new Set(
      [inlineVideoRef.current, pipVideoRef.current].filter(
        (el): el is HTMLVideoElement => el != null,
      ),
    );
    document.querySelectorAll('video').forEach((element) => {
      if (!managed.has(element)) {
        element.pause();
      }
    });
  }, []);

  const shouldInlineMirror = useCallback(() => {
    return (
      isPlayingRef.current &&
      inlineVideoVisibleRef.current &&
      mediaTypeRef.current === 'video'
    );
  }, []);

  const pauseInlineMirror = useCallback(() => {
    inlineVideoRef.current?.pause();
  }, []);

  const resumeInlineMirror = useCallback(
    (opts?: { alignTime?: boolean }) => {
      const pip = pipVideoRef.current;
      const inline = inlineVideoRef.current;
      if (!inline) return;

      inline.muted = true;
      inline.loop = false;

      if (!shouldInlineMirror() || !pip?.src) {
        inline.pause();
        return;
      }

      if (inline.src !== pip.src) {
        inline.src = pip.src;
      }

      if (opts?.alignTime !== false) {
        try {
          inline.currentTime = pip.currentTime;
        } catch {
          /* not seekable yet */
        }
      }

      if (inline.paused) {
        void inline.play().catch(() => {});
      }
    },
    [shouldInlineMirror],
  );

  const syncInlineMirror = useCallback(
    (opts?: { alignTime?: boolean }) => {
      if (shouldInlineMirror()) {
        resumeInlineMirror(opts);
      } else {
        pauseInlineMirror();
        if (opts?.alignTime) {
          const pip = pipVideoRef.current;
          const inline = inlineVideoRef.current;
          if (pip?.src && inline) {
            if (inline.src !== pip.src) inline.src = pip.src;
            try {
              inline.currentTime = pip.currentTime;
            } catch {
              /* not seekable yet */
            }
          }
        }
      }
    },
    [shouldInlineMirror, resumeInlineMirror, pauseInlineMirror],
  );

  const detachInlineWatchdog = useCallback(() => {
    inlineWatchCleanupRef.current?.();
    inlineWatchCleanupRef.current = null;
  }, []);

  const attachInlineWatchdog = useCallback(
    (element: HTMLVideoElement) => {
      detachInlineWatchdog();

      const recover = () => {
        if (!shouldInlineMirror()) return;
        resumeInlineMirror();
      };

      element.addEventListener('pause', recover);
      element.addEventListener('waiting', recover);
      element.addEventListener('stalled', recover);

      inlineWatchCleanupRef.current = () => {
        element.removeEventListener('pause', recover);
        element.removeEventListener('waiting', recover);
        element.removeEventListener('stalled', recover);
      };
    },
    [detachInlineWatchdog, shouldInlineMirror, resumeInlineMirror],
  );

  const applyTimeToVideos = useCallback(
    (time: number) => {
      const pip = pipVideoRef.current;
      const inline = inlineVideoRef.current;

      if (pip?.src) {
        try {
          pip.currentTime = time;
        } catch {
          /* not seekable yet */
        }
      }

      if (inline) {
        if (pip?.src && (!inline.src || !sameMediaBase(inline.src, pip.src))) {
          inline.src = pip.src;
        }
        try {
          inline.currentTime = time;
        } catch {
          /* not seekable yet */
        }
        inline.muted = true;
      }
    },
    [],
  );

  const pauseManagedVideos = useCallback(() => {
    pipVideoRef.current?.pause();
    inlineVideoRef.current?.pause();
    pauseAllVideosExcept(null);
  }, []);

  const syncPipPlayback = useCallback(() => {
    const pip = pipVideoRef.current;
    if (!pip || currentMediaIdRef.current == null) return;

    pip.muted = isMutedRef.current;
    pip.loop = false;

    const shouldPlay = isPlayingRef.current;
    if (shouldPlay && pip.src) {
      void pip.play().catch(() => {});
      resumeInlineMirror({ alignTime: inlineVideoVisibleRef.current });
    } else {
      pip.pause();
      pauseInlineMirror();
    }

    pauseUnmanagedVideos();
  }, [pauseUnmanagedVideos, resumeInlineMirror, pauseInlineMirror]);

  const setInlineVideoVisible = useCallback(
    (visible: boolean) => {
      if (inlineVideoVisibleRef.current === visible) return;

      inlineVideoVisibleRef.current = visible;
      setInlineVideoVisibleState(visible);
      syncInlineMirror({ alignTime: true });
      if (visible) {
        resumeInlineMirror();
      } else {
        pauseInlineMirror();
      }
      setVideoTargetVersion((version) => version + 1);
    },
    [syncInlineMirror, resumeInlineMirror, pauseInlineMirror],
  );

  const setScrubbing = useCallback(
    (scrubbing: boolean) => {
      scrubbingRef.current = scrubbing;
      seekingRef.current = scrubbing;

      if (scrubbing || mediaTypeRef.current !== 'video') return;

      applyTimeToVideos(currentTimeRef.current);
    },
    [applyTimeToVideos],
  );

  const registerInlineVideo = useCallback(
    (element: HTMLVideoElement | null, fileId?: number) => {
      if (element) {
        element.loop = false;
        element.muted = true;

        const isCurrentTrack =
          fileId != null && fileId === currentMediaIdRef.current;
        const previous = inlineVideoRef.current;
        const isNewRegistration = previous !== element;

        if (isNewRegistration && previous) {
          previous.pause();
        }

        if (!isCurrentTrack) {
          element.pause();
          setVideoTargetVersion((version) => version + 1);
          return;
        }

        inlineVideoRef.current = element;
        inlineVideoIdRef.current = fileId ?? null;
        setHasInlineVideo(true);
        attachInlineWatchdog(element);

        inlineVideoVisibleRef.current = true;
        setInlineVideoVisibleState(true);

        if (isNewRegistration && previous?.src && previous !== element) {
          copyVideoPlaybackState(previous, element);
        }

        syncInlineMirror({ alignTime: true });
        if (isPlayingRef.current) {
          syncPipPlayback();
        } else {
          pauseManagedVideos();
        }
      } else {
        detachInlineWatchdog();
        inlineVideoRef.current = null;
        inlineVideoIdRef.current = null;
        setHasInlineVideo(false);
      }

      setVideoTargetVersion((version) => version + 1);
    },
    [syncPipPlayback, syncInlineMirror, pauseManagedVideos, attachInlineWatchdog, detachInlineWatchdog],
  );

  const registerPipVideo = useCallback(
    (element: HTMLVideoElement | null) => {
      pipVideoRef.current = element;
      if (element) {
        element.loop = false;
        element.muted = isMutedRef.current;

        const isCurrentTrack = currentMediaIdRef.current != null;
        if (!isCurrentTrack) {
          element.pause();
          setVideoTargetVersion((version) => version + 1);
          return;
        }

        const inline = inlineVideoRef.current;
        if (
          inline?.src &&
          (!element.src || !sameMediaBase(element.src, inline.src))
        ) {
          copyVideoPlaybackState(inline, element);
        }

        syncPipPlayback();
      }

      setVideoTargetVersion((version) => version + 1);
    },
    [syncPipPlayback],
  );

  const detachInlineVideo = useCallback(() => {
    detachInlineWatchdog();
    inlineVideoRef.current = null;
    inlineVideoIdRef.current = null;
    setHasInlineVideo(false);

    if (
      mediaTypeRef.current === 'video' &&
      currentMediaIdRef.current != null
    ) {
      inlineVideoVisibleRef.current = false;
      setInlineVideoVisibleState(false);
      syncPipPlayback();
    } else {
      inlineVideoVisibleRef.current = true;
      setInlineVideoVisibleState(true);
    }

    setVideoTargetVersion((version) => version + 1);
  }, [syncPipPlayback, detachInlineWatchdog]);

  const clearVideoAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }, []);

  const playVideo = useCallback(
    async (_file: File, video?: HTMLVideoElement | null) => {
      clearVideoAudio();

      const target = video ?? getVideoElement();
      if (!target) return;

      target.muted = isMutedRef.current;
      target.loop = false;

      if (target.paused) {
        try {
          await target.play();
        } catch {
          /* autoplay blocked */
        }
      }

      pauseUnmanagedVideos();
      syncInlineMirror({ alignTime: true });
      setPlayingState(!target.paused);
    },
    [clearVideoAudio, setPlayingState, getVideoElement, pauseUnmanagedVideos, syncInlineMirror],
  );

  const pauseVideo = useCallback(() => {
      setPlayingState(false);
      pauseManagedVideos();
    },
    [setPlayingState, pauseManagedVideos],
  );

  const isVideoPlaying = useCallback(
    (file: File) => {
      const video = resolveVideoElement(file.id);
      return !!video && !video.paused;
    },
    [resolveVideoElement],
  );

  const applyCoverForFile = useCallback(async (file: File | null | undefined) => {
    const posterSource = getPosterSource(file);
    const cover =
      posterSource != null ? await fetchPrivateMedia(posterSource) : null;
    if (coverBlobUrlRef.current) {
      URL.revokeObjectURL(coverBlobUrlRef.current);
    }
    coverBlobUrlRef.current = cover;
    setCoverUrl(cover);
    return cover;
  }, []);

  const updateMediaSession = useCallback(
    (file: File, artworkUrl: string | null) => {
      if (!('mediaSession' in navigator)) return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: file.original_name ?? '',
        artwork: artworkUrl
          ? [{ src: artworkUrl, sizes: '512x512', type: 'image/png' }]
          : [],
      });
    },
    [],
  );

  const setVideoResumeTime = useCallback((time: number) => {
    pendingResumeTimeRef.current = time;
  }, []);

  const playMediaFile = useCallback(
    async (file: File, type: MediaType) => {
      if (!file.file_url) return;

      const isNewTrack = file.id !== currentMediaId || type !== mediaType;

      if (type !== 'video') {
        inlineVideoRef.current?.pause();
        inlineVideoRef.current = null;
        inlineVideoIdRef.current = null;
        setHasInlineVideo(false);
        clearVideoAudio();
      }

      setMediaType(type);
      setCurrentMediaId(file.id ?? null);

      const resumeFromPending = pendingResumeTimeRef.current;
      if (isNewTrack) {
        const time = resumeFromPending ?? 0;
        setCurrentTimeState(time);
        if (type === 'video') {
          applyTimeToVideos(time);
        }
      }
      if (file.duration) {
        setDuration(file.duration);
      }
      endedHandledRef.current = false;

      const artworkUrl = await applyCoverForFile(file);
      updateMediaSession(file, artworkUrl);

      if (type === 'video') {
        clearVideoAudio();

        let pip = pipVideoRef.current;
        if (!pip) {
          pip = await waitForPipVideo();
        }
        if (!pip) return;

        const signedUrl = await getSignedMediaUrl(file.file_url);
        const resumeTime =
          resumeFromPending ??
          (pip.src && sameMediaBase(pip.src, signedUrl)
            ? pip.currentTime
            : 0);
        pendingResumeTimeRef.current = null;

        if (!pip.src || !sameMediaBase(pip.src, signedUrl)) {
          pip.src = signedUrl;
          await new Promise<void>((resolve) => {
            if (pip!.readyState >= 2) {
              resolve();
              return;
            }
            const onReady = () => {
              pip!.removeEventListener('canplay', onReady);
              resolve();
            };
            pip!.addEventListener('canplay', onReady);
          });
        }
        pip.currentTime = resumeTime;

        await playVideo(file, pip);
        syncInlineMirror({ alignTime: true });
        return;
      }

      pendingResumeTimeRef.current = null;

      pauseAllVideosExcept(null);
      const audio = audioRef.current;
      if (!audio) return;

      const url = await fetchPrivateMedia(file.file_url);
      if (audio.src !== url) audio.src = url;
      applyAudioPlaybackSettings();
      await audio.play();
      setIsPlaying(true);
    },
    [
      applyCoverForFile,
      updateMediaSession,
      currentMediaId,
      mediaType,
      playVideo,
      clearVideoAudio,
      applyTimeToVideos,
      waitForPipVideo,
      applyAudioPlaybackSettings,
      syncInlineMirror,
    ],
  );

  const setPlaylist = useCallback(
    (
      newPlaylist: File[] | null,
      chatId: number | null,
      opts?: {
        autoPlayId?: number | null;
        coverUrl?: string | null;
        mediaType?: MediaType;
      },
    ) => {
      setCurrentChatId(chatId);
      setPlaylistState(newPlaylist);

      if (opts?.autoPlayId != null && newPlaylist) {
        void (async () => {
          const mediaId = opts.autoPlayId!;
          const file = newPlaylist.find((f) => f.id === mediaId);
          if (!file) return;

          const type = opts.mediaType ?? 'audio';

          if (currentMediaId !== mediaId || mediaType !== type) {
            await playMediaFile(file, type);
            return;
          }

          if (type === 'video') {
            const video = resolveVideoElement(file.id);
            if (!video) return;

            if (isVideoPlaying(file)) {
              pauseVideo();
            } else {
              await playVideo(file, video);
            }
            return;
          }

          const audio = audioRef.current;
          if (!audio) return;

          if (audio.paused) {
            await audio.play();
            setIsPlaying(true);
          } else {
            audio.pause();
            setIsPlaying(false);
          }
        })();
      }
    },
    [
      currentMediaId,
      mediaType,
      playMediaFile,
      resolveVideoElement,
      playVideo,
      pauseVideo,
      isVideoPlaying,
    ],
  );

  const togglePlay = useCallback(
    async (mediaId: number) => {
      if (!playlist || mediaType == null) return;

      const file = playlist.find((f) => f.id === mediaId);
      if (!file) return;

      if (currentMediaId !== mediaId) {
        await playMediaFile(file, mediaType);
        return;
      }

      if (mediaType === 'video') {
        const video = resolveVideoElement(file.id);
        if (!video) return;

        if (isVideoPlaying(file)) {
          pauseVideo();
        } else {
          await playVideo(file, video);
        }
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;

      if (audio.paused) {
        await audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    },
    [
      playlist,
      mediaType,
      currentMediaId,
      playMediaFile,
      resolveVideoElement,
      playVideo,
      pauseVideo,
      isVideoPlaying,
    ],
  );

  const playPrev = useCallback(async () => {
    if (!playlist || currentMediaId == null || mediaType == null) return;

    const index = playlist.findIndex((f) => f.id === currentMediaId);
    const file = playlist[index];
    if (!file) return;

    if (index <= 0) {
      if (mediaType === 'video') {
        const video = resolveVideoElement(file.id);
        if (!video) return;
        video.currentTime = 0;
        await playVideo(file, video);
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      if (audio.paused) await audio.play();
      setIsPlaying(true);
      return;
    }

    await playMediaFile(playlist[index - 1], mediaType);
  }, [playlist, currentMediaId, mediaType, playMediaFile, playVideo, resolveVideoElement]);

  const playNext = useCallback(async () => {
    if (!playlist || currentMediaId == null || mediaType == null) return;

    const index = playlist.findIndex((f) => f.id === currentMediaId);
    if (index < 0 || index >= playlist.length - 1) {
      const file = playlist[index];
      if (mediaType === 'video' && file) {
        pauseVideo();
      } else {
        audioRef.current?.pause();
        setIsPlaying(false);
      }
      return;
    }

    await playMediaFile(playlist[index + 1], mediaType);
  }, [playlist, currentMediaId, mediaType, playMediaFile, pauseVideo]);

  const closeMedia = useCallback(() => {
    audioRef.current?.pause();
    clearVideoAudio();
    pauseManagedVideos();
    inlineVideoRef.current = null;
    inlineVideoIdRef.current = null;
    setHasInlineVideo(false);
    inlineVideoVisibleRef.current = true;
    setInlineVideoVisibleState(true);
    pendingResumeTimeRef.current = null;
    setCurrentMediaId(null);
    setMediaType(null);
    setIsPlaying(false);
    setCurrentTimeState(0);
    setDuration(0);
    setVideoTargetVersion((version) => version + 1);
  }, [clearVideoAudio, pauseManagedVideos]);

  const setCurrentAudioId = useCallback(
    (id: number | null) => {
      if (id === null) closeMedia();
      else setCurrentMediaId(id);
    },
    [closeMedia],
  );

  const setCurrentTime = useCallback(
    (
      time: number,
      opts?: { mediaType?: MediaType; mediaId?: number | null },
    ) => {
      const type = opts?.mediaType ?? mediaTypeRef.current;

      seekingRef.current = true;
      currentTimeRef.current = time;
      setCurrentTimeState(time);

      if (type === 'video') {
        applyTimeToVideos(time);
      } else if (audioRef.current) {
        audioRef.current.currentTime = time;
      }

      if (!scrubbingRef.current) {
        requestAnimationFrame(() => {
          seekingRef.current = false;
        });
      }
    },
    [applyTimeToVideos],
  );

  useEffect(() => {
    if (!currentMediaId) {
      setDuration(0);
      setCurrentTimeState(0);
      return;
    }

    const file = playlist?.find((item) => item.id === currentMediaId);
    if (file?.duration) {
      setDuration(file.duration);
    }
  }, [currentMediaId, playlist]);

  useEffect(() => {
    if (!currentMediaId) return;

    let rafId: number;
    let frame = 0;

    const tick = () => {
      frame += 1;
      if (!seekingRef.current && !scrubbingRef.current) {
        const media =
          mediaType === 'video' ? getVideoElement() : audioRef.current;
        if (media) {
          if (Number.isFinite(media.duration) && media.duration > 0) {
            setDuration((prev) => prev || media.duration);
          }
          setCurrentTimeState(media.currentTime);
          currentTimeRef.current = media.currentTime;
        }

        if (
          mediaType === 'video' &&
          frame % 20 === 0 &&
          isPlayingRef.current &&
          inlineVideoVisibleRef.current
        ) {
          const inline = inlineVideoRef.current;
          const pip = pipVideoRef.current;
          if (inline?.paused && pip && !pip.paused) {
            resumeInlineMirror({ alignTime: false });
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [currentMediaId, mediaType, getVideoElement, videoTargetVersion, resumeInlineMirror]);

  useEffect(() => {
    if (!currentMediaId) {
      audioRef.current?.pause();
    }
  }, [currentMediaId]);

  useEffect(() => {
    applyVideoMuted();
  }, [isMuted, mediaType, videoTargetVersion, applyVideoMuted]);

  useEffect(() => {
    if (mediaType !== 'audio') return;
    applyAudioPlaybackSettings();
  }, [
    mediaType,
    currentMediaId,
    volume,
    playbackSpeed,
    applyAudioPlaybackSettings,
  ]);

  useEffect(() => {
    if (mediaType !== 'video') return;
    clearVideoAudio();
  }, [mediaType, currentMediaId, isPlaying, clearVideoAudio]);

  useEffect(() => {
    if (mediaType !== 'video' || !isPlayingRef.current) return;

    const video = getVideoElement();
    if (!video || !video.paused || video.ended) return;

    pauseUnmanagedVideos();
    void video.play().catch(() => {});
  }, [
    mediaType,
    isPlaying,
    getVideoElement,
    videoTargetVersion,
    currentMediaId,
    pauseUnmanagedVideos,
  ]);

  useEffect(() => {
    if (mediaType !== 'video') return;

    const pip = pipVideoRef.current;
    if (!pip) return;

    const handleEnded = () => {
      if (endedHandledRef.current) return;
      endedHandledRef.current = true;
      void playNext();
    };

    const onPlay = () => {
      setPlayingState(true);
      pauseUnmanagedVideos();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    };

    const onPause = () => {
      setPlayingState(false);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    };

    const onPlaying = () => {
      if (!('mediaSession' in navigator)) return;
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        void playPrev();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        void playNext();
      });
    };

    pip.addEventListener('play', onPlay);
    pip.addEventListener('pause', onPause);
    pip.addEventListener('ended', handleEnded);
    pip.addEventListener('playing', onPlaying);

    return () => {
      pip.removeEventListener('play', onPlay);
      pip.removeEventListener('pause', onPause);
      pip.removeEventListener('ended', handleEnded);
      pip.removeEventListener('playing', onPlaying);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      }
    };
  }, [
    playPrev,
    playNext,
    videoTargetVersion,
    mediaType,
    currentMediaId,
    setPlayingState,
    pauseUnmanagedVideos,
  ]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || mediaType !== 'audio') return;

    const onPlay = () => {
      setPlayingState(true);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    };
    const onPause = () => {
      setPlayingState(false);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    };
    const onEnded = () => {
      if (endedHandledRef.current) return;
      endedHandledRef.current = true;
      void playNext();
    };
    const onPlaying = () => {
      if (!('mediaSession' in navigator)) return;
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        void playPrev();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        void playNext();
      });
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('playing', onPlaying);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('playing', onPlaying);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      }
    };
  }, [
    playPrev,
    playNext,
    mediaType,
    currentMediaId,
    setPlayingState,
  ]);

  const currentAudioId = mediaType === 'audio' ? currentMediaId : null;

  const showVideoPiP =
    mediaType === 'video' &&
    currentMediaId != null &&
    (!hasInlineVideo || !inlineVideoVisible);

  const value = useMemo(
    () => ({
      coverUrl,
      playlist,
      setPlaylist,
      currentChatId,
      mediaType,
      currentMediaId,
      currentAudioId,
      isMuted,
      volume,
      setVolume,
      toggleVolumeMute,
      canChangeVolume,
      playbackSpeed,
      cyclePlaybackSpeed,
      togglePlay,
      playPrev,
      playNext,
      isPlaying,
      setCurrentAudioId,
      closeMedia,
      setCoverUrl,
      currentTime,
      duration,
      setCurrentTime,
      setScrubbing,
      setMuted: setIsMuted,
      registerInlineVideo,
      registerPipVideo,
      detachInlineVideo,
      setInlineVideoVisible,
      showVideoPiP,
      setVideoResumeTime,
      audioRef,
      getVideoElement,
      videoTargetVersion,
    }),
    [
      coverUrl,
      playlist,
      setPlaylist,
      currentChatId,
      mediaType,
      currentMediaId,
      currentAudioId,
      isMuted,
      volume,
      setVolume,
      toggleVolumeMute,
      canChangeVolume,
      playbackSpeed,
      cyclePlaybackSpeed,
      togglePlay,
      playPrev,
      playNext,
      isPlaying,
      setCurrentAudioId,
      closeMedia,
      setCoverUrl,
      currentTime,
      duration,
      setCurrentTime,
      setScrubbing,
      registerInlineVideo,
      registerPipVideo,
      detachInlineVideo,
      setInlineVideoVisible,
      showVideoPiP,
      setVideoResumeTime,
      audioRef,
      getVideoElement,
      videoTargetVersion,
    ],
  );

  return (
    <AudioContext.Provider value={value}>
      <audio ref={audioRef} preload='metadata' />
      <MediaVideoPiP />
      {children}
    </AudioContext.Provider>
  );
};

export default AudioProvider;
