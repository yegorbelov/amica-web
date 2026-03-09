import React, { memo, forwardRef, useMemo } from 'react';
import MessageTime from './MessageTime';
import type { Message as MessageType } from '@/types';
import styles from './Message.module.scss';
import { Icon } from '../Icons/AutoIcons';
import SmartMediaLayout from './SmartMediaLayout.tsx';

const LINKABLE_TEXT_PATTERN =
  /((?:https?:\/\/|www\.)[^\s<]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?\d[\d\s().-]{6,}\d))/gi;

type LinkMatchType = 'url' | 'email' | 'phone';

const getLinkMatchType = (value: string): LinkMatchType => {
  if (/^(?:https?:\/\/|www\.)/i.test(value)) {
    return 'url';
  }

  if (value.includes('@')) {
    return 'email';
  }

  return 'phone';
};

const splitTrailingPunctuation = (value: string) => {
  let trimmedValue = value;
  let trailingPunctuation = '';

  while (/[),.!?;:]$/.test(trimmedValue)) {
    const lastChar = trimmedValue.slice(-1);

    if (!lastChar) {
      break;
    }

    if (
      lastChar === ')' &&
      (trimmedValue.match(/\(/g) ?? []).length >=
        (trimmedValue.match(/\)/g) ?? []).length
    ) {
      break;
    }

    trailingPunctuation = `${lastChar}${trailingPunctuation}`;
    trimmedValue = trimmedValue.slice(0, -1);
  }

  return {
    trimmedValue,
    trailingPunctuation,
  };
};

const getHref = (value: string, type: LinkMatchType) => {
  if (type === 'url') {
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  if (type === 'email') {
    return `mailto:${value}`;
  }

  const normalizedPhone = value.replace(/[^\d+]/g, '');
  return `tel:${normalizedPhone}`;
};

const formatMessageText = (text: string) => {
  const content: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(LINKABLE_TEXT_PATTERN)) {
    const rawValue = match[0];
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      content.push(text.slice(lastIndex, matchIndex));
    }

    const { trimmedValue, trailingPunctuation } =
      splitTrailingPunctuation(rawValue);

    if (!trimmedValue) {
      content.push(rawValue);
      lastIndex = matchIndex + rawValue.length;
      continue;
    }

    const type = getLinkMatchType(trimmedValue);
    const href = getHref(trimmedValue, type);

    content.push(
      <a
        key={`${matchIndex}-${trimmedValue}`}
        className={styles.message__link}
        href={href}
        target={type === 'url' ? '_blank' : undefined}
        rel={type === 'url' ? 'noreferrer' : undefined}
      >
        {trimmedValue}
      </a>,
    );

    if (trailingPunctuation) {
      content.push(trailingPunctuation);
    }

    lastIndex = matchIndex + rawValue.length;
  }

  if (lastIndex < text.length) {
    content.push(text.slice(lastIndex));
  }

  return content;
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
