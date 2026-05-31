import {
  forwardRef,
  memo,
  startTransition,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type KeyboardEvent,
  type MouseEvent,
  type MutableRefObject,
  type PointerEvent,
  type ReactNode,
  type RefAttributes,
} from 'react';
import styles from './Button.module.scss';

const BLUR_DURATION_MS = 150;
const PULSE_RELEASE_MS = 70;

type Variant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  blurOnContentChange?: boolean;
}

interface ButtonViewProps {
  propsRef: MutableRefObject<ButtonProps>;
  children: ReactNode;
  type: 'button' | 'submit' | 'reset';
  className: string;
  variant: Variant;
  disabled: boolean;
  blurOnContentChange: boolean;
  htmlProps: Record<string, unknown>;
}

function extractVisualProps(props: ButtonProps) {
  const {
    children,
    type = 'button',
    className = '',
    variant = 'primary',
    disabled = false,
    blurOnContentChange = true,
    ...rest
  } = props;

  const htmlProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (typeof value !== 'function') {
      htmlProps[key] = value;
    }
  }

  return {
    children,
    type: type as 'button' | 'submit' | 'reset',
    className,
    variant,
    disabled,
    blurOnContentChange,
    htmlProps,
  };
}

function getContentSignature(
  span: HTMLSpanElement | null | undefined,
): string {
  if (!span) return '';

  const text = span.textContent?.trim() ?? '';
  if (text) return text;

  return span.innerHTML;
}

function shallowEqualStyle(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;

  const aStyle = a as Record<string, unknown>;
  const bStyle = b as Record<string, unknown>;
  const aKeys = Object.keys(aStyle);
  const bKeys = Object.keys(bStyle);

  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => aStyle[key] === bStyle[key]);
}

function propsEqual(
  prev: Readonly<ButtonViewProps>,
  next: Readonly<ButtonViewProps>,
): boolean {
  if (
    prev.children !== next.children ||
    prev.className !== next.className ||
    prev.disabled !== next.disabled ||
    prev.variant !== next.variant ||
    prev.type !== next.type ||
    prev.blurOnContentChange !== next.blurOnContentChange
  ) {
    return false;
  }

  const prevHtml = prev.htmlProps;
  const nextHtml = next.htmlProps;
  const keys = new Set([...Object.keys(prevHtml), ...Object.keys(nextHtml)]);

  for (const key of keys) {
    if (key === 'style') {
      if (!shallowEqualStyle(prevHtml.style, nextHtml.style)) return false;
    } else if (prevHtml[key] !== nextHtml[key]) {
      return false;
    }
  }

  return true;
}

const ButtonView = memo(
  forwardRef<HTMLButtonElement, ButtonViewProps>(function ButtonView(
    {
      propsRef,
      children,
      type,
      className,
      variant,
      disabled,
      blurOnContentChange,
      htmlProps,
    },
    ref,
  ) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const forwardedRef = useRef(ref);
    const releaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );
    const widthRef = useRef(0);
    const prevContentSignatureRef = useRef<string | undefined>(undefined);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [width, setWidth] = useState(0);
    const [isPulsing, setIsPulsing] = useState(false);
    const [isBlurring, setIsBlurring] = useState(false);

    useLayoutEffect(() => {
      forwardedRef.current = ref;
    }, [ref]);

    useLayoutEffect(() => {
      if (!blurOnContentChange) return;

      const contentSpan = buttonRef.current?.querySelector<HTMLSpanElement>(
        `.${styles.content}`,
      );
      const signature = getContentSignature(contentSpan);

      if (
        prevContentSignatureRef.current !== undefined &&
        prevContentSignatureRef.current !== signature
      ) {
        if (blurTimeoutRef.current) {
          clearTimeout(blurTimeoutRef.current);
        }

        startTransition(() => {
          setIsBlurring(true);
        });
        blurTimeoutRef.current = setTimeout(() => {
          setIsBlurring(false);
          blurTimeoutRef.current = null;
        }, BLUR_DURATION_MS);
      }

      prevContentSignatureRef.current = signature;
    }, [children, blurOnContentChange]);

    useLayoutEffect(
      () => () => {
        if (blurTimeoutRef.current) {
          clearTimeout(blurTimeoutRef.current);
        }
      },
      [],
    );

    useLayoutEffect(() => {
      const button = buttonRef.current;
      if (!button) return;

      const updateWidth = () => {
        const contentSpan = button.querySelector<HTMLSpanElement>(
          `.${styles.content}`,
        );
        if (!contentSpan) return;

        const style = getComputedStyle(button);
        const padding =
          parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const nextWidth = contentSpan.scrollWidth + padding;

        if (nextWidth !== widthRef.current) {
          widthRef.current = nextWidth;
          startTransition(() => setWidth(nextWidth));
        }
      };

      startTransition(updateWidth);

      const resizeObserver = new ResizeObserver(updateWidth);
      const contentSpan = button.querySelector<HTMLSpanElement>(
        `.${styles.content}`,
      );
      if (contentSpan) resizeObserver.observe(contentSpan);

      return () => resizeObserver.disconnect();
    }, []);

    const setRefs = useCallback((el: HTMLButtonElement | null) => {
      buttonRef.current = el;
      const forwarded = forwardedRef.current;
      if (typeof forwarded === 'function') forwarded(el);
      else if (forwarded) forwarded.current = el;
    }, []);

    const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
      propsRef.current.onClick?.(e);
    }, [propsRef]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLButtonElement>) => {
        propsRef.current.onKeyDown?.(e);
      },
      [propsRef],
    );

    const handlePointerDown = useCallback(
      (e: PointerEvent<HTMLButtonElement>) => {
        if (releaseTimeoutRef.current) {
          clearTimeout(releaseTimeoutRef.current);
          releaseTimeoutRef.current = null;
        }

        setIsPulsing(true);
        propsRef.current.onPointerDown?.(e);
      },
      [propsRef],
    );

    const handlePointerUp = useCallback(
      (e: PointerEvent<HTMLButtonElement>) => {
        releaseTimeoutRef.current = setTimeout(() => {
          setIsPulsing(false);
          releaseTimeoutRef.current = null;
        }, PULSE_RELEASE_MS);

        propsRef.current.onPointerUp?.(e);
      },
      [propsRef],
    );

    const handlePointerLeave = useCallback(
      (e: PointerEvent<HTMLButtonElement>) => {
        if (releaseTimeoutRef.current) {
          clearTimeout(releaseTimeoutRef.current);
          releaseTimeoutRef.current = null;
        }

        setIsPulsing(false);
        propsRef.current.onPointerLeave?.(e);
      },
      [propsRef],
    );

    const classes = useMemo(
      () =>
        [
          styles.button,
          styles[variant],
          disabled ? styles.disabled : '',
          isPulsing ? styles.active : '',
          isBlurring ? styles.blurring : '',
          className,
        ]
          .filter(Boolean)
          .join(' '),
      [variant, disabled, isPulsing, isBlurring, className],
    );

    const { style: externalStyle, ...htmlPropsWithoutStyle } = htmlProps;

    const buttonStyle = useMemo(() => {
      const external = externalStyle as CSSProperties | undefined;
      const hasExternalWidth = external?.width !== undefined;

      return {
        ...external,
        width: hasExternalWidth
          ? external.width
          : width
            ? `${width}px`
            : 'auto',
      };
    }, [externalStyle, width]);

    return (
      <button
        ref={setRefs}
        type={type}
        disabled={disabled}
        className={classes}
        {...htmlPropsWithoutStyle}
        style={buttonStyle}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <span className={styles.content}>{children}</span>
      </button>
    );
  }),
  propsEqual,
) as ForwardRefExoticComponent<ButtonViewProps & RefAttributes<HTMLButtonElement>>;

ButtonView.displayName = 'ButtonView';

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(props, ref) {
    const propsRef = useRef(props);

    useLayoutEffect(() => {
      propsRef.current = props;
    });

    return (
      <ButtonView ref={ref} propsRef={propsRef} {...extractVisualProps(props)} />
    );
  },
);

Button.displayName = 'Button';

export default Button;
