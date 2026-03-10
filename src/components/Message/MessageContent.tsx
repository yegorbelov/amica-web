import React, { memo, forwardRef, useMemo } from 'react';
import MessageTime from './MessageTime';
import type { Message as MessageType } from '@/types';
import styles from './Message.module.scss';
import { Icon } from '../Icons/AutoIcons';
import SmartMediaLayout from './SmartMediaLayout.tsx';

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
}

const MessageContent = memo(
  forwardRef<HTMLDivElement, MessageContentProps>(
    ({ message, reelItems, isOwn, hasOnlyMediaFiles }, ref) => {
      const isViewed = Boolean(message.viewers?.length);
      const formattedMessage = useMemo(
        () => formatMessageText(message.value ?? ''),
        [message.value],
      );

      return (
        <div className={styles.message} ref={ref}>
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

            <div className={styles.message_div_subdata}>
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
        </div>
      );
    },
  ),
);

MessageContent.displayName = 'MessageContent';

export default MessageContent;
