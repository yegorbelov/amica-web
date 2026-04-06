import React, {
  useCallback,
  useRef,
  useMemo,
  memo,
  useLayoutEffect,
} from 'react';
import {
  useChatMeta,
  useSelectedChat,
  useChatMessages,
} from '@/contexts/ChatContextCore';
import { useToast } from '@/contexts/toast/ToastContextCore';
import { useTranslation } from '@/contexts/languageCore';
import { useFormatLastSeen } from '@/hooks/useFormatLastSeen';
import SideBarMediaHeader from './SideBarMediaHeader';
import SideBarAvatarSection from './SideBarAvatarSection';
import SideBarInfoSection from './SideBarInfoSection';
import SideBarTabs from './SideBarTabs';
import MembersList from './MembersList';
import MediaGrid from './MediaGrid';
import AudioGrid from './AudioGrid';
import InterlocutorEditForm from './InterlocutorEditForm';
import styles from './SideBarMedia.module.scss';
import {
  useSideBarMediaData,
  useStickyTabs,
  useAvatarRoller,
  // useTabSwipe,
  useGridPinchZoom,
  useInterlocutorEdit,
} from './hooks';

interface SideBarMediaProps {
  visible: boolean;
  onClose?: () => void;
}

const FILTER_LABEL_KEYS: Record<string, string> = {
  All: 'sidebar.filterAll',
  Videos: 'sidebar.filterVideos',
  Photos: 'sidebar.filterPhotos',
};

const SideBarMedia: React.FC<SideBarMediaProps> = ({ onClose, visible }) => {
  const { t } = useTranslation();
  const { formatLastSeen } = useFormatLastSeen();
  const { addContact, deleteContact, saveContact } = useChatMeta();
  const { selectedChat } = useSelectedChat();
  const { messages } = useChatMessages();
  const { showToast } = useToast();

  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarInnerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const mediaGridRef = useRef<HTMLDivElement>(null);
  const membersRef = useRef<HTMLButtonElement>(null);
  const mediaRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLButtonElement>(null);

  const chatId = selectedChat?.id != null ? String(selectedChat.id) : '';

  const attachmentsActive = useStickyTabs(tabsRef);

  const {
    mediaFiles,
    audioFiles,
    setFilterType,
    filterItems,
    effectiveFilterType,
    filteredMediaFiles,
    availableTabs,
    activeTab,
    setActiveTab,
  } = useSideBarMediaData(
    messages,
    selectedChat?.type ?? 'D',
    selectedChat?.id,
  );

  const {
    nameEditRef,
    editValue,
    setValue,
    effectiveNameLength,
    visibleName,
    interlocutorEditVisible,
    setInterlocutorEditVisible,
    onInterlocutorEditBack,
    onInterlocutorEdit,
    handleNameEditInput,
    handleNameEditBeforeInput,
    handleNameEditKeyDown,
  } = useInterlocutorEdit(chatId, selectedChat?.name ?? '');

  const {
    isAvatarRollerOpen,
    setIsAvatarRollerOpen,
    effectiveRollPosition,
    handleRollPositionChange,
  } = useAvatarRoller(
    chatId,
    selectedChat?.media?.length ?? 0,
    !!selectedChat?.primary_media,
    sidebarInnerRef,
    interlocutorEditVisible,
  );

  // useTabSwipe(gridRef, activeTab, availableTabs, setActiveTab);
  const gridAttachKey = useMemo(
    () => (selectedChat != null ? `${selectedChat.id}-${activeTab}` : 'none'),
    [selectedChat, activeTab],
  );
  const { currentColumns, liveScale, zoomOriginX, zoomOriginY, isZooming } =
    useGridPinchZoom(
      gridRef,
      sidebarInnerRef,
      gridAttachKey,
      mediaGridRef,
      filteredMediaFiles.length,
    );
  const mediaRectsRef = useRef<Map<string, DOMRect>>(new Map());

  const filterItemsTranslated = useMemo(
    () =>
      filterItems.map((item) => ({
        ...item,
        label: t(FILTER_LABEL_KEYS[item.label] ?? 'sidebar.filterAll'),
        filterKey: item.label,
      })),
    [filterItems, t],
  );

  const effectiveFilterTypeTranslated = t(
    FILTER_LABEL_KEYS[effectiveFilterType] ?? 'sidebar.filterAll',
  );

  const handleFilterChange = useCallback(
    (filterKey: string) => setFilterType(filterKey),
    [setFilterType],
  );

  const subtitle = useMemo(() => {
    if (selectedChat?.type === 'G') {
      return `${selectedChat?.info ?? ''} ${t('sidebar.membersCount')}`;
    }
    return formatLastSeen(selectedChat?.info ?? '');
  }, [selectedChat?.type, selectedChat?.info, t, formatLastSeen]);

  const interlocutor = selectedChat?.members?.[0];

  const handleCopyEmail = useCallback(async () => {
    if (!interlocutor?.email) return;
    try {
      await navigator.clipboard.writeText(interlocutor.email);
      showToast(t('toast.emailCopied'));
    } catch (err) {
      console.error('Copy failed', err);
    }
  }, [interlocutor, showToast, t]);

  const handleBackOrClose = useCallback(() => {
    if (interlocutorEditVisible) {
      onInterlocutorEditBack();
    } else {
      onClose?.();
    }
  }, [interlocutorEditVisible, onInterlocutorEditBack, onClose]);

  const handleSaveContact = useCallback(
    (contactId: number | undefined, name: string) => {
      saveContact(contactId, name.trim());
    },
    [saveContact],
  );

  const handleEditClick = useCallback(() => {
    if (interlocutorEditVisible) {
      const canSave = effectiveNameLength > 0 && effectiveNameLength <= 64;
      if (canSave) {
        handleSaveContact(interlocutor?.contact_id, editValue);
        setInterlocutorEditVisible(false);
      }
    } else if (selectedChat?.members?.[0]?.is_contact) {
      onInterlocutorEdit();
    } else {
      addContact(selectedChat!.members[0].id);
    }
  }, [
    interlocutorEditVisible,
    effectiveNameLength,
    selectedChat,
    interlocutor?.contact_id,
    editValue,
    handleSaveContact,
    setInterlocutorEditVisible,
    onInterlocutorEdit,
    addContact,
  ]);

  const handleDeleteContact = useCallback(
    (contactId: number | undefined) => {
      deleteContact(contactId);
      setInterlocutorEditVisible(false);
    },
    [deleteContact, setInterlocutorEditVisible],
  );

  useLayoutEffect(() => {
    if (!selectedChat) return;
    if (activeTab !== 'media') return;
    const root = gridRef.current;
    if (!root) return;
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>('[data-media-id]'),
    );
    const nextRects = new Map<string, DOMRect>();
    for (const node of nodes) {
      const id = node.dataset.mediaId;
      if (id) {
        nextRects.set(id, node.getBoundingClientRect());
      }
    }

    const prevRects = mediaRectsRef.current;
    for (const node of nodes) {
      const id = node.dataset.mediaId;
      if (!id) continue;
      const prevRect = prevRects.get(id);
      const nextRect = nextRects.get(id);
      if (!prevRect || !nextRect) continue;

      const deltaX = prevRect.left - nextRect.left;
      const deltaY = prevRect.top - nextRect.top;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) continue;

      node.classList.add(styles.mediaWrapperFlipping);
      node.style.transition = 'none';
      node.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      node.getBoundingClientRect();
      node.style.transition = '';
      node.style.transform = '';

      const clearFlip = () => {
        node.classList.remove(styles.mediaWrapperFlipping);
        node.removeEventListener('transitionend', clearFlip);
      };
      node.addEventListener('transitionend', clearFlip);
    }

    mediaRectsRef.current = nextRects;
  }, [selectedChat, activeTab, currentColumns, filteredMediaFiles]);

  if (!selectedChat) return null;

  const showEditButton =
    selectedChat.type === 'D' &&
    selectedChat.members != null &&
    selectedChat.members.length > 0;
  const editLabel = selectedChat.members?.[0]?.is_contact
    ? t('sidebar.edit')
    : t('sidebar.addToContacts');

  return (
    <div
      className={`${styles.container} ${visible ? styles.visible : ''}`}
      ref={sidebarRef}
    >
      <div className={styles.content}>
        <div
          className={
            styles.mask + ' ' + (attachmentsActive ? styles.visible : '')
          }
        />
        <div
          className={
            styles.maskBlur + ' ' + (attachmentsActive ? styles.visible : '')
          }
        />
        <div className={styles.sidebar} ref={sidebarInnerRef}>
          <SideBarMediaHeader
            onBackOrClose={handleBackOrClose}
            showEditButton={!!showEditButton}
            onEditClick={handleEditClick}
            editLabel={editLabel}
            attachmentsActive={attachmentsActive}
            showFilterDropdown={activeTab === 'media'}
            interlocutorEditVisible={interlocutorEditVisible}
            saveDisabled={effectiveNameLength === 0 || effectiveNameLength > 64}
            filterItems={filterItemsTranslated}
            effectiveFilterType={effectiveFilterTypeTranslated}
            onFilterChange={handleFilterChange}
          />

          <SideBarAvatarSection
            chatId={selectedChat.id}
            chatName={selectedChat.name ?? ''}
            primaryMedia={selectedChat.primary_media}
            media={selectedChat.media}
            interlocutorContactId={interlocutor?.contact_id}
            isAvatarRollerOpen={isAvatarRollerOpen}
            interlocutorEditVisible={interlocutorEditVisible}
            effectiveRollPosition={effectiveRollPosition}
            onRollPositionChange={handleRollPositionChange}
            onAvatarRollerOpen={() => setIsAvatarRollerOpen(true)}
          />

          <SideBarInfoSection
            tabsRef={tabsRef}
            nameEditRef={nameEditRef}
            visibleName={visibleName}
            subtitle={subtitle}
            interlocutorEditVisible={interlocutorEditVisible}
            effectiveNameLength={effectiveNameLength}
            onNameEditInput={handleNameEditInput}
            onNameEditBeforeInput={handleNameEditBeforeInput}
            onNameEditKeyDown={handleNameEditKeyDown}
            showEmail={selectedChat.type === 'D'}
            email={interlocutor?.email}
            onCopyEmail={handleCopyEmail}
          />

          {availableTabs.length > 0 && (
            <div
              className={`${styles['sidebar__media']} ${
                interlocutorEditVisible ? styles.hidden : ''
              }`}
            >
              <SideBarTabs
                activeTab={activeTab}
                availableTabs={availableTabs}
                onTabChange={setActiveTab}
                membersRef={membersRef}
                mediaRef={mediaRef}
                audioRef={audioRef}
                selectedChatType={selectedChat.type}
                hasMembers={!!selectedChat.members?.length}
                mediaFilesCount={mediaFiles.length}
                audioFilesCount={audioFiles.length}
              />

              <div className={styles.content} ref={gridRef}>
                {activeTab === 'members' && selectedChat.type === 'G' && (
                  <MembersList
                    chatId={selectedChat.id}
                    members={selectedChat.members ?? []}
                  />
                )}
                {activeTab === 'media' && mediaFiles.length > 0 && (
                  <MediaGrid
                    ref={mediaGridRef}
                    files={filteredMediaFiles}
                    rowScale={currentColumns}
                    className={styles.singleZoomGrid}
                    style={{
                      transform: `scale(${liveScale})`,
                      transformOrigin:
                        zoomOriginX != null && zoomOriginY != null
                          ? `${zoomOriginX}px ${zoomOriginY}px`
                          : 'center center',
                      transition: isZooming
                        ? 'none'
                        : 'transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1)',
                    }}
                  />
                )}
                {activeTab === 'audio' && audioFiles.length > 0 && (
                  <AudioGrid files={audioFiles} />
                )}
              </div>
            </div>
          )}

          {interlocutorEditVisible && (
            <InterlocutorEditForm
              chatType={selectedChat.type}
              editValue={editValue}
              onValueChange={setValue}
              onDelete={handleDeleteContact}
              contactId={interlocutor?.contact_id}
              originalUsername={interlocutor?.username}
              displayName={selectedChat.name ?? undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(SideBarMedia);
