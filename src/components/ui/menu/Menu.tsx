import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  startTransition,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Menu.module.scss';
import { Icon, type IconName } from '../../Icons/AutoIcons';
// import Button from '../button/Button';
import type { ContextMenuAnimatedIcon } from '@/components/ContextMenu/ContextMenuItemLottie';
import { ContextMenuItemLottie } from '@/components/ContextMenu/ContextMenuItemLottie';
import type { DisplayMedia } from '@/types';
import Avatar from '@/components/Avatar/Avatar';

export type MenuItem<T> = {
  label: string;
  subtitle?: string;
  primaryMedia?: DisplayMedia;
  value?: T;
  disabled?: boolean;
  icon?: IconName;
  animatedIcon?: ContextMenuAnimatedIcon;
  isDropdown?: boolean;
  /** When isDropdown: show arrow up (expanded) or down (collapsed) */
  dropdownExpanded?: boolean;
  sectionTitle?: string;
  separator?: boolean;
  destructive?: boolean;
  onClick?: () => void;
};

type MenuProps<T> = {
  items?: MenuItem<T>[];
  value?: T;
  disabled?: boolean;
  placeholder?: string;
  buttonStyles?: string;
  menuStyles?: string;

  position?: { x: number; y: number };
  onClose?: () => void;
  /** Parent-controlled hiding (e.g. when paired with ReactionsPanel). When true, Menu uses this instead of internal state. */
  isHiding?: boolean;
  /** Called when hide transition completes. Use to set menuVisible=false and cleanup. */
  onAnimationEnd?: () => void;
  /** Called after menu is positioned (incl. viewport flip). Use for ReactionsPanel. */
  onPositioned?: (rect: DOMRect) => void;
  isNested?: boolean;
  onNestedOpen?: () => void;
  onNestedClose?: () => void;
  /** Controlled open for submenu mode */
  open?: boolean;
  /** Hide the toggle button (for context menu / submenu) */
  hideToggle?: boolean;
  /** X offset for submenu (e.g. parent menu width + gap) */
  submenuOffsetX?: number;
  /** Callback when a dropdown item is clicked - provides rects for submenu positioning */
  onDropdownItemClick?: (rect: {
    itemRect: DOMRect;
    menuRect: DOMRect;
  }) => void;
  /** Explicit width for submenu (e.g. to match parent menu) */
  width?: number;
  /** Nested menu: always originX=left, preserve left edge alignment (clamp only when overflow) */
  openRight?: boolean;
  /** Shared id for menu group (parent + nested). When set, click/scroll outside checks all menus in the group. */
  menuGroupId?: string;
};

const EDGE_MARGIN = 8;
const MENU_GROUP_ATTR = 'data-menu-group';

export function Menu<T extends string | number>({
  items,
  position = { x: 0, y: 0 },
  isHiding: isHidingProp,
  onAnimationEnd,
  onPositioned,
  // buttonStyles = '',
  // menuStyles = '',
  // placeholder = 'Select...',
  // hideToggle = false,
  isNested = false,
  onNestedOpen,
  onNestedClose,
  open: controlledOpen,
  onClose,
  submenuOffsetX = 0,
  onDropdownItemClick,
  openRight = false,
  menuGroupId,
}: MenuProps<T>) {
  const [internalOpen, setInternalOpen] = useState(isNested ? false : true);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  // const containerRef = useRef<HTMLDivElement>(null);
  // const btnRef = useRef<HTMLButtonElement>(null);

  const menuRef = useRef<HTMLUListElement>(null);
  const menuInnerRef = useRef<HTMLDivElement>(null);

  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const isPointerDown = useRef(false);
  const isScrolling = useRef(false);

  const [internalHiding, setInternalHiding] = useState(false);
  const isControlledHiding = isHidingProp !== undefined;
  const isHiding = isControlledHiding ? isHidingProp : internalHiding;

  const handleHideTransitionEnd = useCallback(
    (e: React.TransitionEvent) => {
      if (e.target !== e.currentTarget) return;
      if (!isHiding) return;
      if (isControlledHiding) {
        onAnimationEnd?.();
      }
    },
    [isHiding, isControlledHiding, onAnimationEnd],
  );

  const [visible, setVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const [hoveredItemIndex, setHoveredItemIndex] = useState<number | null>(null);

  const setOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      if (!isControlled) {
        setInternalOpen(value);
      }
    },
    [isControlled],
  );

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const handleMenuOpen = () => {
      menu.style.setProperty('--scaleOriginX', 'center');
      menu.style.setProperty('--scaleOriginY', 'center');
    };

    menu.addEventListener('transitionend', handleMenuOpen);
    return () => {
      menu.removeEventListener('transitionend', handleMenuOpen);
    };
  }, [menuRef]);

  const [indicatorPos, setIndicatorPos] = useState<{
    top: number;
    height: number;
  } | null>(null);

  const resolvedPosition = useMemo(
    () => ({
      x: position.x + submenuOffsetX,
      y: position.y,
    }),
    [position.x, position.y, submenuOffsetX],
  );

  const onMenuClose = useCallback(() => {
    if (!menuRef.current) return;
    onClose?.();

    if (isControlledHiding) {
      return;
    }
    setInternalHiding(true);

    const handleTransitionEnd = () => {
      setInternalHiding(false);
      setOpen(false);
    };

    menuRef.current?.addEventListener('transitionend', handleTransitionEnd);
    return () => {
      menuRef.current?.removeEventListener(
        'transitionend',
        handleTransitionEnd,
      );
    };
  }, [setOpen, menuRef, onClose, isControlledHiding]);

  const isInsideMenuOrGroup = useCallback(
    (clientX: number, clientY: number, margin = 0) => {
      if (menuGroupId) {
        const groupEls = document.querySelectorAll(
          `[${MENU_GROUP_ATTR}="${menuGroupId}"]`,
        );
        for (const el of groupEls) {
          const rect = el.getBoundingClientRect();
          if (
            clientX >= rect.left - margin &&
            clientX <= rect.right + margin &&
            clientY >= rect.top - margin &&
            clientY <= rect.bottom + margin
          ) {
            return true;
          }
        }
        return false;
      }
      const menu = menuRef.current;
      if (!menu) return false;
      const rect = menu.getBoundingClientRect();
      return (
        clientX >= rect.left - margin &&
        clientX <= rect.right + margin &&
        clientY >= rect.top - margin &&
        clientY <= rect.bottom + margin
      );
    },
    [menuGroupId],
  );

  const isNodeInsideMenuOrGroup = useCallback(
    (target: Node) => {
      if (menuGroupId) {
        const groupEl = (target as Element).closest?.(
          `[${MENU_GROUP_ATTR}="${menuGroupId}"]`,
        );
        return groupEl != null;
      }
      return menuRef.current?.contains(target) ?? false;
    },
    [menuGroupId],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!isNodeInsideMenuOrGroup(target)) {
        onMenuClose();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      const margin = 50;
      if (!isInsideMenuOrGroup(event.clientX, event.clientY, margin)) {
        onMenuClose();
      }
    };

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && isNodeInsideMenuOrGroup(target)) {
        return;
      }
      onMenuClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', onMenuClose);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', onMenuClose);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [onMenuClose, isInsideMenuOrGroup, isNodeInsideMenuOrGroup, menuGroupId]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const menuW = menu.offsetWidth;
    const menuH = menu.offsetHeight;

    const originX = openRight
      ? 'left'
      : resolvedPosition.x > viewportW - menuW
        ? 'right'
        : 'left';
    const originY = resolvedPosition.y > viewportH - menuH ? 'bottom' : 'top';

    let x = resolvedPosition.x + (originX === 'left' ? 0 : -menuW);
    let y = resolvedPosition.y + (originY === 'top' ? 0 : -menuH);

    const minX = EDGE_MARGIN;
    const maxX = viewportW - menuW - EDGE_MARGIN;
    const minY = EDGE_MARGIN;
    const maxY = viewportH - menuH - EDGE_MARGIN;

    x = Math.max(minX, Math.min(maxX, x));
    y = Math.max(minY, Math.min(maxY, y));

    setMenuPosition({ left: x, top: y });
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.setProperty('--scaleOriginX', originX);
    menu.style.setProperty('--scaleOriginY', originY);

    onPositioned?.(new DOMRect(x, y, menuW, menuH));

    const frameId = requestAnimationFrame(() => setVisible(true));

    return () => cancelAnimationFrame(frameId);
  }, [resolvedPosition, openRight, onPositioned]);

  const updateIndicatorByPointer = (clientY: number) => {
    const menu = menuInnerRef.current;
    if (!menu) return null;

    const rect = menu.getBoundingClientRect();
    const pointerY = clientY - rect.top;

    let closestIndex = 0;
    let minDistance = Infinity;

    itemRefs.current.forEach((el, index) => {
      if (!el) return;

      const center = el.offsetTop + el.offsetHeight / 2;
      const distance = Math.abs(pointerY - center);

      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    const el = itemRefs.current[closestIndex];
    if (el) {
      setIndicatorPos({
        top: el.offsetTop,
        height: el.offsetHeight,
      });
    }

    return closestIndex;
  };

  const isPointerInsideMenu = (clientX: number, clientY: number) => {
    const menu = menuRef.current;
    if (!menu) return false;

    const rect = menu.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  };

  const rafRef = useRef<number | null>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isScrolling.current && isPointerDown.current) return;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      if (!isPointerInsideMenu(e.clientX, e.clientY)) {
        resetIndicator();
        return;
      }
      updateIndicatorByPointer(e.clientY);
      rafRef.current = null;
    });
  };

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    isPointerDown.current = true;
    isScrolling.current = false;
    updateIndicatorByPointer(e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (!isPointerDown.current || isScrolling.current) return;
    isPointerDown.current = false;

    if (!isPointerInsideMenu(e.clientX, e.clientY)) {
      resetIndicator();
      return;
    }

    const index = updateIndicatorByPointer(e.clientY);
    if (index !== null) {
      const selectedItem = items[index];
      if (selectedItem) {
        if (isNested) {
          onNestedOpen?.();
          return;
        }
        if (selectedItem.isDropdown) {
          const itemEl = itemRefs.current[index];
          const menuEl = menuRef.current;
          if (itemEl && menuEl) {
            onDropdownItemClick?.({
              itemRect: itemEl.getBoundingClientRect(),
              menuRect: menuEl.getBoundingClientRect(),
            });
          }
          selectedItem.onClick?.();
          return;
        }
        selectedItem.onClick?.();
        onNestedClose?.();
        setOpen(false);
        onClose?.();
      }
    }
  };

  // useLayoutEffect(() => {
  //   if (!open) return;

  //   const index = items.findIndex((item) => item.value === value);
  //   const el = itemRefs.current[index];
  //   const menu = menuRef.current;

  //   if (!el || !menu) return;

  //   const targetScrollTop = el.offsetTop;

  //   const maxScroll = menu.scrollHeight - menu.clientHeight;

  //   menu.scrollTo({
  //     top: Math.min(targetScrollTop, maxScroll),
  //     behavior: 'instant',
  //   });

  //   requestAnimationFrame(() => {
  //     setIndicatorPos({
  //       top: el.offsetTop,
  //       height: el.offsetHeight,
  //     });
  //   });
  // }, [open, value, items]);

  const resetIndicator = () => {
    setIndicatorPos(null);
  };

  useEffect(() => {
    startTransition(() => {
      setHoveredItemIndex(null);
    });
  }, [items]);

  return (
    <>
      {
        // <div
        //   className={`${styles.menu} ${visible ? styles['menu--visible'] : ''}
        //   ${isHiding ? styles['menu--hiding'] : ''} ${menuStyles} ${isNested ? styles.nested : ''}`}
        //   ref={containerRef}
        // >
        //   {!hideToggle && (
        //     <Button
        //       key={'dropdown-button'}
        //       ref={btnRef}
        //       onClick={() => setOpen((prev) => !prev)}
        //       className={`${styles.toggle} ${buttonStyles}`}
        //       type='button'
        //     >
        //       {selected ? (
        //         <>
        //           {selected.icon && selectedIcon}
        //           {selected.label}
        //         </>
        //       ) : (
        //         placeholder
        //       )}
        //     </Button>
        //   )}
      }

      {open &&
        createPortal(
          <>
            {/* <div className={styles.backdrop} onClick={handleBackdropClick} /> */}
            <ul
              ref={menuRef}
              className={`${styles.menu} ${visible ? styles['menu--visible'] : ''} ${isHiding ? styles['menu--hiding'] : ''}`}
              onTransitionEnd={handleHideTransitionEnd}
              {...(menuGroupId && { [MENU_GROUP_ATTR]: menuGroupId })}
              style={{
                left: menuPosition.left,
                top: menuPosition.top,
              }}
              onScroll={() => {
                isScrolling.current = true;
                resetIndicator();
              }}
            >
              <div
                className={styles.menuInner}
                onPointerMove={handlePointerMove}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={resetIndicator}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                ref={menuInnerRef}
              >
                {indicatorPos && (
                  <span
                    className={styles.indicator}
                    style={{
                      top: indicatorPos.top,
                      height: indicatorPos.height,
                    }}
                  />
                )}
                {items.map((item, index) =>
                  item.separator ? (
                    <div key={index} className={styles.separator} />
                  ) : (
                    <li
                      key={index}
                      className={`${styles.item} ${item.destructive ? styles.destructive : ''}`}
                      style={{ animationDelay: `${index * 15}ms` }}
                      onMouseEnter={() => setHoveredItemIndex(index)}
                      onMouseLeave={() => setHoveredItemIndex(null)}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                    >
                      {item.animatedIcon ? (
                        <ContextMenuItemLottie
                          variant={item.animatedIcon}
                          isHovered={hoveredItemIndex === index}
                        />
                      ) : (
                        item.icon && (
                          <Icon name={item.icon} className={styles.icon} />
                        )
                      )}
                      {'primaryMedia' in item && (
                        <Avatar
                          displayName={item.label}
                          displayMedia={item.primaryMedia}
                          className={styles.avatar}
                        />
                      )}
                      <div className={styles.itemContent}>
                        <span className={styles.itemLabel}>{item.label}</span>
                        {item.subtitle && (
                          <span className={styles.subtitle}>
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                      {item.isDropdown && (
                        <Icon
                          name='Arrow'
                          className={styles.dropdownArrow}
                          style={{
                            transform: item.dropdownExpanded
                              ? 'rotate(90deg)'
                              : 'rotate(0deg)',
                          }}
                        />
                      )}
                    </li>
                  ),
                )}
              </div>
            </ul>
          </>,
          document.body,
        )}
    </>
    // </div>
  );
}
