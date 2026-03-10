import { createContext, useContext } from 'react';

export type ToastType = {
  message: string;
} | null;

export type ToastContextType = {
  showToast: (message: string, duration?: number) => void;
};

export const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return context;
};
