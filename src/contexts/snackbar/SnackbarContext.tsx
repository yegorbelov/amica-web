import React, { useState, useCallback, useRef, useMemo } from 'react';
import Snackbar from '@/components/Snackbar/Snackbar';
import { SnackbarContext } from './SnackbarContextCore';
import type { SnackbarType } from './SnackbarContextCore';

export const SnackbarProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [snackbar, setSnackbar] = useState<SnackbarType>(null);
  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissSnackbar = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setOpen(false);
  }, []);

  const showSnackbar = useCallback(
    (
      message: string,
      options?: {
        duration?: number;
        actionLabel?: string;
        onAction?: () => void;
      },
    ) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const duration = options?.duration ?? 5000;
      setShowKey((k) => k + 1);
      setSnackbar({
        message,
        actionLabel: options?.actionLabel,
        onAction: options?.onAction,
        duration,
      });
      setOpen(true);

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setOpen(false);
      }, duration);
    },
    [],
  );

  const handleExited = () => {
    setSnackbar(null);
  };

  const value = useMemo(
    () => ({ showSnackbar, dismissSnackbar }),
    [showSnackbar, dismissSnackbar],
  );

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {snackbar && (
        <Snackbar
          key={showKey}
          message={snackbar.message}
          actionLabel={snackbar.actionLabel}
          duration={snackbar.duration ?? 5000}
          onAction={() => {
            snackbar.onAction?.();
            dismissSnackbar();
          }}
          open={open}
          onExited={handleExited}
        />
      )}
    </SnackbarContext.Provider>
  );
};
