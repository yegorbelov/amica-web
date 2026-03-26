import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  memo,
  useMemo,
} from 'react';
import type { Message } from '@/types';
import { websocketManager } from '../../utils/websocket-manager';
import {
  useSelectedChat,
  useMessagesActions,
  useEditing,
} from '../../contexts/ChatContextCore';
import styles from './SendArea.module.scss';
import { useUser } from '../../contexts/UserContextCore';
import { useTranslation } from '@/contexts/languageCore';
import { useSearchContext } from '@/contexts/search/SearchContextCore';
import { apiUpload } from '../../utils/apiFetch';
import { Icon } from '../Icons/AutoIcons';
import DropZone from '../DropZone/DropZone';
import JumpToBottom from '../JumpToBottom/JumpToBottom';
import Button from '../ui/button/Button';
import FilesPreview from './FilesPreview';

interface SendAreaProps {
  isSelectionMode?: boolean;
  selectedMessagesCount?: number;
  onExitSelectionMode?: () => void;
  onDeleteSelectedMessages?: () => void;
}

const MessageInput: React.FC<SendAreaProps> = ({
  isSelectionMode = false,
  selectedMessagesCount = 0,
  onExitSelectionMode,
  onDeleteSelectedMessages,
}) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  /** Per-chat draft text; key = chatId */
  const draftByChatIdRef = useRef<Record<number, string>>({});
  /** Saved edit session when user switches chat while editing; restored on return */
  const editStateByChatIdRef = useRef<
    Record<number, { message: Message; editText: string } | null>
  >({});
  const prevChatIdRef = useRef<number | undefined>(undefined);
  const messageRef = useRef(message);
  messageRef.current = message;
  const editingMessageRef =
    useRef<ReturnType<typeof useEditing>['editingMessage']>(null);
  /** When restoring edit from another chat, pass edit text so effect doesn't overwrite */
  const pendingRestoreEditTextRef = useRef<string | null>(null);
  /** Chat in which we started editing; used to avoid overwriting other chats' drafts when switching while in edit mode */
  const editingChatIdRef = useRef<number | undefined>(undefined);

  const { selectedChat } = useSelectedChat();
  const { updateMessageInChat } = useMessagesActions();
  const { editingMessage, setEditingMessage } = useEditing();
  const { user } = useUser();
  const { setTerm, setResults } = useSearchContext();

  editingMessageRef.current = editingMessage;

  const chatId = selectedChat?.id;

  const placeCaretAtEnd = useCallback((el: HTMLDivElement) => {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  // Per-chat drafts: on chat switch save current to previous chat, load new chat's draft or edit state
  useEffect(() => {
    const prevId = prevChatIdRef.current;
    if (prevId !== undefined && prevId !== chatId) {
      if (editingMessageRef.current) {
        editStateByChatIdRef.current[prevId] = {
          message: editingMessageRef.current,
          editText: messageRef.current,
        };
      } else {
        draftByChatIdRef.current[prevId] = messageRef.current;
      }
      setEditingMessage(null);
    }
    prevChatIdRef.current = chatId;
    if (chatId !== undefined) {
      const editState = editStateByChatIdRef.current[chatId];
      if (editState) {
        pendingRestoreEditTextRef.current = editState.editText;
        setEditingMessage(editState.message);
        editStateByChatIdRef.current[chatId] = null;
      } else {
        if (!editingMessageRef.current) {
          editingChatIdRef.current = undefined;
        }
        const draft = draftByChatIdRef.current[chatId] ?? '';
        setMessage(draft);
        if (editableRef.current) {
          editableRef.current.innerText = draft;
          placeCaretAtEnd(editableRef.current);
        }
      }
    }
  }, [chatId, setEditingMessage, placeCaretAtEnd]);

  // Clear editing chat ref when edit mode is left (so next edit in any chat is "fresh")
  useEffect(() => {
    if (!editingMessage) {
      editingChatIdRef.current = undefined;
    }
  }, [editingMessage]);

  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent): void => {
      if (
        document.activeElement === document.body &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        !e.shiftKey &&
        ![
          'Tab',
          'Escape',
          'F1',
          'F2',
          'F3',
          'F4',
          'F5',
          'F6',
          'F7',
          'F8',
          'F9',
          'F10',
          'F11',
          'F12',
        ].includes(e.key)
      ) {
        if (editableRef.current) {
          editableRef.current.focus();
          if (e.key.length === 1) {
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeydown, true);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeydown, true);
    };
  }, []);

  const sendFilesViaHttp = useCallback(
    async (filesToSend: File[], textMessage: string = '') => {
      if (!user?.id || !chatId) {
        console.error('User ID or Chat ID is missing');
        return false;
      }

      const formData = new FormData();

      formData.append('message', textMessage);
      formData.append('chat_id', chatId.toString());

      filesToSend.forEach((file) => {
        formData.append('file', file);
      });

      try {
        setIsUploading(true);

        await apiUpload('/api/messages/', formData, () => {});

        return true;
      } catch (error: unknown) {
        console.error('Error sending files:', error);
        alert(error instanceof Error ? error.message : String(error));
        return false;
      } finally {
        setIsUploading(false);
      }
    },
    [user?.id, chatId],
  );

  const handleInput = useCallback(() => {
    const el = editableRef.current;
    if (!el) return;

    let text = el.innerText.replace(/\u00A0/g, ' ');

    const onlyBreak =
      el.childNodes.length === 1 && el.childNodes[0].nodeName === 'BR';

    if (text.trim() === '' && onlyBreak) {
      text = '';
      el.innerHTML = '';
    }

    setMessage(text);
  }, []);

  useEffect(() => {
    if (!editingMessage || !chatId) return;
    if (pendingRestoreEditTextRef.current !== null) {
      const editText = pendingRestoreEditTextRef.current;
      pendingRestoreEditTextRef.current = null;
      if (chatId !== undefined) {
        editingChatIdRef.current = chatId;
      }
      setMessage(editText);
      if (editableRef.current) {
        editableRef.current.innerText = editText;
        placeCaretAtEnd(editableRef.current);
      }
      return;
    }
    // Switched to another chat while edit was active: switch effect already set field to that chat's draft; don't overwrite with previous chat's edit
    if (
      editingChatIdRef.current !== undefined &&
      editingChatIdRef.current !== chatId
    ) {
      return;
    }
    // Save "new message" draft only on first entering edit (messageRef still has draft); do not overwrite with edit text on re-runs
    if (chatId !== undefined && editingChatIdRef.current === undefined) {
      editingChatIdRef.current = chatId;
      draftByChatIdRef.current[chatId] = messageRef.current;
    }
    const text = editingMessage.value ?? '';
    setMessage(text);
    if (editableRef.current) {
      const el = editableRef.current;
      el.innerText = text;
      placeCaretAtEnd(el);
    }
  }, [editingMessage?.id, chatId, editingMessage, placeCaretAtEnd]);

  const cancelEdit = useCallback(() => {
    setEditingMessage(null);
    editingChatIdRef.current = undefined;
    if (chatId !== undefined) {
      editStateByChatIdRef.current[chatId] = null;
    }
    const draft =
      chatId !== undefined ? (draftByChatIdRef.current[chatId] ?? '') : '';
    setMessage(draft);
    if (editableRef.current) {
      editableRef.current.innerText = draft;
    }
  }, [setEditingMessage, chatId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !editingMessageRef.current) return;
      cancelEdit();
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [cancelEdit]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (editingMessage && chatId) {
        if (!message.trim()) return;
        setTerm('');
        setResults([]);
        const newValue = message.trim();
        updateMessageInChat(chatId, editingMessage.id, {
          value: newValue,
          edit_date: new Date().toISOString(),
        });
        cancelEdit();
        websocketManager.sendMessage({
          type: 'edit_message',
          message_id: editingMessage.id,
          chat_id: chatId,
          data: { value: newValue },
        });
        return;
      }

      if (!message.trim() && files.length === 0) return;
      setTerm('');
      setResults([]);

      try {
        if (files.length > 0) {
          const success = await sendFilesViaHttp(files, message.trim());
          if (success) {
            setFiles([]);
            setMessage('');
            if (editableRef.current) {
              editableRef.current.innerText = '';
            }
          }
        } else {
          websocketManager.sendMessage({
            type: 'chat_message',
            chat_id: chatId,
            data: {
              value: message.trim(),
              user_id:
                chatId && chatId < 0
                  ? selectedChat?.members[0]?.id || 0
                  : undefined,
            },
          });

          setMessage('');
          if (editableRef.current) {
            editableRef.current.innerText = '';
          }
        }

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    },
    [
      message,
      files,
      chatId,
      selectedChat?.members,
      sendFilesViaHttp,
      setTerm,
      setResults,
      editingMessage,
      updateMessageInChat,
      cancelEdit,
    ],
  );

  const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1 GB

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;

      const newFiles = Array.from(fileList);

      const validFiles: File[] = [];
      for (const file of newFiles) {
        if (file.size > MAX_FILE_SIZE) {
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles]);
      }

      e.target.value = '';
    },
    [MAX_FILE_SIZE],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingMessage && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancelEdit();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
        if (!isMobile) {
          e.preventDefault();
          handleSubmit(e);
        }
      }
    },
    [handleSubmit, editingMessage, cancelEdit],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();

      const text = e.clipboardData.getData('text/plain');

      if (!editableRef.current) return;

      const lines = text.split(/\r\n|\r|\n/);
      const escapeHtml = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const html = lines.map(escapeHtml).join('<br>');

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      range.deleteContents();

      const tempEl = document.createElement('div');
      tempEl.innerHTML = html;

      const frag = document.createDocumentFragment();
      let node: ChildNode | null;
      while ((node = tempEl.firstChild)) {
        frag.appendChild(node);
      }

      range.insertNode(frag);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);

      handleInput();
    },
    [handleInput],
  );

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleFiles = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const attachmentIcon = useMemo(
    () => <Icon name='Attachment' className={styles['input_attach']} />,
    [],
  );
  const sendIcon = useMemo(
    () => <Icon name='SendMobile' className={styles['send_svg']} />,
    [],
  );
  const crossIcon = useMemo(
    () => (
      <>
        <Icon name='Cross' />
      </>
    ),
    [],
  );
  const deleteIcon = useMemo(
    () => (
      <>
        <Icon name='Delete' />
        Delete
      </>
    ),
    [],
  );
  const editIcon = useMemo(
    () => <Icon name='Edit' className={styles['edit-bar-icon']} />,
    [],
  );

  const fileButtonContent = useMemo(
    () => (
      <>
        <input
          type='file'
          multiple
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        {attachmentIcon}
      </>
    ),
    [attachmentIcon, handleFileUpload],
  );

  useEffect(() => {
    editableRef.current?.blur();
  }, []);

  return (
    <>
      <DropZone onFiles={handleFiles} />
      <div className='send_area'>
        <JumpToBottom />
        {/* <Button className={styles['send_area_button']}> */}
        <div className={styles['send_div_container']}>
          {isSelectionMode ? (
            <div className={styles['selection-bar']}>
              <Button
                className={styles['selection-bar-cancel']}
                onClick={onExitSelectionMode}
                aria-label={t('sendArea.cancelSelection')}
              >
                {t('buttons.cancel')}
              </Button>
              <span className={styles['selection-bar-count']}>
                {t('sendArea.selected')} {selectedMessagesCount}
              </span>
              <Button
                className={styles['selection-bar-delete']}
                onClick={onDeleteSelectedMessages}
                disabled={selectedMessagesCount === 0}
                aria-label={t('sendArea.deleteSelected')}
              >
                {deleteIcon}
              </Button>
            </div>
          ) : (
            <>
              {files.length > 0 && (
                <FilesPreview
                  files={files}
                  onClearAll={() => setFiles([])}
                  onRemoveFile={removeFile}
                />
              )}
              <form
                className={styles['send_div']}
                encType='multipart/form-data'
                onSubmit={handleSubmit}
                ref={formRef}
              >
                <Button
                  className={styles['file_div']}
                  onClick={handleFileClick}
                  onKeyDown={(e) => e.key === 'Enter' && handleFileClick()}
                >
                  {fileButtonContent}
                </Button>

                <div className={styles['textarea_container']}>
                  {editingMessage && (
                    <div className={styles['edit-bar']}>
                      <span className={styles['edit-bar-label']}>
                        {editIcon} {t('sendArea.editingMessage')}
                      </span>
                      <Button
                        key={'send-area-cancel-edit-button'}
                        onClick={cancelEdit}
                        aria-label={t('sendArea.cancelEdit')}
                        className={styles['edit-bar-cancel']}
                        onPointerDown={(e) => {
                          e.preventDefault();
                        }}
                      >
                        {crossIcon}
                      </Button>
                    </div>
                  )}
                  <div className={styles['textarea-container']}>
                    <div
                      ref={editableRef}
                      onInput={handleInput}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      className={styles['textarea']}
                      contentEditable
                      suppressContentEditableWarning
                      spellCheck={false}
                      autoFocus={false}
                    />
                    <span
                      className={`${styles['textarea_placeholder']} ${editableRef.current?.innerText ? styles.hidden : ''}`}
                    >
                      {t('sendArea.messagePlaceholder')}
                    </span>
                  </div>
                </div>

                <Button
                  onPointerDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={handleSubmit}
                  className={`${styles['input_submit']} ${!message.trim() && files.length === 0 ? styles['input_submit--hidden'] : ''}`}
                  disabled={
                    (!message.trim() && files.length === 0) || isUploading
                  }
                  aria-label={t('aria.sendMessage')}
                >
                  {sendIcon}
                </Button>
              </form>
            </>
          )}
        </div>
        {/* </Button> */}
      </div>
    </>
  );
};

export default memo(MessageInput);
