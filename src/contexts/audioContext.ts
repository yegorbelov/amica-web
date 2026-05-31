import { createContext, useContext } from 'react';
import type { File } from '@/types';

export type MediaType = 'audio' | 'video';

export interface AudioContextType {
  currentChatId: number | null;
  coverUrl: string | null;
  playlist: File[] | null;
  mediaType: MediaType | null;
  currentMediaId: number | null;
  /** @deprecated use currentMediaId with mediaType === 'audio' */
  currentAudioId: number | null;
  isMuted: boolean;
  volume: number;
  setVolume: (volume: number) => void;
  toggleVolumeMute: () => void;
  canChangeVolume: boolean;
  playbackSpeed: number;
  cyclePlaybackSpeed: () => void;
  setPlaylist: (
    playlist: File[] | null,
    currentChatId: number | null,
    opts?: {
      autoPlayId?: number | null;
      coverUrl?: string | null;
      mediaType?: MediaType;
    },
  ) => void;
  togglePlay: (mediaId: number, opts?: { coverUrl?: string | null }) => void;
  playPrev: () => void;
  playNext: () => void;
  isPlaying: boolean;
  setCurrentAudioId: (currentAudioId: number | null) => void;
  closeMedia: () => void;
  setCoverUrl: (coverUrl: string | null) => void;
  currentTime: number;
  duration: number;
  setCurrentTime: (
    currentTime: number,
    opts?: { mediaType?: MediaType; mediaId?: number | null },
  ) => void;
  setScrubbing: (scrubbing: boolean) => void;
  setMuted: (muted: boolean) => void;
  registerInlineVideo: (
    element: HTMLVideoElement | null,
    fileId?: number,
  ) => void;
  registerPipVideo: (element: HTMLVideoElement | null) => void;
  detachInlineVideo: () => void;
  setInlineVideoVisible: (visible: boolean) => void;
  showVideoPiP: boolean;
  setVideoResumeTime: (time: number) => void;
  audioRef: React.RefObject<HTMLAudioElement> | null;
  getVideoElement: () => HTMLVideoElement | null;
  videoTargetVersion: number;
}

export const AudioContext = createContext<AudioContextType | undefined>(
  undefined,
);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context)
    throw new Error('useAudio must be used within an AudioProvider');
  return context;
};
