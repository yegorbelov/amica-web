import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import type {
  Settings,
  WallpaperSetting,
  SubTab,
  WallpaperType,
  GradientSuggested,
  SettingsStateValue,
  SettingsActionsValue,
} from './types';
import {
  websocketManager,
  type WebSocketMessage,
} from '@/utils/websocket-manager';
import { apiUpload, apiFetch } from '@/utils/apiFetch';
import {
  SettingsStateContext,
  SettingsActionsContext,
  BlurContext,
  useSettingsActions,
} from './context';
import { useUser } from '../UserContextCore';
import { getLastUserId } from '@/utils/chatStateStorage';

const STORAGE_KEY_PREFIX = 'app-settings';
const SAVE_DEBOUNCE_MS = 400;
const BLUR_SAVE_DEBOUNCE_MS = 300;

type StoredSettings = Partial<
  Settings & {
    autoplayVideos?: boolean;
    settingsFullWindow?: boolean;
    color?: string;
    gradient?: GradientSuggested;
  }
>;

function getSettingsStorageKey(userId: number | null | undefined): string {
  return userId != null
    ? `${STORAGE_KEY_PREFIX}-${userId}`
    : STORAGE_KEY_PREFIX;
}

function parseStoredSettings(storageKey: string): StoredSettings {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return {};
    return JSON.parse(saved) as StoredSettings;
  } catch (e) {
    console.error('Failed to parse settings', e);
    return {};
  }
}

function mergeWallpapers(
  defaults: WallpaperSetting[],
  custom: WallpaperSetting[] | undefined,
): WallpaperSetting[] {
  if (!custom?.length) return [...defaults];
  return [
    ...defaults.filter(
      (df) => !custom.some((w: WallpaperSetting) => w.id === df.id),
    ),
    ...custom,
  ];
}

const defaultWallpapers: WallpaperSetting[] = [
  {
    id: 'default-0',
    url: '../DefaultWallpapers/abdelhamid-azoui-Zhl3nrozkG0-unsplash.jpg.webp',
    type: 'photo',
  },
  {
    id: 'default-1',
    url: '../DefaultWallpapers/syuhei-inoue-fvgv3i4_uvI-unsplash.jpg.webp',
    type: 'photo',
  },
  {
    id: 'default-2',
    url: '../DefaultWallpapers/dave-hoefler-PEkfSAxeplg-unsplash.jpg.webp',
    type: 'photo',
  },
  {
    id: 'default-3',
    url: '../DefaultWallpapers/video/blue-sky-seen-directly-with-some-clouds_480p_infinity.webm',
    type: 'video',
  },
  {
    id: 'default-4',
    url: '../DefaultWallpapers/video/ocean.webm',
    type: 'video',
  },
  {
    id: 'default-5',
    url: '../DefaultWallpapers/video/dusk_sunset.webm',
    type: 'video',
  },
  {
    id: 'default-6',
    url: '../DefaultWallpapers/video/deep_blue_sky.webm',
    type: 'video',
  },
  // {
  //   id: 'default-7',
  //   url: '../DefaultWallpapers/video/waterfall.webm',
  //   type: 'video',
  // },
];

const defaultSettings: Settings = {
  language: navigator.language || 'en-US',
  theme: 'system',
  timeFormat: 'auto',
  wallpapers: defaultWallpapers,
  activeWallpaper: defaultWallpapers[0],
  activeWallpaperEditMode: 'natural',
  useBackgroundThroughoutTheApp: false,
  wallpaperGlowEnabled: true,
};

/** Syncs active wallpaper from user (general_info) into settings when it arrives. */
function SyncWallpaperFromUser() {
  const { activeWallpaperFromServer } = useUser();
  const { setActiveWallpaper } = useSettingsActions();
  useEffect(() => {
    if (!activeWallpaperFromServer) return;
    setActiveWallpaper({
      id: activeWallpaperFromServer.id,
      url: activeWallpaperFromServer.url,
      type: activeWallpaperFromServer.type ?? 'photo',
      blur: activeWallpaperFromServer.blur ?? 0,
    });
  }, [activeWallpaperFromServer, setActiveWallpaper]);
  return null;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const storageKey = useMemo(
    () => getSettingsStorageKey(user?.id ?? getLastUserId()),
    [user?.id],
  );
  const initialParsed = useMemo(
    () => parseStoredSettings(storageKey),
    [storageKey],
  );

  const [isResizingPermitted, setIsResizingPermitted] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!window.visualViewport) return;

    let rafId: number | null = null;
    let lastHeight = -1;

    const handleKeyboardHeight = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const { height, offsetTop } = window.visualViewport;
        const keyboard = window.innerHeight - height - offsetTop;
        const safeHeight = keyboard > 0 ? keyboard : 0;
        document.documentElement.style.setProperty(
          '--keyboard-height',
          `${safeHeight}px`,
        );
        if (safeHeight !== lastHeight) {
          lastHeight = safeHeight;
          setKeyboardHeight(safeHeight);
        }
      });
    };

    const initialHeight =
      window.innerHeight -
      window.visualViewport.height -
      window.visualViewport.offsetTop;
    const initialSafe = initialHeight > 0 ? initialHeight : 0;
    lastHeight = initialSafe;
    setKeyboardHeight(initialSafe);
    document.documentElement.style.setProperty(
      '--keyboard-height',
      `${initialSafe}px`,
    );

    window.visualViewport.addEventListener('resize', handleKeyboardHeight);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.visualViewport.removeEventListener('resize', handleKeyboardHeight);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsResizingPermitted(true);
      } else {
        setIsResizingPermitted(false);
        setSettingsFullWindow(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [settingsFullWindow, setSettingsFullWindow] = useState<boolean>(
    initialParsed.settingsFullWindow ?? false,
  );
  const [autoplayVideos, setAutoplayVideos] = useState<boolean>(
    initialParsed.autoplayVideos ?? false,
  );

  const [settings, setSettings] = useState<Settings>(() => {
    const combinedWallpapers = mergeWallpapers(
      defaultWallpapers,
      initialParsed.wallpapers,
    );
    const activeWallpaper =
      initialParsed.activeWallpaper === null
        ? null
        : initialParsed.activeWallpaper &&
            typeof initialParsed.activeWallpaper === 'object'
          ? (initialParsed.activeWallpaper as WallpaperSetting)
          : defaultWallpapers[0];

    return {
      ...defaultSettings,
      ...initialParsed,
      wallpapers: combinedWallpapers,
      activeWallpaper,
      activeWallpaperEditMode:
        initialParsed.activeWallpaperEditMode ??
        defaultSettings.activeWallpaperEditMode,
      wallpaperGlowEnabled:
        initialParsed.wallpaperGlowEnabled ??
        defaultSettings.wallpaperGlowEnabled,
    };
  });

  const [color, setColor] = useState<string>(initialParsed.color ?? '#2c77d1');
  const [gradient, setGradient] = useState<GradientSuggested | null>(
    initialParsed.gradient ?? null,
  );

  useEffect(() => {
    document.documentElement.style.setProperty('--mainColor', color);
  }, [color]);

  useEffect(() => {
    const degree = gradient?.degree ?? '168deg';
    document.documentElement.style.setProperty(
      '--messageGradientDegree',
      degree,
    );

    if (gradient?.colors?.length) {
      const colors = gradient.colors;
      const lastColor = colors[colors.length - 1].color;
      const lastStop = colors[colors.length - 1].stop;

      for (let i = 0; i < 5; i++) {
        const c = colors[i];
        document.documentElement.style.setProperty(
          `--messageColor${i + 1}`,
          c ? c.color : lastColor,
        );
        document.documentElement.style.setProperty(
          `--messageStop${i + 1}`,
          c ? c.stop : lastStop || '100%',
        );
      }
    } else {
      for (let i = 1; i <= 5; i++) {
        document.documentElement.style.setProperty(`--messageColor${i}`, color);
        document.documentElement.style.setProperty(
          `--messageStop${i}`,
          i === 1 ? '0%' : '100%',
        );
      }
    }
  }, [gradient, color]);

  const [loading, setLoading] = useState(true);
  const [profilePageStack, setProfilePageStack] = useState<SubTab[]>([]);
  const activeProfileTab: SubTab =
    profilePageStack.length > 0
      ? profilePageStack[profilePageStack.length - 1]
      : null;

  const pushProfilePage = useCallback((tab: SubTab) => {
    setProfilePageStack((prev) => [...prev, tab]);
  }, []);

  const popProfilePage = useCallback(() => {
    setProfilePageStack((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  }, []);

  const setActiveProfileTab = useCallback((tab: SubTab) => {
    if (tab === null) {
      setProfilePageStack((prev) =>
        prev.length > 0 ? prev.slice(0, -1) : prev,
      );
    } else {
      setProfilePageStack([tab]);
    }
  }, []);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [blur, setBlurState] = useState(0);

  useEffect(() => {
    setBlurState(settings.activeWallpaper?.blur ?? 0);
  }, [settings.activeWallpaper?.id, settings.activeWallpaper?.blur]);

  useEffect(() => {
    return () => {
      if (blurPersistTimeoutRef.current) {
        clearTimeout(blurPersistTimeoutRef.current);
        blurPersistTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      const { ...rest } = settings;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...rest,
          autoplayVideos,
          color,
          gradient,
        }),
      );
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      const { ...rest } = settings;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...rest,
          autoplayVideos,
          color,
          gradient,
        }),
      );
    };
  }, [settings, autoplayVideos, color, gradient, storageKey]);

  const setSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) =>
      setSettings((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const setBlur = useCallback((value: number) => {
    setBlurState(value);
    if (blurPersistTimeoutRef.current)
      clearTimeout(blurPersistTimeoutRef.current);
    blurPersistTimeoutRef.current = setTimeout(() => {
      blurPersistTimeoutRef.current = null;
      setSettings((prev: Settings) => {
        if (prev.activeWallpaper == null) return prev;
        return {
          ...prev,
          activeWallpaper: {
            ...prev.activeWallpaper,
            blur: value,
          },
        } as Settings;
      });
    }, BLUR_SAVE_DEBOUNCE_MS);
  }, []);

  const setActiveWallpaper = useCallback(
    (wallpaper: WallpaperSetting | null) => {
      setSettings((prev) => {
        if (wallpaper === null) {
          if (prev.activeWallpaper === null) return prev;
          websocketManager.sendMessage({
            type: 'set_active_wallpaper',
            data: { id: null },
          });
          return { ...prev, activeWallpaper: null };
        }

        let wallpaperData: WallpaperSetting;

        if (!('url' in wallpaper) || !wallpaper.url) {
          const defaultWall = defaultWallpapers.find(
            (w) => w.id === wallpaper.id,
          );
          if (!defaultWall) return prev;
          wallpaperData = { ...defaultWall };
        } else {
          wallpaperData = { ...wallpaper };
        }

        if (prev.activeWallpaper?.id === wallpaperData.id) {
          return prev;
        }

        websocketManager.sendMessage({
          type: 'set_active_wallpaper',
          data: { id: wallpaperData.id },
        });

        const wallpapers = prev.wallpapers?.some(
          (w) => w.id === wallpaperData.id,
        )
          ? prev.wallpapers
          : [...(prev.wallpapers || []), wallpaperData];

        return {
          ...prev,
          wallpapers,
          activeWallpaper: wallpaperData,
        };
      });
    },
    [],
  );

  const removeWallpaper = useCallback((id: string) => {
    websocketManager.sendMessage({
      type: 'delete_user_wallpaper',
      data: { id },
    });
  }, []);

  const fetchWallpapers = useCallback(async () => {
    try {
      const res = await apiFetch('/api/wallpapers/');
      const data = await res.json();
      const apiWallpapers = Array.isArray(data) ? data : data.wallpapers || [];
      const combinedWallpapers = mergeWallpapers(
        defaultWallpapers,
        apiWallpapers,
      );
      setSettings((prev) => ({
        ...prev,
        wallpapers: combinedWallpapers,
      }));
    } catch (err) {
      console.error('Failed to fetch wallpapers', err);
      setSettings((prev) => ({ ...prev, wallpapers: defaultWallpapers }));
    } finally {
      setLoading(false);
    }
  }, []);

  const addUserWallpaper = useCallback(async (wallpaper: File) => {
    try {
      const formData = new FormData();
      formData.append('file', wallpaper);

      await apiUpload('/api/wallpapers/', formData);
    } catch (error) {
      console.error('addUserWallpaper error:', error);
    }
  }, []);

  const handleWSMessage = useCallback(
    (data: WebSocketMessage) => {
      if (!data.type) return;

      if (data.type === 'active_wallpaper_updated') {
        if (data.data == null || data.data.id == null) {
          setActiveWallpaper(null);
        } else {
          const wallpaperData: WallpaperSetting = {
            id: data.data.id as string | number,
            type: data.data?.type as WallpaperType | undefined,
            url: data.data?.url as string | null,
          };
          setActiveWallpaper(wallpaperData);
        }
      }

      if (data.type === 'user_wallpaper_deleted') {
        const wallpaperId = data?.id;
        setSettings((prev) => ({
          ...prev,
          wallpapers: (prev.wallpapers || []).filter(
            (w) => w.id !== wallpaperId,
          ),
          activeWallpaper:
            prev.activeWallpaper?.id === wallpaperId
              ? null
              : prev.activeWallpaper,
        }));
      }

      if (data.type === 'user_wallpaper_added') {
        const wallpaperData: WallpaperSetting = {
          id: data.data.id,
          type: data.data.type,
          url: data.data.url,
          blur: 0,
        };
        setSettings((prev) => ({
          ...prev,
          wallpapers: prev.wallpapers?.some((w) => w.id === wallpaperData.id)
            ? prev.wallpapers
            : [...(prev.wallpapers || []), wallpaperData],
        }));
      }
    },
    [setActiveWallpaper],
  );

  useEffect(() => {
    websocketManager.on('message', handleWSMessage);
    if (!websocketManager.isConnected()) {
      websocketManager.connect();
    }
    return () => websocketManager.off('message', handleWSMessage);
  }, [handleWSMessage]);

  const stateValue = useMemo<SettingsStateValue>(
    () => ({
      settings,
      loading,
      activeProfileTab,
      profilePageStack,
      autoplayVideos,
      settingsFullWindow,
      isResizingPermitted,
      color,
      gradient,
      keyboardHeight,
    }),
    [
      settings,
      loading,
      activeProfileTab,
      profilePageStack,
      autoplayVideos,
      settingsFullWindow,
      isResizingPermitted,
      color,
      gradient,
      keyboardHeight,
    ],
  );

  const actionsValue = useMemo<SettingsActionsValue>(
    () => ({
      setSetting,
      setActiveWallpaper,
      addUserWallpaper,
      setBlur,
      removeWallpaper,
      fetchWallpapers,
      setActiveProfileTab,
      pushProfilePage,
      popProfilePage,
      setAutoplayVideos,
      setSettingsFullWindow,
      setIsResizingPermitted,
      setColor,
      setGradient,
    }),
    [
      addUserWallpaper,
      fetchWallpapers,
      removeWallpaper,
      setActiveWallpaper,
      setBlur,
      setSetting,
      setActiveProfileTab,
      pushProfilePage,
      popProfilePage,
    ],
  );

  const blurValue = useMemo(() => ({ blur, setBlur }), [blur, setBlur]);

  return (
    <SettingsActionsContext.Provider value={actionsValue}>
      <SettingsStateContext.Provider value={stateValue}>
        <BlurContext.Provider value={blurValue}>
          <SyncWallpaperFromUser />
          {children}
        </BlurContext.Provider>
      </SettingsStateContext.Provider>
    </SettingsActionsContext.Provider>
  );
}
