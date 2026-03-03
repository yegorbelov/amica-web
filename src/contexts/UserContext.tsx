import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { apiJson, setApiFetchUnauthorizedHandler } from '../utils/apiFetch';
import {
  setAccessToken,
  logout as authLogout,
  initAuth,
  getAccessToken,
  refreshTokenIfNeeded,
  setCustomRefreshTokenFn,
  setRefreshCookie,
} from '../utils/authStore';
import {
  websocketManager,
  type WebSocketMessage,
} from '@/utils/websocket-manager';
import type { DisplayMedia, User } from '@/types';
import { useSettingsActions } from './settings/context';
import type { WallpaperSetting } from './settings/types';
import { UserContext, postJson } from './UserContextCore';
import type { UserState, ApiResponse } from './UserContextCore';
import type { File as FileType } from '@/types';
import { setLastUserId, getLastUserId, deleteChatState } from '@/utils/chatStateStorage';

const USER_CACHE_KEY = 'amica-user-cache';

function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function setCachedUser(user: User | null): void {
  if (user === null) {
    localStorage.removeItem(USER_CACHE_KEY);
    return;
  }
  try {
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    localStorage.removeItem(USER_CACHE_KEY);
  }
}

/** Placeholder so we can render the app before WS connects; replaced by fetchUser(). */
function getPlaceholderUser(): User {
  return {
    id: 0,
    email: '',
    username: '',
    profile: {
      id: 0,
      last_seen: null,
      bio: null,
      phone: null,
      date_of_birth: null,
      location: null,
      primary_media: { id: '0', type: 'photo' },
      media: [],
    },
    preferred_session_lifetime_days: 0,
    last_seen: null,
  };
}

export const UserProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<UserState>({
    user: null,
    loading: true,
    error: null,
  });
  const { setActiveWallpaper } = useSettingsActions();

  const fetchUser = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      loading: !prev.user || prev.user.id === 0,
      error: null,
    }));

    const applyGeneralInfo = (data: {
      user?: User;
      active_wallpaper?: WallpaperSetting;
      success?: boolean;
      error?: string;
    }) => {
      if (data.success && data.user) {
        setCachedUser(data.user);
        if (data.active_wallpaper) {
          setActiveWallpaper({
            id: data.active_wallpaper.id,
            url: data.active_wallpaper.url,
            type: data.active_wallpaper.type,
            blur: 0,
          });
        }
        setState((prev) => {
          if (
            prev.user &&
            prev.user.id !== 0 &&
            prev.user.id === data.user!.id
          ) {
            return { ...prev, loading: false };
          }
          return { user: data.user!, loading: false, error: null };
        });
      } else {
        setCachedUser(null);
        setState({
          user: null,
          loading: false,
          error: data.error ?? 'Failed to load user',
        });
      }
    };

    if (websocketManager.isConnected()) {
      const timeoutId = window.setTimeout(() => {
        setState((prev) => (prev.loading ? { ...prev, loading: false } : prev));
      }, 15000);

      const handleGeneralInfo = (
        msg: WebSocketMessage & {
          success?: boolean;
          user?: unknown;
          active_wallpaper?: WallpaperSetting;
          error?: string;
        },
      ) => {
        if (msg.type !== 'general_info') return;
        window.clearTimeout(timeoutId);
        applyGeneralInfo({
          success: msg.success,
          user: msg.user as User | undefined,
          active_wallpaper: msg.active_wallpaper,
          error: msg.error,
        });
        websocketManager.off('general_info', handleGeneralInfo);
        websocketManager.off('message', handleError);
      };

      const handleError = (msg: WebSocketMessage) => {
        if (msg.type === 'error') {
          window.clearTimeout(timeoutId);
          setCachedUser(null);
          setState({
            user: null,
            loading: false,
            error: msg.message ?? 'Unknown error',
          });
          websocketManager.off('general_info', handleGeneralInfo);
          websocketManager.off('message', handleError);
        }
      };

      websocketManager.on('general_info', handleGeneralInfo);
      websocketManager.on('message', handleError);
      websocketManager.sendMessage({ type: 'get_general_info' });
      return;
    }

    websocketManager.connect();
  }, [setActiveWallpaper]);

  useEffect(() => {
    setApiFetchUnauthorizedHandler(() => {
      setCachedUser(null);
      setState({ user: null, loading: false, error: null });
    });

    setCustomRefreshTokenFn(async () => {
      if (getAccessToken() === null) {
        await websocketManager.waitForConnection();
        return;
      }
      if (websocketManager.isConnected()) {
        const access = await websocketManager.requestRefreshToken();
        setAccessToken(access);
        return;
      }
      await websocketManager.waitForConnection();
      const access = await websocketManager.requestRefreshToken();
      setAccessToken(access);
    });

    initAuth();

    const handleConnectionEstablished = () => {
      fetchUser().catch(() => {});
    };

    websocketManager.on('connection_established', handleConnectionEstablished);

    // Start WebSocket immediately so it isn't stalled behind refresh_token request
    websocketManager.connect();

    (async () => {
      const cachedUser = getCachedUser();
      if (cachedUser) {
        setState({ user: cachedUser, loading: false, error: null });
        if (!websocketManager.isConnected()) {
          websocketManager.connect();
        } else {
          fetchUser().catch(() => {});
        }
        refreshTokenIfNeeded()
          .then(() => {})
          .catch(() => {
            setCachedUser(null);
            setState({ user: null, loading: false, error: null });
          });
        return;
      }

      setState({ user: null, loading: false, error: null });
      try {
        await refreshTokenIfNeeded();
      } catch {
        return;
      }
      if (!getAccessToken()) return;
      if (websocketManager.isConnected()) {
        fetchUser().catch(() => {});
        return;
      }
      setState({
        user: getPlaceholderUser(),
        loading: false,
        error: null,
      });
      websocketManager.connect();
    })();

    const handler = (msg: WebSocketMessage) => {
      if (msg.type === 'file_uploaded' && msg.data) {
        const userId = Number(msg.data.object_id);
        const media = msg.data.media as FileType;
        const fileObj: FileType =
          typeof media === 'object' && media !== null
            ? media
            : { id: -1, file_url: String(media) };

        setState((prev: UserState) => {
          if (!prev) return prev;

          const updatedMedia = prev.user.profile.media.map((m: DisplayMedia) =>
            m.id === userId ? { ...m, file_url: fileObj.file_url } : m,
          );

          return {
            ...prev,
            user: {
              ...prev.user,
              profile: {
                ...prev.user.profile,
                media: updatedMedia,
              },
            },
          };
        });
      }
    };

    websocketManager.on('message', handler);
    return () => {
      websocketManager.off('message', handler);
      websocketManager.off(
        'connection_established',
        handleConnectionEstablished,
      );
      setCustomRefreshTokenFn(null);
    };
  }, [fetchUser]);

  const handleLoginSuccess = useCallback(
    (data: ApiResponse) => {
      if (!data.access || !data.user) throw new Error('Invalid response');
      setAccessToken(data.access);
      if (data.refresh) setRefreshCookie(data.refresh);
      setState((prev) => ({
        ...prev,
        user: data.user,
        loading: false,
        error: null,
      }));
      if (websocketManager.isConnected()) {
        fetchUser().catch(() => {});
      } else {
        websocketManager.connect();
      }
    },
    [fetchUser],
  );

  const setUser = useCallback((user: User | null) => {
    setState((prev) => ({ ...prev, user }));
  }, []);

  const loginWithPassword = useCallback(
    async (username: string, password: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const data = await postJson<ApiResponse>('/api/login/', {
          username,
          password,
        });
        handleLoginSuccess({
          access: data.access,
          refresh: data.refresh,
          user: data.user as User,
        });
        if (!websocketManager.isConnected()) {
          websocketManager.connect();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        setState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));
        throw err;
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [handleLoginSuccess],
  );

  const signupWithCredentials = useCallback(
    async (username: string, email: string, password: string) => {
      await websocketManager.waitForConnection();
      const data = await websocketManager.requestSignup(
        username,
        email,
        password,
      );
      setAccessToken(data.access);
      if (data.refresh) setRefreshCookie(data.refresh);
      setState({
        user: data.user as User,
        loading: false,
        error: null,
      });
      if (websocketManager.isConnected()) {
        fetchUser().catch(() => {});
      } else {
        websocketManager.connect();
      }
    },
    [fetchUser],
  );

  const loginWithGoogle = useCallback(
    (idToken: string) =>
      postJson<ApiResponse>('/api/google/', { access_token: idToken }).then(
        handleLoginSuccess,
      ),
    [handleLoginSuccess],
  );

  const loginWithPasskey = useCallback(
    (passkeyData: unknown) =>
      postJson<ApiResponse>('/api/passkey_auth_finish/', passkeyData).then(
        handleLoginSuccess,
      ),
    [handleLoginSuccess],
  );

  const logout = useCallback(async () => {
    const userId = state.user?.id ?? getLastUserId();
    if (userId && userId > 0) {
      deleteChatState(userId).catch(() => {});
    }
    try {
      await apiJson('/api/logout/', { method: 'POST' });
    } finally {
      setCachedUser(null);
      setLastUserId(0);
      authLogout();
      setState({ user: null, loading: false, error: null });
    }
  }, [state.user?.id]);

  const value = useMemo(
    () => ({
      ...state,
      isAuthenticated: !!state.user,
      refreshUser: fetchUser,
      setUser,
      loginWithPassword,
      signupWithCredentials,
      loginWithGoogle,
      loginWithPasskey,
      logout,
    }),
    [
      state,
      fetchUser,
      setUser,
      loginWithPassword,
      signupWithCredentials,
      loginWithGoogle,
      loginWithPasskey,
      logout,
    ],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

UserProvider.displayName = 'UserProvider';
