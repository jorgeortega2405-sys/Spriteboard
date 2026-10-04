import { WebAudioPlaybackEngine } from '../engine/audio-engine.js';
import { VideoClip } from '../video.types.js';

export class TimelineWaveformUtil {
  private _audioEngine: WebAudioPlaybackEngine;
  private _fetchingWaveforms: Set<string> = new Set();
  private _waveformCache: Map<string, number[]>;

  constructor(audioEngine: WebAudioPlaybackEngine, waveformCache: Map<string, number[]>) {
    this._audioEngine = audioEngine;
    this._waveformCache = waveformCache;
  }

  public renderWaveformSvg(
    clip: VideoClip,
    widthPx: number,
    pixelsPerSecond: number,
    container: HTMLElement,
    onWaveformLoaded?: () => void
  ): string {
    const barsCount = Math.max(10, Math.min(180, Math.floor(widthPx / 4)));
    const peaks = (clip.assetUrl ? this._waveformCache.get(clip.assetUrl) : null) || clip.waveformPeaks;

    if (!peaks && clip.assetUrl) {
      void this.loadClipWaveform(clip, pixelsPerSecond, container, onWaveformLoaded);
    }

    let bars = '';
    if (peaks && peaks.length > 0) {
      const sourceDur = Math.max(0.1, clip.sourceDuration || clip.duration || 10);
      const startRatio = Math.max(0, Math.min(1, (clip.trimStart || 0) / sourceDur));
      const endRatio = Math.max(startRatio + 0.001, Math.min(1, ((clip.trimStart || 0) + clip.duration) / sourceDur));
      const startIdx = Math.floor(startRatio * peaks.length);
      const endIdx = Math.min(peaks.length, Math.ceil(endRatio * peaks.length));
      const slice = peaks.slice(startIdx, Math.max(startIdx + 1, endIdx));

      const step = slice.length / barsCount;
      const sampledPeaks: number[] = [];
      for (let i = 0; i < barsCount; i++) {
        const idx = Math.min(slice.length - 1, Math.floor(i * step));
        sampledPeaks.push(slice[idx] || 0.1);
      }

      bars = sampledPeaks
        .map((h, idx) => {
          const x = idx * 4 + 2;
          const barH = Math.max(3, Math.round(h * 38));
          const y = Math.round((48 - barH) / 2);
          return `<rect x="${x}" y="${y}" width="2" height="${barH}" rx="1" fill="currentColor" opacity="0.65" />`;
        })
        .join('');
    } else {
      const placeholderPeaks = Array.from({ length: barsCount }, (_, idx) => 0.15 + (idx % 2 === 0 ? 0.08 : 0));
      bars = placeholderPeaks
        .map((h, idx) => {
          const x = idx * 4 + 2;
          const barH = Math.round(h * 32);
          const y = Math.round((48 - barH) / 2);
          return `<rect x="${x}" y="${y}" width="2" height="${barH}" rx="1" fill="currentColor" opacity="0.35" />`;
        })
        .join('');
    }

    return `
      <svg class="video-clip-waveform-svg" data-ref="waveform-svg-${clip.id}" viewBox="0 0 ${barsCount * 4 + 4} 48" preserveAspectRatio="none" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; color: #818cf8;">
        ${bars}
      </svg>
    `;
  }

  public async loadClipWaveform(
    clip: VideoClip,
    pixelsPerSecond: number,
    container: HTMLElement,
    onWaveformLoaded?: () => void
  ): Promise<void> {
    if (!clip.assetUrl || this._fetchingWaveforms.has(clip.assetUrl)) return;
    this._fetchingWaveforms.add(clip.assetUrl);

    try {
      const peaks = await this._audioEngine.getAudioWaveformPeaks(clip.assetUrl);
      if (peaks && peaks.length > 0) {
        this._waveformCache.set(clip.assetUrl, peaks);
        clip.waveformPeaks = peaks;

        const clipEl = container.querySelector<HTMLElement>(`[data-clip-id="${clip.id}"]`);
        if (clipEl) {
          const widthPx = clipEl.clientWidth || Math.max(20, clip.duration * pixelsPerSecond);
          const oldSvg = clipEl.querySelector<SVGElement>('.video-clip-waveform-svg');
          if (oldSvg) {
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = this.renderWaveformSvg(clip, widthPx, pixelsPerSecond, container);
            const newSvg = tempContainer.firstElementChild;
            if (newSvg) {
              oldSvg.replaceWith(newSvg);
            }
          }
        }
        onWaveformLoaded?.();
      }
    } catch {} finally {
      this._fetchingWaveforms.delete(clip.assetUrl);
    }
  }
}
