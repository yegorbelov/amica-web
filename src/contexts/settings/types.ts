export type WallpaperType = 'photo' | 'video' | string;

export interface GradientSuggested {
  name: string;
  degree: string;
  colors: {
    color: string;
    stop: string;
  }[];
}

export type WallpaperSetting = {
  id: number | string | null;
  url: string | null;
  type?: WallpaperType;
  blur?: number;
};

export type ActiveWallpaperEditMode =
  | 'natural'
  | 'black-and-white'
  | 'colour-wash';

export type Settings = {
  language: string;
  theme: 'light' | 'dark' | 'system';
  timeFormat: '12h' | '24h' | 'auto';
  wallpapers: WallpaperSetting[];
  activeWallpaper?: WallpaperSetting | null;
  activeWallpaperEditMode?: ActiveWallpaperEditMode;
  useBackgroundThroughoutTheApp: boolean;
  wallpaperGlowEnabled: boolean;
};

export type SubTab =
  | 'account'
  | 'language'
  | 'privacy'
  | 'notifications'
  | 'appearance'
  | 'active_sessions'
  | null;

export interface SettingsStateValue {
  settings: Settings;
  loading: boolean;
  activeProfileTab: SubTab;
  profilePageStack: SubTab[];
  autoplayVideos: boolean;
  settingsFullWindow: boolean;
  isResizingPermitted: boolean;
  color: string;
  gradient: GradientSuggested | null;
  keyboardHeight: number;
  wideScreenModeEnabled: boolean;
}

export interface SettingsActionsValue {
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setActiveWallpaper: (wallpaper: WallpaperSetting | null) => void;
  addUserWallpaper: (file: File) => void;
  setActiveProfileTab: (tab: SubTab) => void;
  pushProfilePage: (tab: SubTab) => void;
  popProfilePage: () => void;
  setBlur: (value: number) => void;
  removeWallpaper: (id: string) => void;
  fetchWallpapers: () => Promise<void>;
  setAutoplayVideos: (value: boolean) => void;
  setSettingsFullWindow: (value: boolean) => void;
  setIsResizingPermitted: (value: boolean) => void;
  setColor: (color: string) => void;
  setGradient: (gradient: GradientSuggested | null) => void;
  setWideScreenModeEnabled: (value: boolean) => void;
}

export interface SettingsContextValue
  extends SettingsStateValue, SettingsActionsValue {}
