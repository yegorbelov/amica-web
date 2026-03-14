import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import styles from './ContextMenu.module.scss';
import { createPortal } from 'react-dom';
import { Icon } from '../Icons/AutoIcons';
import type { IconName } from '../Icons/AutoIcons';

export interface MenuItem {
  label: string;
  icon?: IconName;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
}

export interface ReactionItem {
  type: string;
  emoji: string;
  iconUrl?: string;
  webmUrl: string;
  movUrl: string;
}

interface ContextMenuProps {
  items: MenuItem[];
  reactions?: readonly ReactionItem[];
  selectedReactionTypes?: readonly string[];
  onReactionSelect?: (reactionType: string) => void;
  position: { x: number; y: number };
  onClose: () => void;
  onAnimationEnd?: () => void;
  isHiding?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  items,
  reactions = [],
  selectedReactionTypes = [],
  onReactionSelect,
  position,
  onClose,
  onAnimationEnd,
  isHiding,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const reactionsRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        (!reactionsRef.current || !reactionsRef.current.contains(target))
      ) {
        onClose();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      const menu = menuRef.current;
      const reactionsEl = reactionsRef.current;
      if (!menu && !reactionsEl) return;

      const menuRect = menu?.getBoundingClientRect();
      const reactionsRect = reactionsEl?.getBoundingClientRect();
      const margin = 50;
      const inMenu =
        menuRect != null &&
        event.clientX >= menuRect.left - margin &&
        event.clientX <= menuRect.right + margin &&
        event.clientY >= menuRect.top - margin &&
        event.clientY <= menuRect.bottom + margin;
      const inReactions =
        reactionsRect != null &&
        event.clientX >= reactionsRect.left - margin &&
        event.clientX <= reactionsRect.right + margin &&
        event.clientY >= reactionsRect.top - margin &&
        event.clientY <= reactionsRect.bottom + margin;

      if (!inMenu && !inReactions) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const originX =
      position.x > window.innerWidth - menu.offsetWidth ? 'right' : 'left';
    const originY =
      position.y > window.innerHeight - menu.offsetHeight ? 'bottom' : 'top';

    const x = position.x + (originX === 'left' ? 0 : -menu.offsetWidth);
    const y = position.y + (originY === 'top' ? 0 : -menu.offsetHeight);

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.setProperty('--scaleOriginX', originX);
    menu.style.setProperty('--scaleOriginY', originY);

    const reactionsEl = reactionsRef.current;
    if (reactionsEl && reactions.length > 0) {
      const gap = 10;
      const panelHeight = reactionsEl.offsetHeight;
      const panelWidth = reactionsEl.offsetWidth;
      const minX = 10;
      const maxX = window.innerWidth - panelWidth - 10;
      const panelX = Math.min(Math.max(x, minX), Math.max(minX, maxX));
      let panelY = y - panelHeight - gap;
      if (panelY < 10) {
        panelY = Math.min(window.innerHeight - panelHeight - 10, y + gap);
      }
      reactionsEl.style.left = `${panelX}px`;
      reactionsEl.style.top = `${panelY}px`;
    }

    const frameId = requestAnimationFrame(() => {
      setVisible(true);
    });

    return () => cancelAnimationFrame(frameId);
  }, [position, reactions.length]);

  return createPortal(
    <>
      {reactions.length > 0 && (
        <div
          ref={reactionsRef}
          className={`${styles['reaction-panel']} ${
            visible ? styles['reaction-panel--visible'] : ''
          } ${isHiding ? styles['reaction-panel--hiding'] : ''}`}
          style={{ left: position.x, top: position.y }}
        >
          <div className={styles['reaction-panel__content']}>
            {reactions.map((reaction, index) => (
              <button
                key={reaction.type}
              type='button'
              className={`${styles['reaction-panel__item']} ${
                selectedReactionTypes.includes(reaction.type)
                  ? styles['reaction-panel__item--selected']
                  : ''
              }`}
              style={{ animationDelay: `${index * 55}ms` }}
              onClick={() => onReactionSelect?.(reaction.type)}
              aria-label={`React with ${reaction.emoji}`}
            >
              {reaction.iconUrl ? (
                <img
                  src={reaction.iconUrl}
                  alt=''
                  className={styles['reaction-panel__icon']}
                />
              ) : (
                <span className={styles['reaction-panel__emoji']}>
                  {reaction.emoji}
                </span>
              )}
            </button>
          ))}
          </div>
          <div
            className={styles['reaction-panel__thoughts']}
            aria-hidden='true'
          >
            <span className={styles['reaction-panel__thought-bubble']} />
            <span
              className={`${styles['reaction-panel__thought-bubble']} ${styles['reaction-panel__thought-bubble--small']}`}
            />
          </div>
        </div>
      )}
      <div
        ref={menuRef}
        onTransitionEnd={onAnimationEnd}
        className={`${styles['context-menu']} 
        ${visible ? styles['context-menu--visible'] : ''} 
        ${isHiding ? styles['context-menu--hiding'] : ''}`}
        style={{
          left: position.x,
          top: position.y,
        }}
      >
        {items.map((item, idx) =>
          item.separator ? (
            <div key={idx} className={styles['context-menu__separator']} />
          ) : (
            <div
              key={idx}
              className={`${styles['context-menu__item']} ${
                item.danger ? styles['context-menu__item--danger'] : ''
              }`}
              style={{ animationDelay: `${idx * 15}ms` }}
              onClick={() => {
                item.onClick();
                onClose();
              }}
            >
              {item.icon && (
                <Icon
                  name={item.icon}
                  className={styles['context-menu__item--icon']}
                />
              )}
              <span>{item.label}</span>
            </div>
          ),
        )}
      </div>
    </>,
    document.body,
  );
};

export default ContextMenu;
