import React, {
  memo,
  forwardRef,
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
  useLayoutEffect,
} from 'react';
import { createPortal } from 'react-dom';
import MessageTime from './MessageTime';
import type { Message as MessageType } from '@/types';
import styles from './Message.module.scss';
import { Icon } from '../Icons/AutoIcons';
import SmartMediaLayout from './SmartMediaLayout.tsx';
import { MESSAGE_REACTION_OPTIONS } from '@/constants/messageReactions';

const LINKABLE_TEXT_PATTERN =
  /((?:https?:\/\/|www\.)[^\s<]+|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\+?\d[\d\s().-]{7,}\d)/gi;

type LinkMatchType = 'url' | 'email' | 'phone';

const getLinkMatchType = (value: string): LinkMatchType => {
  if (/^(https?:\/\/|www\.)/i.test(value)) return 'url';
  if (value.includes('@')) return 'email';
  return 'phone';
};

const splitTrailingPunctuation = (value: string) => {
  let end = value.length;

  const openParens = (value.match(/\(/g) ?? []).length;
  const closeParens = (value.match(/\)/g) ?? []).length;

  while (end > 0 && /[),.!?;:]/.test(value[end - 1])) {
    const char = value[end - 1];

    if (char === ')' && closeParens <= openParens) break;

    end--;
  }

  return {
    trimmedValue: value.slice(0, end),
    trailingPunctuation: value.slice(end),
  };
};

const getHref = (value: string, type: LinkMatchType) => {
  switch (type) {
    case 'url':
      return /^https?:\/\//i.test(value) ? value : `https://${value}`;

    case 'email':
      return `mailto:${value}`;

    case 'phone':
      return `tel:${value.replace(/[^\d+]/g, '')}`;
  }
};

const formatMessageText = (text: string) => {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(LINKABLE_TEXT_PATTERN)) {
    const raw = match[0];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
    }

    const { trimmedValue, trailingPunctuation } = splitTrailingPunctuation(raw);

    if (!trimmedValue) {
      nodes.push(raw);
      lastIndex = index + raw.length;
      continue;
    }

    const type = getLinkMatchType(trimmedValue);
    const href = getHref(trimmedValue, type);

    nodes.push(
      <a
        key={index}
        className={styles.message__link}
        href={href}
        target={type === 'url' ? '_blank' : undefined}
        rel={type === 'url' ? 'noopener noreferrer' : undefined}
      >
        {trimmedValue}
      </a>,
    );

    if (trailingPunctuation) {
      nodes.push(trailingPunctuation);
    }

    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

export interface MessageContentProps {
  message: MessageType;
  reelItems?: MessageType[];
  isOwn: boolean;
  hasOnlyMediaFiles: boolean;
  onReactionClick?: (reactionType: string) => void;
}

interface RenderedReaction {
  type: string;
  count: number;
  emoji?: string;
  isExiting: boolean;
  isEntering: boolean;
}

const MessageContent = memo(
  forwardRef<HTMLDivElement, MessageContentProps>(
    (
      { message, reelItems, isOwn, hasOnlyMediaFiles, onReactionClick },
      ref,
    ) => {
      const rootRef = useRef<HTMLDivElement | null>(null);
      const [tempFullContainer, setTempFullContainer] =
        useState<HTMLElement | null>(null);
      const prevUserReactionsRef = useRef<string[]>(
        message.user_reactions ??
          (message.user_reaction ? [message.user_reaction] : []),
      );
      const hasInitializedUserReactionsRef = useRef(false);
      const burstTimeoutRef = useRef<number | null>(null);
      const burstMeasureRafRef = useRef<number | null>(null);
      const burstFollowRafRef = useRef<number | null>(null);
      const burstVideoRef = useRef<HTMLVideoElement | null>(null);
      const [reactionBurst, setReactionBurst] = useState<{
        key: number;
        webmUrl: string;
        movUrl: string;
        reactionType: string;
        viewportX: number;
        viewportY: number;
      } | null>(null);
      const isViewed = Boolean(message.viewers?.length);
      const formattedMessage = useMemo(
        () => formatMessageText(message.value ?? ''),
        [message.value],
      );
      const reactionEmojiMap = useMemo(
        () =>
          new Map<string, string>(
            MESSAGE_REACTION_OPTIONS.map((reaction) => [
              reaction.type,
              reaction.emoji,
            ]),
          ),
        [],
      );
      const reactionIconMap = useMemo(
        () =>
          new Map<string, string>(
            MESSAGE_REACTION_OPTIONS.map((reaction) => [
              reaction.type,
              reaction.iconUrl,
            ]),
          ),
        [],
      );
      const reactionsSummary = useMemo(
        () => message.reactions_summary ?? [],
        [message.reactions_summary],
      );
      const ownReactionTypes =
        message.user_reactions ??
        (message.user_reaction ? [message.user_reaction] : []);
      const shouldRenderReactionsOutside = hasOnlyMediaFiles && !message.value;
      const [renderedReactions, setRenderedReactions] = useState<
        RenderedReaction[]
      >(
        reactionsSummary.map((reaction) => ({
          type: reaction.type,
          count: reaction.count,
          emoji: reaction.emoji,
          isExiting: false,
          isEntering: false,
        })),
      );
      const reactionItemRefs = useRef(new Map<string, HTMLDivElement>());
      const prevReactionRectsRef = useRef(new Map<string, DOMRect>());
      const prevLayoutSignatureRef = useRef('');
      const reactionRecencyRef = useRef(new Map<string, number>());
      const reactionRecencySeqRef = useRef(0);
      const hasInitializedReactionsSummaryRef = useRef(false);
      const reactionVideoMap = useMemo(
        () =>
          new Map<string, { webmUrl: string; movUrl: string }>(
            MESSAGE_REACTION_OPTIONS.map((reaction) => [
              reaction.type,
              {
                webmUrl: reaction.webmUrl,
                movUrl: reaction.movUrl,
              },
            ]),
          ),
        [],
      );
      const getReactionCenter = useCallback(
        (reactionType: string) => {
          const rootEl = rootRef.current;
          const scopedContainer =
            shouldRenderReactionsOutside && tempFullContainer
              ? tempFullContainer
              : rootEl;
          if (!scopedContainer && !rootEl) return null;

          const rootRect = (rootEl ?? scopedContainer)?.getBoundingClientRect();
          const chipEl = scopedContainer?.querySelector(
            `[data-reaction-type="${reactionType}"]`,
          ) as HTMLButtonElement | null;
          const chipRect = chipEl?.getBoundingClientRect();
          const centerX = chipRect
            ? (chipRect.left + chipRect.right) / 2
            : (rootRect?.left ?? 0) + (rootRect?.width ?? 0) / 2;
          const centerY = chipRect
            ? (chipRect.top + chipRect.bottom) / 2
            : (rootRect?.top ?? 0) + (rootRect?.height ?? 0) / 2;
          return {
            viewportX: centerX,
            viewportY: centerY,
          };
        },
        [shouldRenderReactionsOutside, tempFullContainer],
      );

      useEffect(() => {
        const prev = prevUserReactionsRef.current;
        const next =
          message.user_reactions ??
          (message.user_reaction ? [message.user_reaction] : []);
        if (!hasInitializedUserReactionsRef.current) {
          hasInitializedUserReactionsRef.current = true;
          prevUserReactionsRef.current = next;
          return;
        }
        prevUserReactionsRef.current = next;
        const addedReactionType = next.find((type) => !prev.includes(type));
        if (!addedReactionType) return;

        const videoSources = reactionVideoMap.get(addedReactionType);
        if (!videoSources) return;

        if (burstMeasureRafRef.current) {
          cancelAnimationFrame(burstMeasureRafRef.current);
          burstMeasureRafRef.current = null;
        }

        // Measure after paint so center matches final chip layout.
        burstMeasureRafRef.current = requestAnimationFrame(() => {
          burstMeasureRafRef.current = requestAnimationFrame(() => {
            burstMeasureRafRef.current = null;
            const center = getReactionCenter(addedReactionType);
            if (!center) return;

            setReactionBurst({
              key: Date.now(),
              webmUrl: videoSources.webmUrl,
              movUrl: videoSources.movUrl,
              reactionType: addedReactionType,
              viewportX: center.viewportX,
              viewportY: center.viewportY,
            });
          });
        });
      }, [
        message.user_reactions,
        message.user_reaction,
        reactionVideoMap,
        getReactionCenter,
      ]);

      useEffect(() => {
        if (!reactionBurst) return;

        const syncPosition = () => {
          const videoEl = burstVideoRef.current;
          if (!videoEl) return;
          const center = getReactionCenter(reactionBurst.reactionType);
          if (!center) return;
          videoEl.style.left = `${center.viewportX}px`;
          videoEl.style.top = `${center.viewportY}px`;
        };

        const follow = () => {
          syncPosition();
          burstFollowRafRef.current = requestAnimationFrame(follow);
        };

        const onViewportChange = () => {
          syncPosition();
        };

        syncPosition();
        burstFollowRafRef.current = requestAnimationFrame(follow);
        window.addEventListener('scroll', onViewportChange, true);
        window.addEventListener('resize', onViewportChange);

        return () => {
          if (burstFollowRafRef.current) {
            cancelAnimationFrame(burstFollowRafRef.current);
            burstFollowRafRef.current = null;
          }
          window.removeEventListener('scroll', onViewportChange, true);
          window.removeEventListener('resize', onViewportChange);
        };
      }, [reactionBurst, getReactionCenter]);

      useEffect(() => {
        return () => {
          if (burstTimeoutRef.current) {
            window.clearTimeout(burstTimeoutRef.current);
          }
          if (burstMeasureRafRef.current) {
            cancelAnimationFrame(burstMeasureRafRef.current);
          }
          if (burstFollowRafRef.current) {
            cancelAnimationFrame(burstFollowRafRef.current);
          }
        };
      }, []);

      useEffect(() => {
        const summarySnapshot = [...reactionsSummary];
        if (!hasInitializedReactionsSummaryRef.current) {
          if (summarySnapshot.length === 0) {
            return;
          }

          hasInitializedReactionsSummaryRef.current = true;
          const recencyMap = reactionRecencyRef.current;
          recencyMap.clear();
          for (let i = summarySnapshot.length - 1; i >= 0; i -= 1) {
            reactionRecencySeqRef.current += 1;
            recencyMap.set(
              summarySnapshot[i].type,
              reactionRecencySeqRef.current,
            );
          }
          const initRafId = requestAnimationFrame(() => {
            setRenderedReactions(
              summarySnapshot.map((reaction) => ({
                type: reaction.type,
                count: reaction.count,
                emoji: reaction.emoji,
                isExiting: false,
                isEntering: false,
              })),
            );
          });
          return () => cancelAnimationFrame(initRafId);
        }

        const rafId = requestAnimationFrame(() => {
          setRenderedReactions((prev) => {
            const prevByType = new Map(
              prev.map((item, index) => [item.type, { item, index }]),
            );
            const activeTypeSet = new Set(
              summarySnapshot.map((reaction) => reaction.type),
            );
            const newTypeSet = new Set<string>();
            const recencyMap = reactionRecencyRef.current;

            // Update recency only when a type is new or its count increases.
            // Count decreases (e.g. when oldest user reaction is evicted at max=3)
            // should not make the chip look "more recent".
            summarySnapshot.forEach((reaction) => {
              const prevItem = prevByType.get(reaction.type)?.item;
              const isNewType = !prevItem;
              if (isNewType) {
                newTypeSet.add(reaction.type);
              }
              const hasCountIncreased = prevItem
                ? reaction.count > prevItem.count
                : false;
              if (
                isNewType ||
                hasCountIncreased ||
                !recencyMap.has(reaction.type)
              ) {
                reactionRecencySeqRef.current += 1;
                recencyMap.set(reaction.type, reactionRecencySeqRef.current);
              }
            });

            // Remove stale recency entries for fully inactive types.
            Array.from(recencyMap.keys()).forEach((type) => {
              if (!activeTypeSet.has(type)) {
                recencyMap.delete(type);
              }
            });

            // Higher count wins. On equal count, brand-new reaction goes left.
            // Then keep deterministic order by recency and previous index.
            const sortedActive = [...summarySnapshot].sort((a, b) => {
              if (b.count !== a.count) return b.count - a.count;

              const aIsNew = newTypeSet.has(a.type);
              const bIsNew = newTypeSet.has(b.type);
              if (aIsNew !== bIsNew) return aIsNew ? -1 : 1;

              const aRecency = recencyMap.get(a.type) ?? 0;
              const bRecency = recencyMap.get(b.type) ?? 0;
              if (aRecency !== bRecency) return bRecency - aRecency;

              const aPrevIndex =
                prevByType.get(a.type)?.index ?? Number.MAX_SAFE_INTEGER;
              const bPrevIndex =
                prevByType.get(b.type)?.index ?? Number.MAX_SAFE_INTEGER;
              if (aPrevIndex !== bPrevIndex) return aPrevIndex - bPrevIndex;
              return a.type.localeCompare(b.type);
            });

            const activeItems: RenderedReaction[] = sortedActive.map(
              (reaction) => {
                const prevItem = prevByType.get(reaction.type)?.item;
                const isNewType = !prevByType.has(reaction.type);
                return {
                  type: reaction.type,
                  count: reaction.count,
                  emoji: reaction.emoji,
                  isExiting: false,
                  // Keep enter animation until animationend clears it.
                  isEntering: (prevItem?.isEntering ?? false) || isNewType,
                };
              },
            );

            // Keep exiting chips near their previous visual position.
            const exitingWithIndex = prev
              .filter((item) => !activeTypeSet.has(item.type))
              .map((item) => ({
                reaction: {
                  ...item,
                  isExiting: true,
                  isEntering: false,
                } as RenderedReaction,
                index: prevByType.get(item.type)?.index ?? activeItems.length,
              }))
              .sort((a, b) => a.index - b.index);

            const merged = [...activeItems];
            const hasNewcomer = newTypeSet.size > 0;
            // When a new reaction appears and another one is removed in the same
            // update (max user reactions cap), keep the active ordering stable and
            // avoid inline exiting chips pushing the newcomer to a middle slot.
            if (hasNewcomer) {
              return merged;
            }
            exitingWithIndex.forEach(({ reaction, index }) => {
              const safeIndex = Math.min(index, merged.length);
              merged.splice(safeIndex, 0, reaction);
            });

            return merged;
          });
        });

        return () => cancelAnimationFrame(rafId);
      }, [reactionsSummary]);

      useLayoutEffect(() => {
        const nextRects = new Map<string, DOMRect>();
        const layoutSignature = renderedReactions
          .map(
            (reaction) =>
              `${reaction.type}:${reaction.count}:${reaction.isExiting ? 1 : 0}`,
          )
          .join('|');
        const shouldAnimateReorder =
          prevLayoutSignatureRef.current !== '' &&
          prevLayoutSignatureRef.current !== layoutSignature;

        renderedReactions.forEach((reaction) => {
          const node = reactionItemRefs.current.get(reaction.type);
          if (!node || reaction.isExiting) return;

          const nextRect = node.getBoundingClientRect();
          nextRects.set(reaction.type, nextRect);

          if (!shouldAnimateReorder) return;

          const prevRect = prevReactionRectsRef.current.get(reaction.type);
          if (!prevRect) return;

          const deltaX = prevRect.left - nextRect.left;
          const deltaY = prevRect.top - nextRect.top;

          if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

          node.style.transition = 'none';
          node.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

          requestAnimationFrame(() => {
            node.style.transition =
              'transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)';
            node.style.transform = '';
          });
        });

        prevReactionRectsRef.current = nextRects;
        prevLayoutSignatureRef.current = layoutSignature;
      }, [renderedReactions]);

      const reactionsNode =
        renderedReactions.length > 0 ? (
          <div className={styles.message_reactions}>
            {renderedReactions.map((reaction) => {
              const emoji =
                reaction.emoji || reactionEmojiMap.get(reaction.type) || '✨';
              const iconUrl = reactionIconMap.get(reaction.type);
              return (
                <div
                  key={`${message.id}-${reaction.type}`}
                  className={styles.message_reaction_motion}
                  ref={(node) => {
                    if (node) {
                      reactionItemRefs.current.set(reaction.type, node);
                    } else {
                      reactionItemRefs.current.delete(reaction.type);
                    }
                  }}
                >
                  <button
                    type='button'
                    className={`${styles.message_reaction} ${
                      ownReactionTypes.includes(reaction.type)
                        ? styles.message_reaction__own
                        : ''
                    } ${reaction.isEntering ? styles.message_reaction__entering : ''} ${
                      reaction.isExiting ? styles.message_reaction__exiting : ''
                    }`}
                    title={`${reaction.type}: ${reaction.count}`}
                    onClick={() =>
                      !reaction.isExiting && onReactionClick?.(reaction.type)
                    }
                    data-reaction-type={reaction.type}
                    onAnimationEnd={() => {
                      if (reaction.isExiting) {
                        setRenderedReactions((prev) =>
                          prev.filter((item) => item.type !== reaction.type),
                        );
                        return;
                      }

                      if (reaction.isEntering) {
                        setRenderedReactions((prev) =>
                          prev.map((item) =>
                            item.type === reaction.type
                              ? { ...item, isEntering: false }
                              : item,
                          ),
                        );
                      }
                    }}
                  >
                    {iconUrl ? (
                      <img
                        src={iconUrl}
                        alt=''
                        className={styles.message_reaction__icon}
                      />
                    ) : (
                      <span>{emoji}</span>
                    )}
                    {reaction.count > 1 && <span>{reaction.count}</span>}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null;
      return (
        <div
          className={styles.message}
          ref={(node) => {
            rootRef.current = node;
            const nextTempFull =
              (node?.closest('.temp_full') as HTMLElement | null) ?? null;
            setTempFullContainer((prev) =>
              prev === nextTempFull ? prev : nextTempFull,
            );
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
        >
          {message.files && message.files.length > 0 && (
            <SmartMediaLayout files={message.files} reelItems={reelItems} />
          )}

          <div
            className={`${styles.message_div_temp_separator} ${
              !message.value ? styles.textEmpty : ''
            } ${!message.value && hasOnlyMediaFiles ? styles.hasOnlyMediaFiles : ''}`}
          >
            {message.value && (
              <span className={styles.message__text}>{formattedMessage}</span>
            )}

            <div
              className={`${styles.message_div_subdata} ${
                renderedReactions.length > 0 && !shouldRenderReactionsOutside
                  ? styles.message_div_subdata__with_reactions
                  : ''
              }`}
            >
              {!shouldRenderReactionsOutside && reactionsNode}
              <div className='message_div_temp_time_view'>
                {message.edit_date && (
                  <span className={styles.edited}>edited</span>
                )}
                <MessageTime date={message.date} />
                <span id='viewed_span' className='viewed-status'>
                  {isOwn &&
                    (isViewed ? (
                      <Icon
                        name='Read'
                        className={styles['viewed-status__icon']}
                      />
                    ) : (
                      <Icon
                        name='Unread'
                        className={styles['viewed-status__icon']}
                      />
                    ))}
                </span>
              </div>
            </div>
          </div>
          {shouldRenderReactionsOutside &&
            reactionsNode &&
            tempFullContainer &&
            createPortal(
              <div
                className={`${styles.message_reactions_temp_full} ${
                  isOwn ? styles.message_reactions_temp_full__own : ''
                }`}
              >
                {reactionsNode}
              </div>,
              tempFullContainer,
            )}

          {reactionBurst &&
            createPortal(
              <video
                key={reactionBurst.key}
                ref={burstVideoRef}
                className={styles.reaction_burst}
                style={{
                  left: reactionBurst.viewportX,
                  top: reactionBurst.viewportY,
                }}
                autoPlay
                muted
                playsInline
                onLoadedMetadata={(event) => {
                  const durationSec = event.currentTarget.duration;
                  if (!Number.isFinite(durationSec) || durationSec <= 0) return;
                  if (burstTimeoutRef.current) {
                    window.clearTimeout(burstTimeoutRef.current);
                  }
                  // Safety fallback only; normal completion goes through onEnded.
                  burstTimeoutRef.current = window.setTimeout(
                    () => {
                      setReactionBurst(null);
                      burstTimeoutRef.current = null;
                    },
                    durationSec * 1000 + 500,
                  );
                }}
                onEnded={() => setReactionBurst(null)}
              >
                <source src={reactionBurst.movUrl} type='video/quicktime' />
                <source src={reactionBurst.webmUrl} type='video/webm' />
              </video>,
              document.body,
            )}
        </div>
      );
    },
  ),
);

MessageContent.displayName = 'MessageContent';

export default MessageContent;
