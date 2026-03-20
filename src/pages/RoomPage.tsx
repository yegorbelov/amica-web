import React from 'react';
import LeftSideBar from '../components/LeftSideBar/LeftSideBar';
import MainChatWindow from '../components/MainChatWindow/MainChatWindow';
import Wallpaper from './Wallpaper';
import { TabsProvider } from '../components/Tabs/TabsContext';
import styles from './RoomPage.module.scss';
// import { useSettings } from '@/contexts/settings/context';

// function isGlowDisabledByFlag(): boolean {
//   if (typeof import.meta.env.VITE_WALLPAPER_GLOW === 'string') {
//     const v = import.meta.env.VITE_WALLPAPER_GLOW.toLowerCase();
//     if (v === 'false' || v === '0' || v === 'no') return true;
//   }
//   if (typeof window === 'undefined') return false;
//   const params = new URLSearchParams(window.location.search);
//   const wallpaperGlow = params.get('wallpaperGlow') ?? params.get('glow');
//   return (
//     wallpaperGlow === '0' || wallpaperGlow === 'false' || wallpaperGlow === 'no'
//   );
// }

const RoomPage: React.FC = () => {
  // const { settings } = useSettings();
  // const glow = settings.wallpaperGlowEnabled && !isGlowDisabledByFlag();

  return (
    <>
      <TabsProvider>
        <div className={styles.roomPageContainer}>
          <Wallpaper isChatWindow={false} />
          <LeftSideBar />
          <MainChatWindow />
        </div>
      </TabsProvider>
    </>
  );
};

export default React.memo(RoomPage);
