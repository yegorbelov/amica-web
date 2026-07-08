import { createContext, useContext } from 'react';
import type { User } from '@/types';
import type { WallpaperSetting } from './settings/types';

export interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
  activeWallpaperFromServer?: WallpaperSetting | null;
}

export interface ApiResponse {
  access: string;
  user: User;
  refresh?: string;
}

export type LoginPasswordOutcome =
  | 'session'
  | 'deferred'
  | 'needs_totp'
  | 'invalid_totp'
  | 'invalid_backup_code'
  | 'email_not_verified';

export type SecondFactorSubmission =
  | { kind: 'totp'; code: string }
  | { kind: 'backup'; code: string };

export interface UserContextType extends UserState {
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
  loginWithPassword: (
    username: string,
    password: string,
    secondFactor?: SecondFactorSubmission,
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
  loginWithGoogle: (
    idToken: string,
    secondFactor?: SecondFactorSubmission,
  ) => Promise<
    'success' | 'totp_required' | 'invalid_totp' | 'invalid_backup_code'
  >;
  loginWithPasskey: (passkeyData: unknown) => Promise<'success'>;
  pendingTotpSecondFactor: { kind: 'google'; accessToken: string } | null;
  submitTotpSecondFactor: (
    kind: 'totp' | 'backup',
    value: string,
  ) => Promise<boolean>;
  dismissPendingTotpSecondFactor: () => void;
  passwordLoginNeedsTotp: boolean;
  dismissPasswordLoginTotp: () => void;
  logout: () => Promise<void>;
  dismissAuthError: () => void;
  pendingDeviceLogin: {
    challengeId: string;
    trustedDeviceLabel?: string;
    delivery?: 'trusted_device' | 'email';
  } | null;
  dismissPendingDeviceLogin: () => void;
  applyDeviceChallenge: (r: {
    challenge_id: string;
    trusted_device?: string;
    delivery?: 'trusted_device' | 'email';
  }) => void;
  pendingBackupCodes: string[] | null;
  dismissPendingBackupCodes: () => void;
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
