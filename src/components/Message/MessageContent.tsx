import React, { memo, forwardRef } from 'react';
import MessageTime from './MessageTime';
import type { Message as MessageType } from '@/types';
import styles from './Message.module.scss';
import { Icon } from '../Icons/AutoIcons';
import SmartMediaLayout from './SmartMediaLayout.tsx';

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
              <span className={styles.message__text}>{message.value}</span>
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
