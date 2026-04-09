import type { WallpaperSetting } from '@/contexts/settings/types';
import type { MessageReactionSummaryItem } from '@/constants/messageReactions';

export interface File {
  id?: number;
  width?: number;
  height?: number;
  file_url?: string;
  file_type?: string;
  original_name?: string;
  category?: string;
  has_audio?: boolean;
  thumbnail_small_url?: string;
  thumbnail_medium_url?: string;
  dominant_color?: string;
  duration?: number;
  waveform?: number[];
  cover_url?: string;
  file_size?: number;
  extension?: string;
}

export interface Viewer {
  user: User;
  read_date: string;
}

export interface Message {
  id: number;
  value: string;
  edit_date: string | null;
  date: string;
  user: number;
  viewers?: Viewer[];
  liked: number;
  files: File[];
  is_own: boolean;
  is_viewed: boolean;
  is_deleted?: boolean;
  reactions_summary?: MessageReactionSummaryItem[];
  user_reactions?: string[];
  user_reaction?: string | null;
}

export interface Chat {
  id: number;
  name: string | null;
  members: User[];
  /** DM: other participant's user id (from server list); use when members not loaded */
  peer_user_id?: number | null;
  /** Group global search: whether current user is already in the group */
  is_member?: boolean;
  type: 'D' | 'G' | 'C';
  primary_media: DisplayMedia;
  last_message: Message | null;
  unread_count: number;
  info: string;
  media: DisplayMedia[];
}

export interface MediaLayer {
  id: string;
  media: DisplayMedia | null;
}

interface BaseMedia {
  id: string | number;
  createdAt?: Date;
}

export interface PhotoMedia extends BaseMedia {
  type: 'photo';
  small?: string;
  medium?: string;
}

export interface VideoMedia extends BaseMedia {
  type: 'video';
  url: string;
  duration?: number | null;
}

export type DisplayMedia = PhotoMedia | VideoMedia;

export interface UserProfile {
  id: number;
  last_seen: string | null;
  bio: string | null;
  phone: string | null;
  date_of_birth: string | null;
  location: string | null;
  primary_media: DisplayMedia;
  media: DisplayMedia[];
}

export interface User {
  id: number;
  email?: string;
  username?: string;
  profile?: UserProfile;
  preferred_session_lifetime_days?: number;
  active_wallpaper?: WallpaperSetting | null;
  last_seen?: string | null;
  is_contact?: boolean;
  contact_id?: number;
  /** Existing 1:1 chat id with current user (global user search) */
  dm_chat_id?: number | null;
  /** Account has a trusted device fingerprint (new logins may require approval there). */
  has_trusted_device?: boolean;
  /** Time-based one-time password (authenticator app) enabled. */
  totp_enabled?: boolean;
}

export interface Contact {
  id: number;
  /** Underlying user id (for invites, etc.) */
  user_id?: number;
  username: string;
  profile: UserProfile;
  primary_media: DisplayMedia | null;
  name: string;
  email?: string;
  phone?: string;
  chat_id: number;
  last_seen: string | null;
}

export interface Session {
  jti: string;
  ip_address: string;
  device: string;
  user_agent: string;
  created_at: string;
  expires_at: string;
  last_active: string;
  is_current: boolean;
  city: string | null;
  country: string | null;
  /** Session fingerprint matches account trusted device (see Privacy & Security). */
  is_trusted?: boolean;
}
