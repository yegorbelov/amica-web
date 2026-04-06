import type { File } from '@/types';

interface LayoutItem {
  file: File;
  top: number;
  left: number;
  width: number;
  height: number;
}

const GAP = 3;
const MAX_H = 560;
const MIN_W = 0;
const MIN_H = 200;
const PORTRAIT_MAX_RATIO = 0.92;
const LANDSCAPE_MIN_RATIO = 1.08;

function mediaAspectRatio(file: File, fallback = 1): number {
  const w = file.width;
  const h = file.height;
  if (w == null || h == null || w <= 0 || h <= 0) return fallback;
  return w / h;
}

function isPortraitMedia(file: File): boolean {
  return mediaAspectRatio(file) < PORTRAIT_MAX_RATIO;
}

function isLandscapeMedia(file: File): boolean {
  return mediaAspectRatio(file) > LANDSCAPE_MIN_RATIO;
}

function heightForFullWidthRow(
  w: number,
  file: File,
  landscapeFallback: number,
) {
  const r = mediaAspectRatio(file, landscapeFallback);
  return w / r;
}

function heightForPortraitColumn(colW: number, file: File) {
  const r = mediaAspectRatio(file, 3 / 4);
  return colW / r;
}

function portraitColumnWidth(W: number, rowH: number, portrait: File): number {
  const rP = mediaAspectRatio(portrait, 3 / 4);
  const maxNarrow = (W - GAP) * 0.46;
  const minNarrow = (W - GAP) * 0.28;
  const fromHeight = rowH * rP;
  return Math.round(Math.min(maxNarrow, Math.max(minNarrow, fromHeight)));
}

function mixedRowHeightFromLandscape(
  wideW: number,
  landscape: File,
  maxH: number,
): number {
  const rL = mediaAspectRatio(landscape, 16 / 9);
  const natural = wideW / rL;
  const minRow = 80;
  return Math.min(maxH, Math.max(minRow, natural));
}

function ratio3TopForHero(hero: File): number {
  const r = mediaAspectRatio(hero);
  if (r >= LANDSCAPE_MIN_RATIO) {
    return Math.min(0.68, Math.max(0.48, 0.42 + 0.12 / r));
  }
  if (r <= PORTRAIT_MAX_RATIO) {
    return Math.min(0.58, Math.max(0.5, 0.52 + r * 0.06));
  }
  return 0.56;
}

export function generateLayout(files: File[], MAX_W = 432): LayoutItem[] {
  const count = files.length;
  if (count === 0) return [];

  const result: LayoutItem[] = [];
  const W = Math.min(MAX_W, Math.max(MIN_W, MAX_W));
  const H = Math.min(MAX_H, Math.max(MIN_H, W));

  if (count === 1) {
    const file = files[0];
    const imgWidth = file.width || W;
    const imgHeight = file.height || H;
    const ratio = imgWidth / imgHeight;

    let width = imgWidth;
    let height = imgHeight;

    if (width > MAX_W) {
      width = MAX_W;
      height = width / ratio;
    }
    if (height > MAX_H) {
      height = MAX_H;
      width = height * ratio;
    }

    width = Math.max(width, MIN_W);
    height = Math.max(height, MIN_H);

    result.push({ file, top: 0, left: 0, width, height });
    return result;
  }

  if (count === 2) {
    const a0 = isPortraitMedia(files[0]);
    const a1 = isPortraitMedia(files[1]);
    const b0 = isLandscapeMedia(files[0]);
    const b1 = isLandscapeMedia(files[1]);

    if (a0 && a1) {
      const colW = (W - GAP) / 2;
      const hNeed = Math.max(
        heightForPortraitColumn(colW, files[0]),
        heightForPortraitColumn(colW, files[1]),
      );
      const rowH = Math.round(Math.min(MAX_H, Math.max(MIN_H, hNeed)));
      result.push({
        file: files[0],
        top: 0,
        left: 0,
        width: colW,
        height: rowH,
      });
      result.push({
        file: files[1],
        top: 0,
        left: colW + GAP,
        width: colW,
        height: rowH,
      });
      return result;
    }

    if (b0 && b1) {
      let h0 = heightForFullWidthRow(W, files[0], 16 / 9);
      let h1 = heightForFullWidthRow(W, files[1], 16 / 9);
      const sum = h0 + h1 + GAP;
      const scale = sum > MAX_H ? (MAX_H - GAP) / (h0 + h1) : 1;
      h0 = Math.round(h0 * scale);
      h1 = Math.round(h1 * scale);
      result.push({ file: files[0], top: 0, left: 0, width: W, height: h0 });
      result.push({
        file: files[1],
        top: h0 + GAP,
        left: 0,
        width: W,
        height: h1,
      });
      return result;
    }

    const mixed = (a0 && b1 && !a1 && !b0) || (a1 && b0 && !a0 && !b1);
    if (mixed) {
      const portrait = a0 ? files[0] : files[1];
      const landscape = b0 ? files[0] : files[1];
      let narrow = portraitColumnWidth(W, H, portrait);
      let wide = W - GAP - narrow;
      let rowH = mixedRowHeightFromLandscape(wide, landscape, H);
      narrow = portraitColumnWidth(W, rowH, portrait);
      wide = W - GAP - narrow;
      rowH = mixedRowHeightFromLandscape(wide, landscape, H);

      if (a0) {
        result.push({
          file: files[0],
          top: 0,
          left: 0,
          width: narrow,
          height: rowH,
        });
        result.push({
          file: files[1],
          top: 0,
          left: narrow + GAP,
          width: wide,
          height: rowH,
        });
      } else {
        result.push({
          file: files[0],
          top: 0,
          left: 0,
          width: wide,
          height: rowH,
        });
        result.push({
          file: files[1],
          top: 0,
          left: wide + GAP,
          width: narrow,
          height: rowH,
        });
      }
      return result;
    }

    if (a0 && !a1) {
      const narrow = (W - GAP) * 0.38;
      const wide = W - GAP - narrow;
      result.push({
        file: files[0],
        top: 0,
        left: 0,
        width: narrow,
        height: H,
      });
      result.push({
        file: files[1],
        top: 0,
        left: narrow + GAP,
        width: wide,
        height: H,
      });
    } else if (a1 && !a0) {
      const narrow = (W - GAP) * 0.38;
      const wide = W - GAP - narrow;
      result.push({
        file: files[0],
        top: 0,
        left: 0,
        width: wide,
        height: H,
      });
      result.push({
        file: files[1],
        top: 0,
        left: wide + GAP,
        width: narrow,
        height: H,
      });
    } else {
      const half = (W - GAP) / 2;
      result.push({ file: files[0], top: 0, left: 0, width: half, height: H });
      result.push({
        file: files[1],
        top: 0,
        left: half + GAP,
        width: half,
        height: H,
      });
    }
    return result;
  }

  if (count === 3) {
    if (isPortraitMedia(files[0])) {
      const leftW = Math.round(W * 0.66);
      const rightW = W - leftW - GAP;
      const rightH = (H - GAP) / 2;
      result.push({
        file: files[0],
        top: 0,
        left: 0,
        width: leftW,
        height: H,
      });
      result.push({
        file: files[1],
        top: 0,
        left: leftW + GAP,
        width: rightW,
        height: rightH,
      });
      result.push({
        file: files[2],
        top: rightH + GAP,
        left: leftW + GAP,
        width: rightW,
        height: rightH,
      });
      return result;
    }

    const topRatio = ratio3TopForHero(files[0]);
    const topH = H * topRatio;
    const bottomH = H - topH - GAP;
    const half = (W - GAP) / 2;

    result.push({ file: files[0], top: 0, left: 0, width: W, height: topH });
    result.push({
      file: files[1],
      top: topH + GAP,
      left: 0,
      width: half,
      height: bottomH,
    });
    result.push({
      file: files[2],
      top: topH + GAP,
      left: half + GAP,
      width: half,
      height: bottomH,
    });
    return result;
  }

  if (count === 4) {
    const allPortrait = files.every((f) => isPortraitMedia(f));
    if (allPortrait) {
      const cellW = (W - GAP) / 2;
      const cellH = (H - GAP) / 2;
      result.push({
        file: files[0],
        top: 0,
        left: 0,
        width: cellW,
        height: cellH,
      });
      result.push({
        file: files[1],
        top: 0,
        left: cellW + GAP,
        width: cellW,
        height: cellH,
      });
      result.push({
        file: files[2],
        top: cellH + GAP,
        left: 0,
        width: cellW,
        height: cellH,
      });
      result.push({
        file: files[3],
        top: cellH + GAP,
        left: cellW + GAP,
        width: cellW,
        height: cellH,
      });
      return result;
    }

    const hero = files[0];
    const topRatio = isLandscapeMedia(hero)
      ? 0.45
      : isPortraitMedia(hero)
        ? 0.38
        : 0.42;
    const topH = H * topRatio;
    const midH = H * 0.28;
    const bottomH = H - topH - midH - GAP * 2;
    const leftSplit = isPortraitMedia(hero) ? 0.48 : 0.4;

    result.push({ file: files[0], top: 0, left: 0, width: W, height: topH });
    result.push({
      file: files[1],
      top: topH + GAP,
      left: 0,
      width: W * leftSplit - GAP,
      height: midH,
    });
    result.push({
      file: files[2],
      top: topH + GAP,
      left: W * leftSplit,
      width: W * (1 - leftSplit),
      height: midH,
    });
    result.push({
      file: files[3],
      top: topH + midH + GAP * 2,
      left: 0,
      width: W,
      height: bottomH,
    });
    return result;
  }

  const rows = Math.ceil(Math.sqrt(count));
  let currentIndex = 0;
  let top = 0;

  for (let row = 0; row < rows; row++) {
    const remaining = count - currentIndex;
    const remainingRows = rows - row;
    const itemsInRow = Math.ceil(remaining / remainingRows);

    const width = (W - GAP * (itemsInRow - 1)) / itemsInRow;
    const height = (H - GAP * (rows - 1)) / rows;

    for (let col = 0; col < itemsInRow; col++) {
      if (currentIndex >= count) break;

      const left = col * (width + GAP);
      result.push({
        file: files[currentIndex],
        top,
        left,
        width,
        height,
      });

      currentIndex++;
    }

    top += height + GAP;
  }

  return result;
}
