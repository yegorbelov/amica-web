import { createContext, useContext } from 'react';

export type SnackbarType = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
} | null;

export type SnackbarContextType = {
  showSnackbar: (
    message: string,
    options?: {
      duration?: number;
      actionLabel?: string;
      onAction?: () => void;
    },
  ) => void;
  dismissSnackbar: () => void;
};

export const SnackbarContext = createContext<SnackbarContextType | null>(null);

export const useSnackbar = () => {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used inside SnackbarProvider');
  }
  return context;
};
