import { apiFetch } from '@/utils/apiFetch';
import { getAccessTokenOrThrow, refreshTokenIfNeeded } from '@/utils/authStore';
import { resolveApiUrl } from '@/utils/resolveApiUrl';

export async function fetchPrivateMedia(url: string) {
  const res = await apiFetch(url);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2] as const;

export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export function checkVolumeSupport(audio: HTMLAudioElement) {
  if (
    !('volume' in audio) ||
    audio.volume === undefined ||
    audio.volume === null
  ) {
    return false;
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) return false;

  const original = audio.volume;
  audio.volume = 0;
  const canMute = audio.volume === 0;
  audio.volume = original;

  return canMute;
}

export function getVolumeIconName(volume: number) {
  if (volume === 0) return 'SoundMuteFill' as const;
  if (volume < 0.5) return 'SoundMinFill' as const;
  return 'SoundMaxFill' as const;
}

export async function getSignedMediaUrl(url: string): Promise<string> {
  const base = resolveApiUrl(url);
  if (!base) return '';
  await refreshTokenIfNeeded();
  const token = await getAccessTokenOrThrow();
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}token=${encodeURIComponent(token)}`;
}
