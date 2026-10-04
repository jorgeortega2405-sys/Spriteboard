import { VideoClip, VideoProject, VideoTextConfig, VideoTransform } from '../video.types.js';

export class PreviewOverlayRenderer {
  private _ctx: CanvasRenderingContext2D;
  private _getImageElement?: (url: string) => HTMLImageElement | null;

  constructor(ctx: CanvasRenderingContext2D, getImageElement?: (url: string) => HTMLImageElement | null) {
    this._ctx = ctx;
    this._getImageElement = getImageElement;
  }

  public setContext(ctx: CanvasRenderingContext2D): void {
    this._ctx = ctx;
  }

  private getImageElement(url: string): HTMLImageElement | null {
    return this._getImageElement ? this._getImageElement(url) : null;
  }

  public drawFittedMedia(
    media: HTMLVideoElement | HTMLImageElement | VideoFrame,
    canvasW: number,
    canvasH: number,
    clip: VideoClip,
    localTime: number
  ): void {
    if (!this._ctx) return;
    let mediaW = 1920;
    let mediaH = 1080;
    if (typeof VideoFrame !== 'undefined' && media instanceof VideoFrame) {
      if (!media.format) return;
      mediaW = media.displayWidth || media.codedWidth || 1920;
      mediaH = media.displayHeight || media.codedHeight || 1080;
    } else if (media instanceof HTMLVideoElement) {
      mediaW = media.videoWidth || 1920;
      mediaH = media.videoHeight || 1080;
    } else if (media instanceof HTMLImageElement) {
      mediaW = media.naturalWidth || 1920;
      mediaH = media.naturalHeight || 1080;
    }

    const hasCustomTransform = Boolean(clip.transform?.width && clip.transform?.height && clip.transform?.x !== undefined && clip.transform?.y !== undefined);
    const scale = Math.min(canvasW / mediaW, canvasH / mediaH);
    const drawW = hasCustomTransform ? clip.transform!.width! : mediaW * scale;
    const drawH = hasCustomTransform ? clip.transform!.height! : mediaH * scale;
    const dx = hasCustomTransform ? clip.transform!.x! : (canvasW - drawW) / 2;
    const dy = hasCustomTransform ? clip.transform!.y! : (canvasH - drawH) / 2;

    this._ctx.save();

    if (clip.transform?.rotation) {
      const cx = dx + drawW / 2;
      const cy = dy + drawH / 2;
      this._ctx.translate(cx, cy);
      this._ctx.rotate((clip.transform.rotation * Math.PI) / 180);
      this._ctx.translate(-cx, -cy);
    }

    const filterParts: string[] = [];
    if (clip.filters) {
      const f = clip.filters;
      if (f.preset === 'cinema') filterParts.push('contrast(1.15) saturate(1.2) brightness(0.98)');
      else if (f.preset === 'retro') filterParts.push('sepia(0.6) contrast(0.9) brightness(1.05)');
      else if (f.preset === 'grayscale') filterParts.push('grayscale(1)');
      else if (f.preset === 'warm') filterParts.push('sepia(0.25) saturate(1.2)');
      else if (f.preset === 'cool') filterParts.push('hue-rotate(180deg) saturate(0.8)');

      if (f.brightness !== undefined && f.brightness !== 1) filterParts.push(`brightness(${f.brightness})`);
      if (f.contrast !== undefined && f.contrast !== 1) filterParts.push(`contrast(${f.contrast})`);
      if (f.saturate !== undefined && f.saturate !== 1) filterParts.push(`saturate(${f.saturate})`);
      if (f.grayscale !== undefined && f.grayscale > 0) filterParts.push(`grayscale(${f.grayscale})`);
      if (f.sepia !== undefined && f.sepia > 0) filterParts.push(`sepia(${f.sepia})`);
    }

    if (filterParts.length > 0) {
      this._ctx.filter = filterParts.join(' ');
    }

    let transAlpha = 1;
    let transOffsetX = 0;
    if (clip.transition && clip.transition.type !== 'none' && clip.transition.duration > 0) {
      const tElapsed = localTime - clip.trimStart;
      const tDur = clip.transition.duration;
      if (tElapsed < tDur) {
        const tProg = Math.max(0, Math.min(1, tElapsed / tDur));
        if (clip.transition.type === 'crossfade' || clip.transition.type === 'fade_black') {
          transAlpha = tProg;
        } else if (clip.transition.type === 'slide_left') {
          transOffsetX = (1 - tProg) * canvasW;
        } else if (clip.transition.type === 'wipe_left') {
          this._ctx.beginPath();
          this._ctx.rect(dx, dy, drawW * tProg, drawH);
          this._ctx.clip();
        }
      }
    }

    this._ctx.globalAlpha = (clip.transform?.opacity ?? 1) * transAlpha;
    try {
      this._ctx.drawImage(media, dx + transOffsetX, dy, drawW, drawH);
    } catch {
      if (clip.thumbnailUrl) {
        const fallbackImg = this.getImageElement(clip.thumbnailUrl);
        if (fallbackImg && fallbackImg.complete && fallbackImg.naturalWidth > 0) {
          try {
            this._ctx.drawImage(fallbackImg, dx + transOffsetX, dy, drawW, drawH);
          } catch {}
        }
      }
    }
    this._ctx.restore();
  }


  public drawTextOverlay(
    textCfg: VideoTextConfig,
    canvasW: number,
    canvasH: number,
    clip: VideoClip,
    localTime = 0
  ): void {
    if (!this._ctx) return;
    this._ctx.save();

    const fontSize = textCfg.fontSize || 48;
    const fontFamily = textCfg.fontFamily || 'Inter, system-ui, sans-serif';
    const fontWeight = textCfg.fontWeight || '700';
    this._ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    this._ctx.textBaseline = 'middle';

    if (clip.transform?.opacity !== undefined) {
      this._ctx.globalAlpha = clip.transform.opacity;
    }

    const posX = clip.transform?.x !== undefined ? clip.transform.x : canvasW / 2;
    const posY = clip.transform?.y !== undefined ? clip.transform.y : canvasH / 2;
    const align = (textCfg.textAlign as CanvasTextAlign) || 'center';
    const rawText = textCfg.text || '';

    const isKaraoke = textCfg.highlightStyle === 'karaoke' || (Array.isArray(textCfg.words) && textCfg.words.length > 0);

    if (!isKaraoke) {
      this._ctx.textAlign = align;
      this._ctx.fillStyle = textCfg.color || '#ffffff';

      if (textCfg.backgroundColor) {
        const metrics = this._ctx.measureText(rawText);
        const padX = 20;
        const padY = 12;
        const boxW = metrics.width + padX * 2;
        const boxH = fontSize * 1.35 + padY;
        let boxX = posX - boxW / 2;
        if (align === 'left') boxX = posX - padX;
        else if (align === 'right') boxX = posX - boxW + padX;
        const boxY = posY - boxH / 2;

        this._ctx.fillStyle = textCfg.backgroundColor;
        this._ctx.beginPath();
        if (typeof (this._ctx as any).roundRect === 'function') {
          (this._ctx as any).roundRect(boxX, boxY, boxW, boxH, 8);
        } else {
          this._ctx.rect(boxX, boxY, boxW, boxH);
        }
        this._ctx.fill();
        this._ctx.fillStyle = textCfg.color || '#ffffff';
      }

      if (textCfg.strokeWidth && textCfg.strokeWidth > 0) {
        this._ctx.strokeStyle = textCfg.strokeColor || '#000000';
        this._ctx.lineWidth = textCfg.strokeWidth;
        this._ctx.lineJoin = 'round';
        this._ctx.strokeText(rawText, posX, posY);
      } else {
        this._ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        this._ctx.shadowBlur = 8;
      }

      this._ctx.fillText(rawText, posX, posY);
      this._ctx.restore();
      return;
    }

    let words = textCfg.words || [];
    if (words.length === 0) {
      const split: string[] = rawText.split(/\s+/).filter(Boolean);
      const dur = Math.max(0.2, clip.duration || 2);
      const totalChars = split.reduce((acc: number, w: string) => acc + w.length, 0) || 1;
      let cur = 0;
      words = split.map((w: string) => {
        const wDur = (w.length / totalChars) * dur;
        const wStart = cur;
        cur += wDur;
        return { end: cur, start: wStart, word: w };
      });
    }

    let activeIndex = words.findIndex((w: { end: number; start: number; word: string }) => localTime >= w.start && localTime < w.end);
    if (activeIndex === -1) {
      if (localTime >= (words[words.length - 1]?.end ?? 0)) {
        activeIndex = words.length - 1;
      } else {
        activeIndex = 0;
      }
    }

    const spaceWidth = this._ctx.measureText(' ').width;
    const wordWidths = words.map((w: { end: number; start: number; word: string }) => this._ctx!.measureText(w.word).width);
    const totalWordsWidth = wordWidths.reduce((acc: number, w: number) => acc + w, 0) + Math.max(0, words.length - 1) * spaceWidth;

    let startX = posX - totalWordsWidth / 2;
    if (align === 'left') startX = posX;
    else if (align === 'right') startX = posX - totalWordsWidth;

    if (textCfg.backgroundColor) {
      const padX = 22;
      const padY = 12;
      const boxW = totalWordsWidth + padX * 2;
      const boxH = fontSize * 1.35 + padY;
      const boxX = startX - padX;
      const boxY = posY - boxH / 2;

      this._ctx.fillStyle = textCfg.backgroundColor;
      this._ctx.beginPath();
      if (typeof (this._ctx as any).roundRect === 'function') {
        (this._ctx as any).roundRect(boxX, boxY, boxW, boxH, 10);
      } else {
        this._ctx.rect(boxX, boxY, boxW, boxH);
      }
      this._ctx.fill();
    }

    this._ctx.textAlign = 'left';
    let currentX = startX;

    for (let i = 0; i < words.length; i++) {
      const isCurrentActive = i === activeIndex;
      const wordText = words[i].word;
      const wWidth = wordWidths[i];

      const wordColor = isCurrentActive
        ? (textCfg.highlightColor || '#facc15')
        : (textCfg.color || '#ffffff');

      const strokeW = textCfg.strokeWidth !== undefined ? textCfg.strokeWidth : 5;
      if (strokeW > 0) {
        this._ctx.strokeStyle = textCfg.strokeColor || '#000000';
        this._ctx.lineWidth = isCurrentActive ? strokeW + 1.5 : strokeW;
        this._ctx.lineJoin = 'round';
        this._ctx.strokeText(wordText, currentX, posY);
      } else {
        this._ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        this._ctx.shadowBlur = isCurrentActive ? 12 : 6;
      }

      this._ctx.fillStyle = wordColor;
      this._ctx.fillText(wordText, currentX, posY);

      currentX += wWidth + spaceWidth;
    }

    this._ctx.restore();
  }


  public drawSelectionBox(
    box: { height: number; width: number; x: number; y: number },
    scaleFactor: number
  ): void {
    if (!this._ctx) return;
    const strokeW = Math.max(2, 2 * scaleFactor);
    const handleSize = Math.max(12, 12 * scaleFactor);

    this._ctx.save();
    this._ctx.strokeStyle = '#3b82f6';
    this._ctx.lineWidth = strokeW;
    this._ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    this._ctx.shadowBlur = 6 * scaleFactor;
    this._ctx.strokeRect(box.x, box.y, box.width, box.height);

    const handles = [
      { hx: box.x, hy: box.y },
      { hx: box.x + box.width, hy: box.y },
      { hx: box.x + box.width, hy: box.y + box.height },
      { hx: box.x, hy: box.y + box.height },
      { hx: box.x + box.width / 2, hy: box.y },
      { hx: box.x + box.width / 2, hy: box.y + box.height },
      { hx: box.x, hy: box.y + box.height / 2 },
      { hx: box.x + box.width, hy: box.y + box.height / 2 },
    ];

    this._ctx.fillStyle = '#ffffff';
    this._ctx.strokeStyle = '#2563eb';
    this._ctx.lineWidth = Math.max(1.5, 1.5 * scaleFactor);

    for (const h of handles) {
      this._ctx.beginPath();
      const half = handleSize / 2;
      this._ctx.rect(h.hx - half, h.hy - half, handleSize, handleSize);
      this._ctx.fill();
      this._ctx.stroke();
    }

    this._ctx.restore();
  }
}
