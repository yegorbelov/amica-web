import { createContext, useContext } from 'react';
import type { User } from '@/types';
import type { WallpaperSetting } from './settings/types';

export interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
  /** Set when general_info returns active_wallpaper; sync to settings in UI. */
  activeWallpaperFromServer?: WallpaperSetting | null;
}

export interface ApiResponse {
  access: string;
  user: User;
  refresh?: string;
}

/** Result of `loginWithPassword` (throws on network/unhandled errors). */
export type LoginPasswordOutcome =
  | 'session'
  | 'deferred'
  | 'needs_totp'
  | 'invalid_totp'
  | 'email_not_verified';

export interface UserContextType extends UserState {
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
  loginWithPassword: (
    username: string,
    password: string,
    backupCode?: string,
    totpCode?: string,
  ) => Promise<LoginPasswordOutcome>;
  signupWithCredentials: (
    username: string,
    email: string,
    password: string,
  ) => Promise<{
    needsEmailVerification: boolean;
    email?: string;
    emailVerificationOtpId?: string;
  }>;
  loginWithGoogle: (idToken: string, totpCode?: string) => Promise<void>;
  loginWithPasskey: (passkeyData: unknown, totpCode?: string) => Promise<void>;
  /** After Google/Passkey returned totp_required, submit the 6-digit code. */
  pendingTotpSecondFactor:
    | { kind: 'google'; accessToken: string }
    | { kind: 'passkey'; body: Record<string, unknown> }
    | null;
  submitTotpSecondFactor: (code: string) => Promise<void>;
  dismissPendingTotpSecondFactor: () => void;
  /** Password login: server asked for authenticator code. */
  passwordLoginNeedsTotp: boolean;
  dismissPasswordLoginTotp: () => void;
  logout: () => Promise<void>;
  /** Clear global auth error (e.g. device-login poll failure) without logging out. */
  dismissAuthError: () => void;
  /** New device: poll until trusted device confirms; trusted device label when known. */
  pendingDeviceLogin: { challengeId: string; trustedDeviceLabel?: string } | null;
  dismissPendingDeviceLogin: () => void;
  /** e.g. passkey register/finish returned needs_device_confirmation */
  applyDeviceChallenge: (r: {
    challenge_id: string;
    trusted_device?: string;
  }) => void;
  /** Shown once after first full session when server issues backup codes */
  pendingBackupCodes: string[] | null;
  dismissPendingBackupCodes: () => void;
  /** Apply 200 JSON from login / verify-email-otp / passkey (access+user or device gates). */
  ingestSuccessfulAuthPayload: (
    data: Record<string, unknown>,
    fallbackMessage?: string,
  ) => 'session' | 'deferred';
}

export const UserContext = createContext<UserContextType | undefined>(
  undefined,
);

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be inside UserProvider');
  return ctx;
};

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}
