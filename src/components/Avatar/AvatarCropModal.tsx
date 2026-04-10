import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react';
import ReactDOM from 'react-dom';
import styles from './AvatarCropModal.module.scss';
import { apiUpload } from '@/utils/apiFetch';
import type { DisplayMedia } from '@/types';

const MAX_CLIP_SEC = 10;

/** `captureStream` exists in browsers but may be missing from DOM typings. */
type HTMLVideoElementWithCapture = HTMLVideoElement & {
  captureStream?: () => MediaStream;
};

interface AvatarCropModalProps {
  file: globalThis.File;
  type: 'photo' | 'video';
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (file: DisplayMedia | null) => void;
  objectId: number;
  contentType: string;
}

type Edge =
  | 'inside'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'
  | null;

export default function AvatarCropModal({
  file,
  type,
  isOpen,
  onClose,
  onUploadSuccess,
  objectId,
  contentType,
}: AvatarCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(new Image());
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const needsRedrawRef = useRef(false);
  const imgPosRef = useRef({ x: 0, y: 0 });
  const imgScaleRef = useRef(1);
  const isDraggingRef = useRef(false);
  const isTimelineWindowDraggingRef = useRef(false);

  const [selection, setSelection] = useState({ x: 150, y: 150, size: 200 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgPos, setImgPos] = useState({ x: 0, y: 0 });
  const [imgScale, setImgScale] = useState(1);
  const [canvasWidth, setCanvasWidth] = useState(400);
  const [cursor, setCursor] = useState('default');
  const [activeEdge, setActiveEdge] = useState<Edge>(null);

  const CANVAS_HEIGHT = 400;
  const MIN_SIZE = 100;
  const MIN_WIDTH = MIN_SIZE;
  const HANDLE_SIZE = 20;
  const CORNER_RADIUS = 4;
  const DETECT_B = 12;
  const MAX_SIZE = 400;
  const LINEWIDTH = 3;
  const FRAME = LINEWIDTH;

  const selectionRef = useRef({ x: 0, y: 0, size: 200 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const activeEdgeRef = useRef<Edge>(null);

  const ratioRef = useRef<number>(window.devicePixelRatio || 1);
  const getRatio = useCallback(() => ratioRef.current, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRafRef = useRef(0);
  const segmentPreviewActiveRef = useRef(false);
  const trimDefaultsAppliedRef = useRef(false);

  const [videoDuration, setVideoDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [clipLength, setClipLength] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isSegmentPlaying, setIsSegmentPlaying] = useState(false);
  const [previewPlayheadTime, setPreviewPlayheadTime] = useState<number | null>(
    null,
  );

  const timelineRef = useRef<HTMLDivElement>(null);
  const videoDurationRef = useRef(0);
  const trimWindowDragPointerIdRef = useRef<number | null>(null);
  const trimWindowDragStartClientXRef = useRef(0);
  const trimWindowDragInitialStartRef = useRef(0);
  const trimWindowDragLengthRef = useRef(0);

  const applyMediaLayout = useCallback(
    (naturalWidth: number, naturalHeight: number) => {
      const scale = CANVAS_HEIGHT / naturalHeight;
      let width = naturalWidth * scale;

      if (width < MIN_WIDTH) {
        width = MIN_WIDTH;
      }

      const autoSize = Math.max(MIN_SIZE, Math.min(400, width, CANVAS_HEIGHT));

      const x = (width - naturalWidth * scale) / 2;
      const y = (CANVAS_HEIGHT - naturalHeight * scale) / 2;

      imgScaleRef.current = scale;
      imgPosRef.current = { x, y };
      selectionRef.current = {
        x: (width - autoSize) / 2,
        y: (CANVAS_HEIGHT - autoSize) / 2,
        size: autoSize,
      };

      setImgScale(scale);
      setCanvasWidth(width);
      setImgPos(imgPosRef.current);
      setSelection(selectionRef.current);
    },
    [MIN_WIDTH],
  );

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    selectionRef.current = selection;
    offsetRef.current = offset;
    activeEdgeRef.current = activeEdge;
    imgPosRef.current = imgPos;
    imgScaleRef.current = imgScale;
  }, [selection, offset, activeEdge, imgPos, imgScale]);

  useEffect(() => {
    videoDurationRef.current = videoDuration;
  }, [videoDuration]);

  useEffect(() => {
    if (!isOpen || !file || type !== 'photo') return;

    const url = URL.createObjectURL(file);
    const img = imageRef.current;
    img.src = url;

    img.onload = () => {
      applyMediaLayout(img.width, img.height);
    };

    return () => {
      URL.revokeObjectURL(url);
      img.onload = null;
    };
  }, [file, isOpen, type, applyMediaLayout]);

  useEffect(() => {
    if (!isOpen || type !== 'video') return;

    trimDefaultsAppliedRef.current = false;
    setVideoDuration(0);
    setTrimStart(0);
    setClipLength(0);
    setPreviewPlayheadTime(null);
  }, [isOpen, type, file]);

  useEffect(() => {
    if (!isOpen || !file || type !== 'video') return;

    const v = videoRef.current;
    if (!v) return;

    const url = URL.createObjectURL(file);
    v.src = url;
    v.preload = 'auto';

    const readDuration = () => {
      const dur = v.duration;
      return Number.isFinite(dur) && dur > 0 ? dur : 0;
    };

    const applyVideoTiming = () => {
      const dur = readDuration();
      if (dur <= 0) return;

      setVideoDuration(dur);

      if (!trimDefaultsAppliedRef.current) {
        trimDefaultsAppliedRef.current = true;
        setTrimStart(0);
        setClipLength(Math.min(MAX_CLIP_SEC, dur));
      }
    };

    const onLoaded = () => {
      applyMediaLayout(v.videoWidth, v.videoHeight);
      applyVideoTiming();
    };

    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('durationchange', applyVideoTiming);

    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('durationchange', applyVideoTiming);
      URL.revokeObjectURL(url);
      v.src = '';
      v.load();
      setVideoDuration(0);
      setIsSegmentPlaying(false);
      segmentPreviewActiveRef.current = false;
    };
  }, [file, isOpen, type, applyMediaLayout]);

  const getNaturalMediaSize = useCallback(() => {
    if (type === 'video' && videoRef.current) {
      const v = videoRef.current;
      return { w: v.videoWidth, h: v.videoHeight };
    }
    const img = imageRef.current;
    return { w: img.width, h: img.height };
  }, [type]);

  const createMask = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = getRatio();
    const totalWidth = canvas.width / ratio;
    const totalHeight = canvas.height / ratio;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskCtx = maskCanvas.getContext('2d')!;

    maskCtx.scale(ratio, ratio);

    maskCtx.clearRect(0, 0, totalWidth, totalHeight);

    maskCtx.fillStyle = 'rgba(0,0,0,0.6)';
    const { w: nw, h: nh } = getNaturalMediaSize();
    if (nw === 0 || nh === 0) return;

    const imgWidth = nw * imgScaleRef.current;
    const imgHeight = nh * imgScaleRef.current;

    maskCtx.fillRect(
      FRAME + imgPosRef.current.x,
      FRAME + imgPosRef.current.y,
      imgWidth,
      imgHeight,
    );

    const sel = selectionRef.current;
    const cx = FRAME + sel.x + sel.size / 2;
    const cy = FRAME + sel.y + sel.size / 2;
    const radius = sel.size / 2;

    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.beginPath();
    maskCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    maskCtx.fill();

    maskCtx.globalCompositeOperation = 'source-over';

    maskCanvasRef.current = maskCanvas;
  }, [getRatio, FRAME, getNaturalMediaSize]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;

    const ctx = canvas.getContext('2d')!;
    const ratio = getRatio();

    ctx.resetTransform();
    ctx.clearRect(-10, -10, canvas.width + 20, canvas.height + 20);

    ctx.setTransform(ratio, 0, 0, ratio, FRAME * ratio, FRAME * ratio);

    const { w: nw, h: nh } = getNaturalMediaSize();
    if (nw > 0 && nh > 0) {
      const imgWidth = nw * imgScaleRef.current;
      const imgHeight = nh * imgScaleRef.current;
      const dx = imgPosRef.current.x;
      const dy = imgPosRef.current.y;

      if (type === 'video' && videoRef.current) {
        const v = videoRef.current;
        if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          ctx.drawImage(v, dx, dy, imgWidth, imgHeight);
        }
      } else {
        const img = imageRef.current;
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, dx, dy, imgWidth, imgHeight);
        }
      }
    }

    createMask();
    if (maskCanvasRef.current) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(maskCanvasRef.current!, 0, 0);
      ctx.restore();
    }

    const sel = selectionRef.current;
    const handleSize = HANDLE_SIZE;
    const cornerRadius = CORNER_RADIUS;
    ctx.fillStyle = '#fff';
    const o = LINEWIDTH;

    // Top-left horizontal
    ctx.beginPath();
    ctx.roundRect(sel.x - o, sel.y - o, handleSize, LINEWIDTH, cornerRadius);
    ctx.fill();

    // Top-left vertical
    ctx.beginPath();
    ctx.roundRect(sel.x - o, sel.y - o, LINEWIDTH, handleSize, cornerRadius);
    ctx.fill();

    // Top-right
    ctx.beginPath();
    ctx.roundRect(
      sel.x + sel.size - handleSize + o,
      sel.y - o,
      handleSize,
      LINEWIDTH,
      cornerRadius,
    );
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(
      sel.x + sel.size,
      sel.y - o,
      LINEWIDTH,
      handleSize,
      cornerRadius,
    );
    ctx.fill();

    // Bottom-left
    ctx.beginPath();
    ctx.roundRect(
      sel.x - o,
      sel.y + sel.size,
      handleSize,
      LINEWIDTH,
      cornerRadius,
    );
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(
      sel.x - o,
      sel.y + sel.size - handleSize + o,
      LINEWIDTH,
      handleSize,
      cornerRadius,
    );
    ctx.fill();

    // Bottom-right
    ctx.beginPath();
    ctx.roundRect(
      sel.x + sel.size - handleSize + o,
      sel.y + sel.size,
      handleSize,
      LINEWIDTH,
      cornerRadius,
    );
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(
      sel.x + sel.size,
      sel.y + sel.size - handleSize + o,
      LINEWIDTH,
      handleSize,
      cornerRadius,
    );
    ctx.fill();
  }, [FRAME, createMask, getRatio, getNaturalMediaSize, isOpen, type]);

  const rafLoop = useCallback(
    function rafLoopInner() {
      if (!needsRedrawRef.current) {
        rafRef.current = 0;
        return;
      }
      drawCanvas();
      needsRedrawRef.current = false;
      rafRef.current = requestAnimationFrame(rafLoopInner);
    },
    [drawCanvas],
  );

  const scheduleRedraw = useCallback(() => {
    needsRedrawRef.current = true;
    if (!rafRef.current && canvasRef.current) {
      rafRef.current = requestAnimationFrame(rafLoop);
    }
  }, [rafLoop]);

  const detectEdge = useCallback((x: number, y: number): Edge => {
    const sel = selectionRef.current;
    const b = DETECT_B + LINEWIDTH;

    const topLeftZone =
      x >= sel.x - 2 && x <= sel.x + b && y >= sel.y - 2 && y <= sel.y + b;
    const topRightZone =
      x >= sel.x + sel.size - b &&
      x <= sel.x + sel.size + 2 &&
      y >= sel.y - 2 &&
      y <= sel.y + b;
    const bottomLeftZone =
      x >= sel.x - 2 &&
      x <= sel.x + b &&
      y >= sel.y + sel.size - b &&
      y <= sel.y + sel.size + 2;
    const bottomRightZone =
      x >= sel.x + sel.size - b &&
      x <= sel.x + sel.size + 2 &&
      y >= sel.y + sel.size - b &&
      y <= sel.y + sel.size + 2;

    const isInsideCrop =
      x >= sel.x &&
      x <= sel.x + sel.size &&
      y >= sel.y &&
      y <= sel.y + sel.size;

    if (topLeftZone) return 'topLeft';
    if (topRightZone) return 'topRight';
    if (bottomLeftZone) return 'bottomLeft';
    if (bottomRightZone) return 'bottomRight';

    if (isInsideCrop) return 'inside';

    return null;
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ratio = getRatio();
    const totalWidth = canvasWidth + FRAME * 2;
    const totalHeight = CANVAS_HEIGHT + FRAME * 2;

    if (
      canvas.width !== totalWidth * ratio ||
      canvas.height !== totalHeight * ratio
    ) {
      canvas.width = totalWidth * ratio;
      canvas.height = totalHeight * ratio;

      requestAnimationFrame(() => drawCanvas());
    }
  }, [isOpen, canvasWidth, FRAME, drawCanvas, getRatio]);

  useLayoutEffect(() => {
    if (!isOpen || !canvasRef.current || !canvasWrapRef.current) return;

    const canvas = canvasRef.current;
    const wrap = canvasWrapRef.current;
    const totalWidth = canvasWidth + FRAME * 2;
    const totalHeight = CANVAS_HEIGHT + FRAME * 2;

    const applyDisplayScale = () => {
      const avail = wrap.clientWidth;
      if (avail <= 0 || totalWidth <= 0) return;
      const scale = Math.min(1, avail / totalWidth);
      canvas.style.width = `${totalWidth * scale}px`;
      canvas.style.height = `${totalHeight * scale}px`;
    };

    applyDisplayScale();
    const ro = new ResizeObserver(applyDisplayScale);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [isOpen, canvasWidth, FRAME]);

  const canvasClientToLogical = useCallback(
    (rect: DOMRect, clientX: number, clientY: number) => {
      const totalW = canvasWidth + FRAME * 2;
      const totalH = CANVAS_HEIGHT + FRAME * 2;
      if (rect.width <= 0 || rect.height <= 0) {
        return { x: -FRAME, y: -FRAME };
      }
      const sx = totalW / rect.width;
      const sy = totalH / rect.height;
      return {
        x: (clientX - rect.left) * sx - FRAME,
        y: (clientY - rect.top) * sy - FRAME,
      };
    },
    [canvasWidth, FRAME],
  );

  useEffect(() => {
    if (!isOpen || type !== 'video') return;

    const tick = () => {
      scheduleRedraw();
      previewRafRef.current = requestAnimationFrame(tick);
    };
    previewRafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = 0;
    };
  }, [isOpen, type, scheduleRedraw]);

  useEffect(() => {
    if (!isSegmentPlaying || type !== 'video') return;

    const v = videoRef.current;
    let raf = 0;

    const tick = () => {
      if (v) setPreviewPlayheadTime(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [isSegmentPlaying, type]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || type !== 'video' || !isOpen) return;
    if (segmentPreviewActiveRef.current || isExporting) return;

    if (Math.abs(v.currentTime - trimStart) < 0.03) return;

    v.pause();
    const onSeeked = () => {
      v.removeEventListener('seeked', onSeeked);
      scheduleRedraw();
    };
    v.addEventListener('seeked', onSeeked);
    v.currentTime = trimStart;
  }, [trimStart, clipLength, type, isOpen, isExporting, scheduleRedraw]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, []);

  const trimEnd = Math.min(videoDuration, trimStart + clipLength);
  const hasValidClip = trimEnd - trimStart > 0.01;

  const endTrimWindowDrag = useCallback((e?: React.PointerEvent) => {
    const pid = trimWindowDragPointerIdRef.current;
    if (pid != null && timelineRef.current) {
      try {
        timelineRef.current.releasePointerCapture(pid);
      } catch {
        /* already released */
      }
    }
    trimWindowDragPointerIdRef.current = null;
    isTimelineWindowDraggingRef.current = false;
    e?.stopPropagation();
  }, []);

  const onTrimWindowPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isExporting || isSegmentPlaying || !hasValidClip) return;
      e.preventDefault();
      e.stopPropagation();
      const len = trimEnd - trimStart;
      if (len <= 0.01) return;

      const el = timelineRef.current;
      if (!el) return;

      trimWindowDragPointerIdRef.current = e.pointerId;
      trimWindowDragStartClientXRef.current = e.clientX;
      trimWindowDragInitialStartRef.current = trimStart;
      trimWindowDragLengthRef.current = len;
      isTimelineWindowDraggingRef.current = true;
      el.setPointerCapture(e.pointerId);
    },
    [
      isExporting,
      isSegmentPlaying,
      hasValidClip,
      trimStart,
      trimEnd,
    ],
  );

  const onTrimWindowPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (trimWindowDragPointerIdRef.current !== e.pointerId) return;
      e.stopPropagation();
      const el = timelineRef.current;
      if (!el) return;
      const w = el.getBoundingClientRect().width;
      if (w <= 0) return;

      const dur = videoDurationRef.current;
      const len = trimWindowDragLengthRef.current;
      const deltaT =
        ((e.clientX - trimWindowDragStartClientXRef.current) / w) * dur;
      let newStart = trimWindowDragInitialStartRef.current + deltaT;
      newStart = Math.max(0, Math.min(newStart, dur - len));
      setTrimStart(newStart);
      setClipLength(len);
    },
    [],
  );

  const trackStartPct =
    videoDuration > 0 ? (Math.max(0, trimStart) / videoDuration) * 100 : 0;
  const trackEndPct =
    videoDuration > 0 ? (Math.max(0, trimEnd) / videoDuration) * 100 : 0;

  const handleTrimStartChange = useCallback(
    (rawStart: number) => {
      const dur = videoDuration;
      const currentEnd = Math.min(dur, trimStart + clipLength);
      const t = Math.max(0, Math.min(rawStart, dur));
      const maxStart = Math.min(currentEnd, dur);
      const minStart = Math.max(0, currentEnd - MAX_CLIP_SEC);
      const nextStart = Math.min(maxStart, Math.max(minStart, t));
      setTrimStart(nextStart);
      setClipLength(Math.max(0, currentEnd - nextStart));
    },
    [videoDuration, trimStart, clipLength],
  );

  const handleTrimEndChange = useCallback(
    (rawEnd: number) => {
      const dur = videoDuration;
      const e = Math.max(0, Math.min(rawEnd, dur));
      const minEnd = trimStart;
      const maxEnd = Math.min(dur, trimStart + MAX_CLIP_SEC);
      const nextEnd = Math.min(maxEnd, Math.max(minEnd, e));
      setClipLength(nextEnd - trimStart);
    },
    [videoDuration, trimStart],
  );

  const stopInnerPointerEvent = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      e.stopPropagation();
    },
    [],
  );

  const stopInnerClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
  }, []);

  const exportTrimmedCroppedVideo = useCallback(async (): Promise<Blob> => {
    const video = videoRef.current;
    if (!video) throw new Error('No video');

    const sel = selectionRef.current;
    const sx = (sel.x - imgPosRef.current.x) / imgScaleRef.current;
    const sy = (sel.y - imgPosRef.current.y) / imgScaleRef.current;
    const sw = sel.size / imgScaleRef.current;
    const outSize = Math.max(1, Math.round(sel.size));

    const out = document.createElement('canvas');
    out.width = outSize;
    out.height = outSize;
    const octx = out.getContext('2d')!;
    if (!octx) throw new Error('No 2d context');

    const fps = 30;
    const canvasStream = out.captureStream(fps);
    let audioStream: MediaStream | null;
    try {
      const cap = (video as HTMLVideoElementWithCapture).captureStream;
      audioStream = typeof cap === 'function' ? cap.call(video) : null;
    } catch {
      audioStream = null;
    }
    const audioTrack = audioStream?.getAudioTracks()[0];
    if (audioTrack) canvasStream.addTrack(audioTrack);

    const mimeCandidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    const mime =
      mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ??
      'video/webm';

    const wasMuted = video.muted;
    video.muted = false;

    await new Promise<void>((resolveSeek, rejectSeek) => {
      if (Math.abs(video.currentTime - trimStart) < 0.03) {
        resolveSeek();
        return;
      }

      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        resolveSeek();
      };
      const onError = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        rejectSeek(new Error('Video load error'));
      };
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError, { once: true });
      try {
        video.currentTime = trimStart;
      } catch (e) {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        rejectSeek(e instanceof Error ? e : new Error(String(e)));
      }
    });

    try {
      octx.drawImage(video, sx, sy, sw, sw, 0, 0, outSize, outSize);
    } catch (e) {
      video.muted = wasMuted;
      throw e instanceof Error ? e : new Error(String(e));
    }

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(canvasStream, {
      mimeType: mime,
      videoBitsPerSecond: 2_500_000,
    });

    const endTime = trimEnd;

    const blob = await new Promise<Blob>((resolveBlob, rejectBlob) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onerror = () => {
        video.muted = wasMuted;
        rejectBlob(new Error('MediaRecorder error'));
      };
      recorder.onstop = () => {
        video.muted = wasMuted;
        resolveBlob(new Blob(chunks, { type: mime }));
      };

      let raf = 0;

      const finish = () => {
        cancelAnimationFrame(raf);
        video.pause();
        try {
          recorder.stop();
        } catch {
          /* already stopped */
        }
      };

      const drawFrame = () => {
        if (video.currentTime >= endTime - 0.04 || video.ended) {
          finish();
          return;
        }
        try {
          octx.drawImage(video, sx, sy, sw, sw, 0, 0, outSize, outSize);
        } catch {
          finish();
          return;
        }
        raf = requestAnimationFrame(drawFrame);
      };

      try {
        recorder.start(100);
      } catch (e) {
        video.muted = wasMuted;
        rejectBlob(e instanceof Error ? e : new Error(String(e)));
        return;
      }

      video
        .play()
        .then(() => {
          raf = requestAnimationFrame(drawFrame);
        })
        .catch((e) => {
          video.muted = wasMuted;
          rejectBlob(e instanceof Error ? e : new Error(String(e)));
        });
    });

    return blob;
  }, [trimStart, trimEnd]);

  const handleUpload = useCallback(async () => {
    if (type === 'video') {
      setIsExporting(true);
      try {
        const blob = await exportTrimmedCroppedVideo();
        if (!blob.size) {
          console.error('Video export produced an empty file');
          return;
        }
        const base =
          file.name.replace(/\.[^/.]+$/, '') || 'avatar-clip';
        const outFile = new globalThis.File([blob], `${base}.webm`, {
          type: blob.type || 'video/webm',
        });
        const formData = new FormData();
        formData.append('file', outFile);

        const data = (await apiUpload(
          `/api/media_files/primary-media/?content_type=${contentType}&object_id=${objectId}`,
          formData,
        )) as DisplayMedia;

        if (data) onUploadSuccess(data);
        onClose();
      } catch (e) {
        console.error('Video export/upload failed:', e);
      } finally {
        setIsExporting(false);
      }

      return;
    } else {
      const sel = selectionRef.current;
      const img = imageRef.current;

      const sx = (sel.x - imgPosRef.current.x) / imgScaleRef.current;
      const sy = (sel.y - imgPosRef.current.y) / imgScaleRef.current;
      const sSize = sel.size / imgScaleRef.current;

      const canvas = document.createElement('canvas');
      canvas.width = sSize;
      canvas.height = sSize;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, sSize, sSize);

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b as Blob), 'image/webp', 1),
      );

      const formData = new FormData();
      formData.append(
        'file',
        new globalThis.File([blob], file.name.replace(/\.[^/.]+$/, '.webp')),
      );

      try {
        const data = (await apiUpload(
          `/api/media_files/primary-media/?content_type=${contentType}&object_id=${objectId}`,
          formData,
        )) as DisplayMedia;

        if (data) onUploadSuccess(data);
        else onUploadSuccess(null);

        onClose();
      } catch (e) {
        console.error('Upload failed:', e);
      }
    }
  }, [
    contentType,
    objectId,
    onUploadSuccess,
    onClose,
    type,
    file,
    exportTrimmedCroppedVideo,
  ]);

  const playSegmentPreview = useCallback(() => {
    const v = videoRef.current;
    if (!v || videoDuration <= 0) return;

    segmentPreviewActiveRef.current = true;
    setIsSegmentPlaying(true);
    setPreviewPlayheadTime(trimStart);
    v.pause();

    const onTimeUpdate = () => {
      if (v.currentTime >= trimEnd - 0.06) {
        v.pause();
        v.removeEventListener('timeupdate', onTimeUpdate);
        segmentPreviewActiveRef.current = false;
        setIsSegmentPlaying(false);
        setPreviewPlayheadTime(null);
        const onBackSeeked = () => {
          v.removeEventListener('seeked', onBackSeeked);
          scheduleRedraw();
        };
        v.addEventListener('seeked', onBackSeeked);
        v.currentTime = trimStart;
      }
    };

    const startPlayback = () => {
      v.addEventListener('timeupdate', onTimeUpdate);
      v.play().catch(() => {
        v.removeEventListener('timeupdate', onTimeUpdate);
        segmentPreviewActiveRef.current = false;
        setIsSegmentPlaying(false);
        setPreviewPlayheadTime(null);
      });
    };

    if (Math.abs(v.currentTime - trimStart) < 0.03) {
      startPlayback();
    } else {
      const onSeeked = () => {
        v.removeEventListener('seeked', onSeeked);
        startPlayback();
      };
      v.addEventListener('seeked', onSeeked);
      v.currentTime = trimStart;
    }
  }, [trimStart, trimEnd, videoDuration, scheduleRedraw]);

  const pointerIdRef = useRef<number | null>(null);

  const startDrag = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!canvasRef.current || isDraggingRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const { x, y } = canvasClientToLogical(rect, e.clientX, e.clientY);

      const edge = detectEdge(x, y);
      if (!edge) return;

      setActiveEdge(edge);
      setOffset({
        x: x - selectionRef.current.x,
        y: y - selectionRef.current.y,
      });
      isDraggingRef.current = true;

      pointerIdRef.current = e.pointerId;
      canvasRef.current.setPointerCapture(e.pointerId);
    },
    [detectEdge, canvasClientToLogical],
  );

  const onCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const { x, y } = canvasClientToLogical(rect, e.clientX, e.clientY);

      const edge = activeEdgeRef.current;
      if (!edge) return;

      const off = offsetRef.current;
      const prev = selectionRef.current;
      let { x: px, y: py, size } = prev;

      // const dx = x - (px + size);
      // const dy = y - (py + size);

      switch (edge) {
        case 'inside':
          px = Math.min(Math.max(0, x - off.x), canvasWidth - size);
          py = Math.min(Math.max(0, y - off.y), CANVAS_HEIGHT - size);
          break;

        case 'topLeft': {
          const deltaX = px - x;
          const deltaY = py - y;
          const newSize = Math.max(
            MIN_SIZE,
            Math.min(size + deltaX, size + deltaY, px + size, py + size),
          );
          px = px + (size - newSize);
          py = py + (size - newSize);
          size = newSize;
          break;
        }

        case 'topRight': {
          const deltaX = x - (px + size);
          const deltaY = py - y;
          const newSize = Math.max(
            MIN_SIZE,
            Math.min(size + deltaY, size + deltaX, canvasWidth - px, py + size),
          );
          py = py + (size - newSize);
          size = newSize;
          break;
        }

        case 'bottomLeft': {
          const delta = Math.min(px - x, y - (py + size));
          const newSize = Math.max(
            MIN_SIZE,
            Math.min(
              size + delta,
              canvasWidth - px + delta,
              CANVAS_HEIGHT - py,
            ),
          );
          px = px + (size - newSize);
          size = newSize;
          break;
        }

        case 'bottomRight': {
          const delta = Math.min(x - (px + size), y - (py + size));
          const newSize = Math.max(
            MIN_SIZE,
            Math.min(size + delta, canvasWidth - px, CANVAS_HEIGHT - py),
          );
          size = newSize;
          break;
        }
      }

      const newSel = {
        x: Math.max(0, Math.min(px, canvasWidth - size)),
        y: Math.max(0, Math.min(py, CANVAS_HEIGHT - size)),
        size: Math.max(MIN_SIZE, Math.min(size, MAX_SIZE)),
      };
      selectionRef.current = newSel;
      scheduleRedraw();
    },
    [canvasWidth, scheduleRedraw, canvasClientToLogical],
  );
  const onHoverMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const { x, y } = canvasClientToLogical(rect, e.clientX, e.clientY);

      const edge = detectEdge(x, y);

      const cursorMap: Record<Exclude<Edge, null>, string> = {
        inside: activeEdgeRef.current ? 'none' : 'all-scroll',
        topLeft: 'nwse-resize',
        topRight: 'nesw-resize',
        bottomLeft: 'nesw-resize',
        bottomRight: 'nwse-resize',
      };
      setCursor(edge ? cursorMap[edge] : 'default');
    },
    [detectEdge, canvasClientToLogical],
  );

  const endDrag = useCallback(
    (e?: React.PointerEvent<HTMLCanvasElement> | PointerEvent) => {
      e?.preventDefault?.();
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 0);
      setActiveEdge(null);
      setSelection(selectionRef.current);
      if (canvasRef.current && pointerIdRef.current != null) {
        try {
          canvasRef.current.releasePointerCapture(pointerIdRef.current);
        } catch (e) {
          console.error('releasePointerCapture failed:', e);
        }
        pointerIdRef.current = null;
      }
      scheduleRedraw();
    },
    [scheduleRedraw],
  );

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className={styles.modalOverlay}
      onClick={() => {
        if (
          !isDraggingRef.current &&
          !isTimelineWindowDraggingRef.current
        ) {
          onClose();
        }
      }}
    >
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative' }}
      >
        {type === 'video' && (
          <video
            ref={videoRef}
            className={styles.hiddenVideo}
            playsInline
            muted
            preload='auto'
          />
        )}
        <div ref={canvasWrapRef} className={styles.canvasWrap}>
          <canvas
            ref={canvasRef}
            onPointerDown={startDrag}
            onPointerMove={(e) => {
              onHoverMove(e);
              onCanvasPointerMove(e);
            }}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={() => setCursor('default')}
            className={styles.canvas}
            style={{
              cursor,
              touchAction: 'none',
              ...(type === 'video' && isExporting
                ? { pointerEvents: 'none', opacity: 0.65 }
                : {}),
            }}
          />
        </div>

        {type === 'video' && videoDuration > 0 && (
          <div
            className={styles.trimControls}
            onClick={stopInnerClick}
            onPointerDown={stopInnerPointerEvent}
          >
            <p className={styles.trimHint}>
              Full timeline = whole video. Clip length at most {MAX_CLIP_SEC}s.
            </p>
            <div className={styles.videoPreviewActions}>
              <button
                type='button'
                className={styles.previewPlayBtn}
                onClick={playSegmentPreview}
                onPointerDown={stopInnerPointerEvent}
                disabled={isExporting || isSegmentPlaying}
              >
                {isSegmentPlaying ? 'Playing…' : 'Preview clip'}
              </button>
            </div>
            <div className={styles.trimRow}>
              <div className={styles.trimLabel}>
                <span>Clip range</span>
                <span>
                  {trimStart.toFixed(1)}s - {trimEnd.toFixed(1)}s (
                  {Math.max(0, trimEnd - trimStart).toFixed(1)}s)
                  {isSegmentPlaying && previewPlayheadTime != null && (
                    <>
                      {' '}
                      · now {previewPlayheadTime.toFixed(1)}s /{' '}
                      {videoDuration.toFixed(1)}s
                    </>
                  )}
                </span>
              </div>
              <div
                ref={timelineRef}
                className={styles.trimTimeline}
                onPointerMove={onTrimWindowPointerMove}
                onPointerUp={endTrimWindowDrag}
                onPointerCancel={endTrimWindowDrag}
              >
                <div className={styles.trimTimelineBase} />
                <div
                  className={styles.trimTimelineSelected}
                  style={{
                    left: `${trackStartPct}%`,
                    width: `${Math.max(0, trackEndPct - trackStartPct)}%`,
                  }}
                />
                {hasValidClip && (
                  <div
                    role='slider'
                    aria-label='Move clip range'
                    className={styles.trimTimelineDragHit}
                    style={{
                      left: `${trackStartPct}%`,
                      width: `${Math.max(0, trackEndPct - trackStartPct)}%`,
                    }}
                    onPointerDown={onTrimWindowPointerDown}
                  />
                )}
                {previewPlayheadTime != null &&
                  videoDuration > 0 &&
                  isSegmentPlaying && (
                    <div
                      className={styles.trimTimelinePlayhead}
                      style={{
                        left: `${Math.min(
                          100,
                          Math.max(
                            0,
                            (previewPlayheadTime / videoDuration) * 100,
                          ),
                        )}%`,
                      }}
                    />
                  )}
                <input
                  type='range'
                  className={`${styles.trimRange} ${styles.trimThumbStart}`}
                  min={0}
                  max={videoDuration}
                  step={0.05}
                  value={Math.min(Math.max(0, trimStart), videoDuration)}
                  onPointerDown={stopInnerPointerEvent}
                  onChange={(e) => handleTrimStartChange(Number(e.target.value))}
                  disabled={isExporting}
                />
                <input
                  type='range'
                  className={`${styles.trimRange} ${styles.trimThumbEnd}`}
                  min={0}
                  max={videoDuration}
                  step={0.05}
                  value={Math.min(Math.max(0, trimEnd), videoDuration)}
                  onPointerDown={stopInnerPointerEvent}
                  onChange={(e) => handleTrimEndChange(Number(e.target.value))}
                  disabled={isExporting}
                />
              </div>
            </div>
          </div>
        )}

        <div className={styles.buttons}>
          <button type='button' onClick={onClose} disabled={isExporting}>
            Cancel
          </button>
          <button
            type='button'
            onClick={handleUpload}
            disabled={isExporting || (type === 'video' && !hasValidClip)}
          >
            {isExporting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
