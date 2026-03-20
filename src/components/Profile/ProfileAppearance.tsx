import { useEffect, useState } from 'react';
import { useTranslation } from '@/contexts/languageCore';
import styles from './Profile.module.scss';
import { useSettings, useBlur } from '@/contexts/settings/context';
import Toggle from '@/components/ui/toggle/Toggle';
import Slider from '../ui/slider/Slider';
import type { WallpaperSetting } from '@/contexts/settings/types';
import { Icon } from '../Icons/AutoIcons';
import ProfileTabDescription from './ProfileTabDescription';
import { Dropdown } from '../Dropdown/Dropdown';
import ColorPicker from './ColorPicker';
import Button from '../ui/button/Button';

const crossIcon = <Icon name='Cross' />;

export default function ProfileAppearance() {
  const { t } = useTranslation();
  const {
    settings,
    setSetting,
    setActiveWallpaper,
    removeWallpaper,
    fetchWallpapers,
    loading,
    autoplayVideos,
    setAutoplayVideos,
  } = useSettings();
  const { blur, setBlur } = useBlur();

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const is24Hour = settings.timeFormat === '24h';
  const themeOptions: Array<'light' | 'dark' | 'system'> = [
    'light',
    'dark',
    'system',
  ];

  useEffect(() => {
    fetchWallpapers();
  }, [fetchWallpapers]);

  const handleSelectWallpaper = (wall: WallpaperSetting) => {
    if (!wall) {
      setActiveWallpaper(null);
      return;
    }
    setActiveWallpaper({
      id: wall.id,
      url: wall.url,
      type: wall.type,
      blur,
    });
  };

  const handleBlurChange = (value: number) => {
    if (!settings.activeWallpaper || value === blur) return;
    setBlur(value);
  };

  return (
    <div className={styles.section}>
      <ProfileTabDescription
        title={t('profile.appearance')}
        description={t('profile.appearanceDescription')}
        iconName='Appearance'
        backgroundColor='#0D2230'
      />
      <div className={styles.optionRow}>
        <div>{t('tipsMenu.theme')}</div>
        <div className={styles.themeButtons}>
          {themeOptions.map((theme) => (
            <Button
              key={theme}
              className={`${styles.themeButton} ${
                settings.theme === theme ? styles.themeButtonActive : ''
              }`}
              onClick={() => setSetting('theme', theme)}
            >
              {t(
                `tipsMenu.theme${theme.charAt(0).toUpperCase() + theme.slice(1)}`,
              )}
            </Button>
          ))}
        </div>
      </div>
      <div className={styles.optionRow}>
        <div>{t('language.time.timeFormat')}</div>
        <Toggle
          checked={is24Hour}
          onChange={(checked) =>
            setSetting('timeFormat', checked ? '24h' : '12h')
          }
        />
      </div>
      <div className={styles.optionRow}>
        <div>{t('profile.autoplayVideos')}</div>
        <Toggle
          checked={autoplayVideos}
          onChange={(checked) => setAutoplayVideos(checked)}
        />
      </div>
      {windowWidth <= 768 && (
        <div className={styles.optionRow}>
          <div>{t('profile.useWallpaperThroughout')}</div>
          <Toggle
            checked={settings.useBackgroundThroughoutTheApp}
            onChange={setSetting.bind(null, 'useBackgroundThroughoutTheApp')}
          />
        </div>
      )}
      {windowWidth > 768 && settings.activeWallpaper && (
        <div className={styles.optionRow}>
          <div>{t('profile.wallpaperGlow')}</div>
          <Toggle
            checked={settings.wallpaperGlowEnabled}
            onChange={setSetting.bind(null, 'wallpaperGlowEnabled')}
          />
        </div>
      )}

      <div className={styles.optionRow}>
        <div className={styles.wallpapersContainer}>
          {settings.activeWallpaper && (
            <div className={styles.blurSlider}>
              <Slider
                label={t('profile.blur')}
                value={blur}
                min={0}
                max={50}
                step={1}
                onChange={handleBlurChange}
              />
            </div>
          )}
          <div className={styles.colorChangeContainer}>
            <Button
              key={'profile-appearance-change-color-button'}
              onClick={() => setColorPickerOpen(!colorPickerOpen)}
              className={styles.changeColorButton}
            >
              {colorPickerOpen
                ? t('profile.closeColorPicker')
                : t('profile.changeColor')}
            </Button>
            {colorPickerOpen && <ColorPicker />}
          </div>
          {loading ? (
            <div>{t('profile.loadingWallpapers')}</div>
          ) : (
            <div className={styles.wallpaperList}>
              <div
                className={`${styles.wallpaperItem} ${
                  settings.activeWallpaper === null ? styles.selected : ''
                }`}
                onClick={() => setActiveWallpaper(null)}
              >
                <div className={styles.wallpaperThumbnailEmpty}>
                  {t('profile.noBackground')}
                </div>
              </div>
              {[...settings.wallpapers].reverse().map((wall) => (
                <div
                  key={wall.id}
                  className={`${styles.wallpaperItem}  ${
                    settings.activeWallpaper?.id === wall.id
                      ? styles.selected
                      : ''
                  }`}
                >
                  {settings.activeWallpaper?.id === wall.id && (
                    <Dropdown
                      items={[
                        {
                          label: t('profile.wallpaperEditMode.natural'),
                          value: 'natural',
                        },
                        {
                          label: t('profile.wallpaperEditMode.blackAndWhite'),
                          value: 'black-and-white',
                        },
                        {
                          label: t('profile.wallpaperEditMode.colourWash'),
                          value: 'colour-wash',
                        },
                      ]}
                      value={settings.activeWallpaperEditMode ?? 'natural'}
                      placeholder={t('buttons.edit')}
                      onChange={(value) =>
                        setSetting(
                          'activeWallpaperEditMode',
                          value as
                            | 'natural'
                            | 'black-and-white'
                            | 'colour-wash',
                        )
                      }
                      buttonStyles={styles.editSelectedWallpaper}
                      dropdownStyles={styles.editSelectedWallpaperDropdown}
                    />
                  )}
                  {wall.type === 'video' ? (
                    <video
                      src={wall.url || ''}
                      className={`${styles.wallpaperThumbnail}`}
                      onClick={() => handleSelectWallpaper(wall)}
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <img
                      src={wall.url || ''}
                      alt={`Wallpaper ${wall.id}`}
                      className={`${styles.wallpaperThumbnail}`}
                      onClick={() => handleSelectWallpaper(wall)}
                    />
                  )}
                  <div
                    className={styles.removeWallpaper}
                    onClick={removeWallpaper.bind(null, wall.id as string)}
                  >
                    {crossIcon}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
