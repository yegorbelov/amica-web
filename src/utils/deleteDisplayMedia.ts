import { apiFetch, apiJson } from '@/utils/apiFetch';
import type { DisplayMedia } from '@/types';

export async function setDisplayMediaAsPrimary(
  mediaId: string | number,
): Promise<DisplayMedia> {
  return apiJson<DisplayMedia>(
    `/api/media_files/primary-media/${encodeURIComponent(String(mediaId))}/set_primary/`,
    { method: 'POST' },
  );
}

export async function deleteDisplayMediaById(
  mediaId: string | number,
): Promise<void> {
  const res = await apiFetch(
    `/api/media_files/primary-media/${encodeURIComponent(String(mediaId))}/`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
}
