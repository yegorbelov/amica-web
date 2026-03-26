import React, { useState, useEffect, useCallback, useMemo } from 'react';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import RoomPage from './pages/RoomPage';
import getDeviceCornerRadius from './utils/getDeviceCornerRadius';
import { IconsSprite } from './components/Icons/AutoIcons';
import { useUser } from './contexts/UserContextCore';
import { useSettings } from './contexts/settings/context';

type AppView = 'login' | 'signup';

const StrokeGradientSvg = React.memo(() => (
  <svg
    style={{
      width: '0',
      height: '0',
      position: 'absolute',
      visibility: 'hidden',
    }}
  >
    <defs>
      <linearGradient id='strokeGradient'>
        <stop offset='0%' stopColor='#ffffff' />
        <stop offset='100%' stopColor='#ccc' />
      </linearGradient>
      <linearGradient id='strokeGradientSend'>
        <stop offset='0%' stopColor='#ffffff' />
        <stop offset='100%' stopColor='#ccc' />
      </linearGradient>
    </defs>
  </svg>
));
StrokeGradientSvg.displayName = 'StrokeGradientSvg';
const App: React.FC = () => {
  const { isAuthenticated, loading } = useUser();
  const [currentView, setCurrentView] = useState<AppView>('login');
  const { wideScreenModeEnabled } = useSettings();
  const showSignup = useCallback(() => setCurrentView('signup'), []);
  const showLogin = useCallback(() => setCurrentView('login'), []);

  useEffect(() => {
    const cornerRadiusPx = getDeviceCornerRadius();
    document.documentElement.style.setProperty(
      '--device-corner-radius',
      `${cornerRadiusPx}px`,
    );
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);

  const content = useMemo(() => {
    if (isAuthenticated) return <RoomPage />;
    if (currentView === 'login') return <LoginPage onShowSignup={showSignup} />;
    return <SignUpPage onShowLogin={showLogin} />;
  }, [isAuthenticated, currentView, showSignup, showLogin]);

  if (loading) {
    return <div className='loader'></div>;
  }
  return (
    <>
      <StrokeGradientSvg />
      <IconsSprite />
      <div
        className={`chat-container ${wideScreenModeEnabled ? 'wide-screen-mode' : ''}`}
      >
        {content}
      </div>
    </>
  );
};

export default App;
