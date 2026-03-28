import { createContext, useContext } from 'react';
import type {
  SettingsContextValue,
  SettingsStateValue,
  SettingsActionsValue,
  SettingsLiveValue,
} from './types';

export const SettingsStateContext = createContext<SettingsStateValue | null>(
  null,
);
export const SettingsActionsContext =
  createContext<SettingsActionsValue | null>(null);

export const SettingsLiveContext = createContext<SettingsLiveValue | null>(
  null,
);

export function useSettingsState(): SettingsStateValue {
  const ctx = useContext(SettingsStateContext);
  if (!ctx)
    throw new Error('useSettingsState must be used within SettingsProvider');
  return ctx;
}

export function useSettingsActions(): SettingsActionsValue {
  const ctx = useContext(SettingsActionsContext);
  if (!ctx)
    throw new Error('useSettingsActions must be used within SettingsProvider');
  return ctx;
}

export function useSettingsLive(): SettingsLiveValue {
  const ctx = useContext(SettingsLiveContext);
  if (!ctx)
    throw new Error('useSettingsLive must be used within SettingsProvider');
  return ctx;
}

/** @deprecated Prefer useSettingsLive — same slice, kept for call sites. */
export function useBlur(): Pick<SettingsLiveValue, 'blur' | 'setBlur'> {
  const { blur, setBlur } = useSettingsLive();
  return { blur, setBlur };
}

export function useSettings(): SettingsContextValue {
  const state = useSettingsState();
  const actions = useSettingsActions();
  return { ...state, ...actions };
}
