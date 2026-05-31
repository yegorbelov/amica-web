import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { JWTVideo } from '@/components/Message/JWTVideo';
import { useAudio } from '@/contexts/audioContext';
import {
  clampPip,
  cornerPosition,
  PIP_MARGIN,
  pickCorner,
  resolvePipSize,
  type PipCorner,
  type PipSize,
} from '@/utils/videoPip';
import styles from './MediaVideoPiP.module.scss';

export function MediaVideoPiP() {
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const {
    showVideoPiP,
    mediaType,
    currentMediaId,
    playlist,
    isMuted,
    isPlaying,
    registerPipVideo,
  } = useAudio();

  const [corner, setCorner] = useState<PipCorner>('bottom-right');
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [metadataPipSize, setMetadataPipSize] = useState<{
    mediaId: number;
    size: PipSize;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const isActive = mediaType === 'video' && currentMediaId != null;

  const file = isActive
    ? playlist?.find((item) => item.id === currentMediaId)
    : undefined;
  const url = file?.file_url ?? '';

  const filePipSize = useMemo(
    () => resolvePipSize(file?.width, file?.height),
    [file?.width, file?.height],
  );

  const pipSize =
    metadataPipSize?.mediaId === currentMediaId
      ? metadataPipSize.size
      : filePipSize;

  const anchoredPosition = useMemo(() => {
    void viewportSize;
    return cornerPosition(corner, pipSize);
  }, [corner, pipSize, viewportSize]);

  const position = dragPosition ?? anchoredPosition;

  useLayoutEffect(() => {
    if (!isActive) {
      registerPipVideo(null);
      return () => registerPipVideo(null);
    }

    registerPipVideo(pipVideoRef.current);
    return () => registerPipVideo(null);
  }, [registerPipVideo, isActive, currentMediaId]);

  useEffect(() => {
    const video = pipVideoRef.current;
    if (!video || currentMediaId == null) return;

    const syncFromMetadata = () => {
      if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
      setMetadataPipSize({
        mediaId: currentMediaId,
        size: resolvePipSize(video.videoWidth, video.videoHeight),
      });
    };

    video.addEventListener('loadedmetadata', syncFromMetadata);
    return () => video.removeEventListener('loadedmetadata', syncFromMetadata);
  }, [url, currentMediaId]);

  useEffect(() => {
    if (!showVideoPiP) return;

    const onResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [showVideoPiP]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!showVideoPiP) return;
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setDragPosition({ left: rect.left, top: rect.top });
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setDragPosition({
      left: clampPip(
        e.clientX - dragOffsetRef.current.x,
        PIP_MARGIN,
        window.innerWidth - pipSize.width - PIP_MARGIN,
      ),
      top: clampPip(
        e.clientY - dragOffsetRef.current.y,
        PIP_MARGIN,
        window.innerHeight - pipSize.height - PIP_MARGIN,
      ),
    });
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nextCorner = pickCorner(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    setCorner(nextCorner);
    setDragPosition(null);
    setIsDragging(false);
  };

  if (!isActive) return null;

  return (
    <div
      className={[
        styles.pip,
        !showVideoPiP && styles.pipHidden,
        isDragging && styles.pipDragging,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: position.left,
        top: position.top,
        width: pipSize.width,
        height: pipSize.height,
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      aria-hidden={!showVideoPiP}
      aria-label='Video preview'
    >
      <JWTVideo
        key={currentMediaId}
        ref={pipVideoRef}
        url={url}
        muted={isMuted}
        playing={isPlaying}
        loop={false}
        autoPlay={false}
        externallyControlled
      />
    </div>
  );
}
