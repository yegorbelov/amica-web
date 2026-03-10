import React from 'react';
import { UserProvider } from '../contexts/UserContext';
import { MessagesProvider } from '../contexts/MessagesContext';
import { ChatProvider } from '../contexts/ChatContext';
import { AudioProvider } from '../contexts/AudioContext.tsx';
import { AuthProvider } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { SettingsProvider } from '@/contexts/settings/Settings';
import { SearchProvider } from '@/contexts/search/SearchContext';
import { JumpProvider } from '@/contexts/JumpContext';
import { ToastProvider } from '@/contexts/toast/ToastContext';
import { SnackbarProvider } from '@/contexts/snackbar/SnackbarContext';

import { PageStackProvider } from '@/contexts/useStackHistory';
import { searchGlobal } from './searchGlobal';

interface AppProvidersProps {
  children: React.ReactNode;
}

type ProviderProps = { children: React.ReactNode };

const composeProviders = (
  ...providers: React.ComponentType<ProviderProps>[]
) => {
  return ({ children }: ProviderProps) =>
    providers.reduceRight(
      (acc, Provider) => <Provider>{acc}</Provider>,
      children,
    );
};

const GlobalSearchProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <SearchProvider searchFn={searchGlobal}>{children}</SearchProvider>;

const AppProvidersComponent = composeProviders(
  ToastProvider,
  SnackbarProvider,
  PageStackProvider,
  AuthProvider,
  UserProvider,
  LanguageProvider,
  SettingsProvider,
  GlobalSearchProvider,
  ChatProvider,
  MessagesProvider,
  AudioProvider,
  JumpProvider,
);

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return <AppProvidersComponent>{children}</AppProvidersComponent>;
};
