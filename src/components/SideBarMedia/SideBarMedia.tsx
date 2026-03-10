import React, { useCallback, useRef, memo } from 'react';
import { useChatMeta, useSelectedChat, useChatMessages } from '@/contexts/ChatContextCore';
import { useToast } from '@/contexts/toast/ToastContextCore';
import { formatLastSeen } from '@/utils/activityFormatter';
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
  useTabSwipe,
  useGridPinchZoom,
  useInterlocutorEdit,
} from './hooks';

interface SideBarMediaProps {
  visible: boolean;
  onClose?: () => void;
}

const SideBarMedia: React.FC<SideBarMediaProps> = ({ onClose, visible }) => {
  const { addContact, deleteContact, saveContact } = useChatMeta();
  const { selectedChat } = useSelectedChat();
  const { messages } = useChatMessages();
  const { showToast } = useToast();

  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarInnerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
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

  useTabSwipe(gridRef, activeTab, availableTabs, setActiveTab);
  const rowScale = useGridPinchZoom(gridRef, sidebarInnerRef);

  const subtitle = React.useMemo(() => {
    if (selectedChat?.type === 'G') {
      return `${selectedChat?.info ?? ''} members`;
    }
    return formatLastSeen(selectedChat?.info ?? '');
  }, [selectedChat?.type, selectedChat?.info]);

  const interlocutor = selectedChat?.members?.[0];

  const handleCopyEmail = useCallback(async () => {
    if (!interlocutor?.email) return;
    try {
      await navigator.clipboard.writeText(interlocutor.email);
      showToast('Email copied');
    } catch (err) {
      console.error('Copy failed', err);
    }
  }, [interlocutor, showToast]);

  const handleBackOrClose = useCallback(() => {
    if (interlocutorEditVisible) {
      onInterlocutorEditBack();
    } else {
      onClose?.();
    }
  }, [interlocutorEditVisible, onInterlocutorEditBack, onClose]);

  const handleEditClick = useCallback(() => {
    if (selectedChat?.members?.[0]?.is_contact) {
      onInterlocutorEdit();
    } else {
      addContact(selectedChat!.members[0].id);
    }
  }, [selectedChat, onInterlocutorEdit, addContact]);

  const handleSaveContact = useCallback(
    (contactId: number | undefined, name: string) => {
      saveContact(contactId, name.trim());
    },
    [saveContact],
  );

  const handleDeleteContact = useCallback(
    (contactId: number | undefined) => {
      deleteContact(contactId);
      setInterlocutorEditVisible(false);
    },
    [deleteContact, setInterlocutorEditVisible],
  );

  if (!selectedChat) return null;

  const showEditButton =
    selectedChat.type === 'D' &&
    selectedChat.members != null &&
    selectedChat.members.length > 0;
  const editLabel = selectedChat.members?.[0]?.is_contact
    ? 'Edit'
    : 'Add to Contacts';

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
            filterItems={filterItems}
            effectiveFilterType={effectiveFilterType}
            onFilterChange={setFilterType}
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
                  <MembersList members={selectedChat.members ?? []} />
                )}
                {activeTab === 'media' && mediaFiles.length > 0 && (
                  <MediaGrid files={filteredMediaFiles} rowScale={rowScale} />
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
              effectiveNameLength={effectiveNameLength}
              onSave={handleSaveContact}
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
