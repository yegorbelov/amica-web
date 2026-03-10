import React, { useState, useCallback, useRef, useMemo } from 'react';
import Toast from '@/components/Toast/Toast';
import { ToastContext } from './ToastContextCore';
import type { ToastType } from './ToastContextCore';

export const ToastProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [toast, setToast] = useState<ToastType>(null);
  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, duration = 2000) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShowKey((k) => k + 1);
    setToast({ message });
    setOpen(true);

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setOpen(false);
    }, duration);
  }, []);

  const handleExited = () => {
    setToast(null);
  };

  const value = useMemo(
    () => ({ showToast }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Toast
          key={showKey}
          message={toast.message}
          open={open}
          onExited={handleExited}
        />
      )}
    </ToastContext.Provider>
  );
};
