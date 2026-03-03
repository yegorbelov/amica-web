import React, { useRef, useState, useCallback, useEffect, memo } from 'react';
import { websocketManager } from '../../utils/websocket-manager';
import {
  useSelectedChat,
  useMessagesActions,
  useEditing,
} from '../../contexts/ChatContextCore';
import styles from './SendArea.module.scss';
import { useUser } from '../../contexts/UserContextCore';
import { useSearchContext } from '@/contexts/search/SearchContextCore';
import { apiUpload } from '../../utils/apiFetch';
import { Icon } from '../Icons/AutoIcons';
import DropZone from '../DropZone/DropZone';
import JumpToBottom from '../JumpToBottom/JumpToBottom';
import Button from '../ui/button/Button';
import FilesPreview from './FilesPreview';

const MessageInput: React.FC = () => {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  /** Per-chat draft text; key = roomId */
  const draftByChatIdRef = useRef<Record<number, string>>({});
  const prevRoomIdRef = useRef<number | undefined>(undefined);

  const { selectedChat } = useSelectedChat();
  const { updateMessageInChat } = useMessagesActions();
  const { editingMessage, setEditingMessage } = useEditing();
  const { user } = useUser();
  const { setTerm, setResults } = useSearchContext();

  const roomId = selectedChat?.id;

  // Per-chat drafts: on chat switch save current to previous room, load new room's draft
  useEffect(() => {
    const prevId = prevRoomIdRef.current;
    if (prevId !== undefined && prevId !== roomId) {
      draftByChatIdRef.current[prevId] = message;
      setEditingMessage(null);
    }
    prevRoomIdRef.current = roomId;
    if (roomId !== undefined) {
      const draft = draftByChatIdRef.current[roomId] ?? '';
      setMessage(draft);
      if (editableRef.current) {
        editableRef.current.innerText = draft;
      }
    }
  }, [roomId, setEditingMessage, message]);

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
      if (!user?.id || !roomId) {
        console.error('User ID or Room ID is missing');
        return false;
      }

      const formData = new FormData();

      formData.append('message', textMessage);
      formData.append('chat_id', roomId.toString());

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
    [user?.id, roomId],
  );

  const handleInput = useCallback(() => {
    const el = editableRef.current;
    if (!el) return;
    const rawText = el.innerText || '';
    const normalizedText = rawText.replace(/\u00A0/g, ' ').trim();
    setMessage(normalizedText);
  }, []);

  useEffect(() => {
    if (!editingMessage || !roomId) return;
    // Save current draft before showing message being edited so we can restore after edit
    draftByChatIdRef.current[roomId] = message;
    const text = editingMessage.value ?? '';
    setMessage(text);
    if (editableRef.current) {
      const el = editableRef.current;
      el.innerText = text;
      el.focus();

      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, [editingMessage?.id, roomId, editingMessage, message]);

  const cancelEdit = useCallback(() => {
    setEditingMessage(null);
    const draft =
      roomId !== undefined ? (draftByChatIdRef.current[roomId] ?? '') : '';
    setMessage(draft);
    if (editableRef.current) {
      editableRef.current.innerText = draft;
    }
  }, [setEditingMessage, roomId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (editingMessage && roomId) {
        if (!message.trim()) return;
        setTerm('');
        setResults([]);
        const newValue = message.trim();
        updateMessageInChat(roomId, editingMessage.id, { value: newValue });
        cancelEdit();
        websocketManager.sendMessage({
          type: 'edit_message',
          message_id: editingMessage.id,
          chat_id: roomId,
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
            chat_id: roomId,
            data: {
              value: message.trim(),
              user_id:
                roomId && roomId < 0
                  ? selectedChat?.members[0]?.id || 0
                  : undefined,
            },
          });

          setMessage('');
          if (editableRef.current) {
            editableRef.current.innerText = '';
            editableRef.current.style.height = '20px';
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
      roomId,
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
      const html = lines.join('<br>');

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

  return (
    <>
      <JumpToBottom />
      <DropZone onFiles={handleFiles} />
      <div className={styles['send_area']}>
        <div className={styles['send_div_container']}>
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
            <button
              className={styles['file_div']}
              onClick={handleFileClick}
              type='button'
              onKeyDown={(e) => e.key === 'Enter' && handleFileClick()}
            >
              <input
                type='file'
                multiple
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                // accept='image/*,video/*,audio/*,.pdf,.doc,.docx'
              />
              <Icon name='Attachment' className={styles['input_attach']} />
            </button>

            <div className={styles['textarea_container']}>
              {editingMessage && (
                <div className={styles['edit-bar']}>
                  <span className={styles['edit-bar-label']}>
                    <Icon name='Edit' className={styles['edit-bar-icon']} />{' '}
                    Editing message
                  </span>
                  <Button
                    key={'send-area-cancel-edit-button'}
                    onClick={cancelEdit}
                    aria-label='Cancel edit'
                    className={styles['edit-bar-cancel']}
                  >
                    <Icon name='Cross' />
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
                />
                <span
                  className={`${styles['textarea_placeholder']} ${message ? styles.hidden : ''}`}
                >
                  Message
                </span>
              </div>
            </div>

            <button
              type='button'
              onPointerDown={handleSubmit}
              className={styles['input_submit']}
              disabled={(!message.trim() && files.length === 0) || isUploading}
              aria-label='Send Message'
            >
              <Icon name='SendMobile' className={styles['send_svg']} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default memo(MessageInput);
