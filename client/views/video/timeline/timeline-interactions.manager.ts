import { VideoClip, VideoProject, VideoTrack } from '../video.types.js';

export interface TimelineInteractionsManagerOptions {
  container: HTMLElement;
  getPixelsPerSecond: () => number;
  getProject: () => VideoProject;
  getSelectedClipId: () => string | null;
  getSelectedClipIds: () => Set<string>;
  deleteSelectedClip: () => void;
  duplicateSelectedClip: () => void;
  isSnappingEnabled: () => boolean;
  onClipSelected?: (clipId: string | null) => void;
  onProjectChanged: () => void;
  onScrubEnd?: () => void;
  onScrubStart?: () => void;
  onSeek: (time: number, isScrubbing?: boolean) => void;
  recomputeProjectDuration: () => void;
  render: () => void;
  selectClip: (clipId: string, renderUi?: boolean, isMulti?: boolean) => void;
  selectClips: (clipIds: string[]) => void;
  setPlayheadPosition: (time: number) => void;
  showContextMenu: (e: MouseEvent, clipId: string) => void;
  splitSelectedClip: () => void;
}

export class TimelineInteractionsManager {
  private _container: HTMLElement;
  private _deleteSelectedClip: () => void;
  private _duplicateSelectedClip: () => void;
  private _getPixelsPerSecond: () => number;
  private _getProject: () => VideoProject;
  private _getSelectedClipId: () => string | null;
  private _getSelectedClipIds: () => Set<string>;
  private _isSnappingEnabled: () => boolean;
  private _onClipSelected?: (clipId: string | null) => void;
  private _onProjectChanged: () => void;
  private _onScrubEnd?: () => void;
  private _onScrubStart?: () => void;
  private _onSeek: (time: number, isScrubbing?: boolean) => void;
  private _recomputeProjectDuration: () => void;
  private _render: () => void;
  private _selectClip: (clipId: string, renderUi?: boolean, isMulti?: boolean) => void;
  private _selectClips: (clipIds: string[]) => void;
  private _setPlayheadPosition: (time: number) => void;
  private _showContextMenu: (e: MouseEvent, clipId: string) => void;
  private _splitSelectedClip: () => void;

  private _playheadElement: HTMLElement | null = null;
  private _hoverLineElement: HTMLElement | null = null;
  private _hoverTooltipElement: HTMLElement | null = null;
  private _marqueeElement: HTMLElement | null = null;
  private _isDraggingMarquee = false;
  private _isScrubbingPlayhead = false;

  constructor(options: TimelineInteractionsManagerOptions) {
    this._container = options.container;
    this._deleteSelectedClip = options.deleteSelectedClip;
    this._duplicateSelectedClip = options.duplicateSelectedClip;
    this._getPixelsPerSecond = options.getPixelsPerSecond;
    this._getProject = options.getProject;
    this._getSelectedClipId = options.getSelectedClipId;
    this._getSelectedClipIds = options.getSelectedClipIds;
    this._isSnappingEnabled = options.isSnappingEnabled;
    this._onClipSelected = options.onClipSelected;
    this._onProjectChanged = options.onProjectChanged;
    this._onScrubEnd = options.onScrubEnd;
    this._onScrubStart = options.onScrubStart;
    this._onSeek = options.onSeek;
    this._recomputeProjectDuration = options.recomputeProjectDuration;
    this._render = options.render;
    this._selectClip = options.selectClip;
    this._selectClips = options.selectClips;
    this._setPlayheadPosition = options.setPlayheadPosition;
    this._showContextMenu = options.showContextMenu;
    this._splitSelectedClip = options.splitSelectedClip;
  }

  get _pixelsPerSecond(): number {
    return this._getPixelsPerSecond();
  }

  get _selectedClipId(): string | null {
    return this._getSelectedClipId();
  }

  get _selectedClipIds(): Set<string> {
    return this._getSelectedClipIds();
  }

  private selectClip(clipId: string, renderUi?: boolean, isMulti?: boolean): void {
    this._selectClip(clipId, renderUi, isMulti);
  }

  private selectClips(clipIds: string[]): void {
    this._selectClips(clipIds);
  }

  private showContextMenu(e: MouseEvent, clipId: string): void {
    this._showContextMenu(e, clipId);
  }

  private render(): void {
    this._render();
  }

  private recomputeProjectDuration(): void {
    this._recomputeProjectDuration();
  }

  private setPlayheadPosition(time: number): void {
    this._setPlayheadPosition(time);
  }

  private splitSelectedClip(): void {
    this._splitSelectedClip();
  }

  private deleteSelectedClip(): void {
    this._deleteSelectedClip();
  }

  private duplicateSelectedClip(): void {
    this._duplicateSelectedClip();
  }

  public snapTime(time: number, ignoreClipId?: string, clipDuration = 0): number {
    if (!this._isSnappingEnabled) return time;
    const threshold = 10 / this._pixelsPerSecond;
    const project = this._getProject();

    const targets: number[] = [0, project.currentTime || 0];

    for (const track of project.tracks) {
      for (const c of track.clips) {
        if (c.id === ignoreClipId) continue;
        targets.push(c.startTime);
        targets.push(c.startTime + c.duration);
      }
    }

    for (const t of targets) {
      if (Math.abs(time - t) <= threshold) {
        return t;
      }
      if (clipDuration > 0 && Math.abs((time + clipDuration) - t) <= threshold) {
        return Math.max(0, t - clipDuration);
      }
    }

    return time;
  }


  public bindClipDragging(clipEl: HTMLElement, clipId: string): void {
    clipEl.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).classList.contains('clip-trim-handle')) return;
      e.stopPropagation();

      const isMultiKey = e.shiftKey || e.ctrlKey || e.metaKey;
      if (!this._selectedClipIds.has(clipId) && !isMultiKey) {
        this.selectClip(clipId);
      } else if (isMultiKey) {
        this.selectClip(clipId, true, true);
      }

      const project = this._getProject();
      let sourceTrack: VideoTrack | null = null;
      let targetClip: VideoClip | null = null;

      for (const track of project.tracks) {
        const found = track.clips.find((c) => c.id === clipId);
        if (found) {
          sourceTrack = track;
          targetClip = found;
          break;
        }
      }

      if (!targetClip || !sourceTrack) return;

      const initialMouseX = e.clientX;
      const initialStartTime = targetClip.startTime;
      let currentTrackId = sourceTrack.id;

      const lanesList = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-list"]');
      const lanes = lanesList ? Array.from(lanesList.querySelectorAll<HTMLElement>('.video-track-lane')) : [];

      const isMultiDrag = this._selectedClipIds.size > 1 && this._selectedClipIds.has(clipId);
      const multiClips: { clip: VideoClip; el: HTMLElement | null; initialStart: number }[] = [];

      if (isMultiDrag) {
        for (const track of project.tracks) {
          for (const c of track.clips) {
            if (this._selectedClipIds.has(c.id)) {
              const el = lanesList?.querySelector<HTMLElement>(`[data-clip-id="${c.id}"]`) || null;
              multiClips.push({ clip: c, el, initialStart: c.startTime });
            }
          }
        }
      }

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - initialMouseX;
        const deltaSeconds = deltaX / this._pixelsPerSecond;

        if (isMultiDrag && multiClips.length > 0) {
          const minInitialStart = Math.min(...multiClips.map((m) => m.initialStart));
          let clampedDelta = Math.max(-minInitialStart, deltaSeconds);
          const snappedTargetStart = this.snapTime(initialStartTime + clampedDelta, clipId, targetClip!.duration);
          clampedDelta = Math.max(-minInitialStart, snappedTargetStart - initialStartTime);

          for (const item of multiClips) {
            item.clip.startTime = Math.max(0, item.initialStart + clampedDelta);
            if (item.el) {
              item.el.style.left = `${item.clip.startTime * this._pixelsPerSecond}px`;
            }
          }
        } else {
          let newStartTime = Math.max(0, initialStartTime + deltaSeconds);
          newStartTime = this.snapTime(newStartTime, clipId, targetClip!.duration);

          targetClip!.startTime = newStartTime;
          clipEl.style.left = `${newStartTime * this._pixelsPerSecond}px`;

          for (const lane of lanes) {
            const rect = lane.getBoundingClientRect();
            if (moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom) {
              const laneTrackId = lane.getAttribute('data-track-id');
              const candidateTrack = project.tracks.find((t) => t.id === laneTrackId);
              if (candidateTrack) {
                const isAudioClip = targetClip!.mediaType === 'audio';
                const isAudioTrack = candidateTrack.type === 'audio';
                if ((isAudioClip && isAudioTrack) || (!isAudioClip && !isAudioTrack)) {
                  currentTrackId = candidateTrack.id;
                }
              }
              break;
            }
          }

          lanes.forEach((lane) => {
            lane.classList.toggle('is-drag-target', lane.getAttribute('data-track-id') === currentTrackId && currentTrackId !== sourceTrack!.id);
          });
        }

        this.recomputeProjectDuration();
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        lanes.forEach((lane) => lane.classList.remove('is-drag-target'));

        if (!isMultiDrag && currentTrackId !== sourceTrack!.id) {
          const destTrack = project.tracks.find((t) => t.id === currentTrackId);
          if (destTrack) {
            const idx = sourceTrack!.clips.findIndex((c) => c.id === clipId);
            if (idx !== -1) {
              sourceTrack!.clips.splice(idx, 1);
              destTrack.clips.push(targetClip!);
            }
          }
        }

        this.render();
        this._onProjectChanged();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  public bindClipTrimming(clipEl: HTMLElement, clipId: string): void {
    const leftHandle = clipEl.querySelector<HTMLElement>('.clip-trim-handle.left');
    const rightHandle = clipEl.querySelector<HTMLElement>('.clip-trim-handle.right');

    const project = this._getProject();
    let targetClip: VideoClip | null = null;
    for (const track of project.tracks) {
      const found = track.clips.find((c) => c.id === clipId);
      if (found) {
        targetClip = found;
        break;
      }
    }

    if (!targetClip) return;

    leftHandle?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const initialMouseX = e.clientX;
      const initialStartTime = targetClip!.startTime;
      const initialDuration = targetClip!.duration;
      const initialTrimStart = targetClip!.trimStart;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - initialMouseX;
        const deltaSeconds = deltaX / this._pixelsPerSecond;

        const maxLeftTrim = Math.min(initialTrimStart, initialStartTime);
        const maxRightTrim = initialDuration - 0.2;

        const clampedDelta = Math.max(-maxLeftTrim, Math.min(deltaSeconds, maxRightTrim));
        let newStartTime = Math.max(0, initialStartTime + clampedDelta);
        newStartTime = this.snapTime(newStartTime, clipId);

        const effectiveDelta = newStartTime - initialStartTime;
        const newDuration = Math.max(0.2, initialDuration - effectiveDelta);
        const newTrimStart = Math.max(0, initialTrimStart + effectiveDelta);

        targetClip!.startTime = newStartTime;
        targetClip!.duration = newDuration;
        targetClip!.trimStart = newTrimStart;

        clipEl.style.left = `${newStartTime * this._pixelsPerSecond}px`;
        clipEl.style.width = `${newDuration * this._pixelsPerSecond}px`;
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        this.render();
        this._onProjectChanged();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    rightHandle?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const initialMouseX = e.clientX;
      const initialDuration = targetClip!.duration;
      const initialTrimEnd = targetClip!.trimEnd;
      const isStatic = targetClip!.mediaType === 'image' || targetClip!.mediaType === 'text';
      const sourceDuration = isStatic ? 99999 : (targetClip!.sourceDuration || targetClip!.duration);

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - initialMouseX;
        const deltaSeconds = deltaX / this._pixelsPerSecond;

        const rawDuration = Math.max(0.2, Math.min(sourceDuration - targetClip!.trimStart, initialDuration + deltaSeconds));
        const snappedEnd = this.snapTime(targetClip!.startTime + rawDuration, clipId);
        const newDuration = Math.max(0.2, snappedEnd - targetClip!.startTime);

        targetClip!.duration = newDuration;
        targetClip!.trimEnd = targetClip!.trimStart + newDuration;

        clipEl.style.width = `${newDuration * this._pixelsPerSecond}px`;
        this.recomputeProjectDuration();
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        this.render();
        this._onProjectChanged();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }


  public bindPlayheadEvents(signal: AbortSignal): void {
    const ruler = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-ruler-wrapper"]');
    const playheadHandle = this._container.querySelector<HTMLElement>('[data-ref="video-playhead-handle"]');
    const lanesArea = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-container"]');

    let scrubRafId: number | null = null;
    let pendingScrubTime: number | null = null;

    const getTimeFromClientX = (clientX: number): number => {
      const scrollable = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-tracks-area"]');
      if (!scrollable) return 0;
      const rect = scrollable.getBoundingClientRect();
      const scrollLeft = scrollable.scrollLeft || 0;
      const x = clientX - rect.left + scrollLeft;
      const project = this._getProject();
      return Math.max(0, Math.min(x / this._pixelsPerSecond, project.duration));
    };

    const startScrubbing = (initialClientX: number) => {
      this._isScrubbingPlayhead = true;
      this._hoverLineElement?.classList.add('is-hidden');
      this._onScrubStart?.();
      const initialTime = getTimeFromClientX(initialClientX);
      this.setPlayheadPosition(initialTime);
      this._onSeek(initialTime, true);

      const onMove = (me: MouseEvent) => {
        const time = getTimeFromClientX(me.clientX);
        this.setPlayheadPosition(time);
        pendingScrubTime = time;

        if (scrubRafId === null) {
          scrubRafId = requestAnimationFrame(() => {
            scrubRafId = null;
            if (pendingScrubTime !== null) {
              this._onSeek(pendingScrubTime, true);
              pendingScrubTime = null;
            }
          });
        }
      };

      const onUp = (me: MouseEvent) => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        this._isScrubbingPlayhead = false;
        if (scrubRafId !== null) {
          cancelAnimationFrame(scrubRafId);
          scrubRafId = null;
        }
        const finalTime = getTimeFromClientX(me.clientX);
        this.setPlayheadPosition(finalTime);
        this._onSeek(finalTime, false);
        this._onScrubEnd?.();
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    ruler?.addEventListener('mousedown', (e) => {
      startScrubbing(e.clientX);
    }, { signal });

    playheadHandle?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      startScrubbing(e.clientX);
    }, { signal });

    lanesArea?.addEventListener('click', (e) => {
      if (this._isDraggingMarquee) return;
      if ((e.target as HTMLElement).closest('.video-clip-item')) return;
      this.selectClip('');
      const time = getTimeFromClientX(e.clientX);
      this.setPlayheadPosition(time);
      this._onSeek(time, false);
    }, { signal });
  }

  public bindHoverPreview(signal: AbortSignal): void {
    const tracksArea = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-tracks-area"]');
    this._hoverLineElement = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-hover-line"]');
    this._hoverTooltipElement = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-hover-tooltip"]');

    if (!tracksArea || !this._hoverLineElement) return;

    const formatHoverTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const tenths = Math.floor((seconds % 1) * 10);
      return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`;
    };

    tracksArea.addEventListener('mousemove', (e) => {
      if (this._isDraggingMarquee || this._isScrubbingPlayhead) {
        this._hoverLineElement?.classList.add('is-hidden');
        return;
      }

      const rect = tracksArea.getBoundingClientRect();
      const x = e.clientX - rect.left + tracksArea.scrollLeft;
      if (x < 0) {
        this._hoverLineElement?.classList.add('is-hidden');
        return;
      }

      const project = this._getProject();
      const maxTotalWidth = Math.max(1200, (project.duration + 5) * this._pixelsPerSecond);
      if (x > maxTotalWidth) {
        this._hoverLineElement?.classList.add('is-hidden');
        return;
      }

      const hoverTime = Math.max(0, x / this._pixelsPerSecond);
      if (this._hoverTooltipElement) {
        this._hoverTooltipElement.textContent = formatHoverTime(hoverTime);
      }

      this._hoverLineElement!.style.transform = `translateX(${x}px)`;
      this._hoverLineElement!.classList.remove('is-hidden');
    }, { signal });

    tracksArea.addEventListener('mouseleave', () => {
      this._hoverLineElement?.classList.add('is-hidden');
    }, { signal });
  }

  public bindMarqueeSelection(signal: AbortSignal): void {
    const lanesContainer = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-container"]');
    const tracksArea = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-tracks-area"]');
    this._marqueeElement = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-marquee"]');

    if (!lanesContainer || !tracksArea || !this._marqueeElement) return;

    lanesContainer.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('.video-clip-item') || target.closest('.clip-trim-handle') || target.closest('.video-playhead-handle')) {
        return;
      }

      const containerRect = lanesContainer.getBoundingClientRect();
      const startX = e.clientX - containerRect.left + (tracksArea.scrollLeft || 0);
      const startY = e.clientY - containerRect.top + (tracksArea.scrollTop || 0);

      const isAdditive = e.shiftKey || e.ctrlKey || e.metaKey;
      const initialSelectedIds = isAdditive ? new Set(this._selectedClipIds) : new Set<string>();
      let newlySelectedIds = new Set<string>();
      let hasDragged = false;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const currX = moveEvent.clientX - containerRect.left + (tracksArea.scrollLeft || 0);
        const currY = moveEvent.clientY - containerRect.top + (tracksArea.scrollTop || 0);
        const dx = currX - startX;
        const dy = currY - startY;

        if (!hasDragged && Math.hypot(dx, dy) > 4) {
          hasDragged = true;
          this._isDraggingMarquee = true;
          this._hoverLineElement?.classList.add('is-hidden');
          this._marqueeElement?.classList.remove('is-hidden');
        }

        if (hasDragged && this._marqueeElement) {
          const minX = Math.min(startX, currX);
          const maxX = Math.max(startX, currX);
          const minY = Math.min(startY, currY);
          const maxY = Math.max(startY, currY);

          this._marqueeElement.style.left = `${minX}px`;
          this._marqueeElement.style.top = `${minY}px`;
          this._marqueeElement.style.width = `${maxX - minX}px`;
          this._marqueeElement.style.height = `${maxY - minY}px`;

          newlySelectedIds = new Set(initialSelectedIds);
          const project = this._getProject();
          const lanesList = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-list"]');
          const laneEls = lanesList ? Array.from(lanesList.querySelectorAll<HTMLElement>('.video-track-lane')) : [];

          laneEls.forEach((laneEl) => {
            const laneTop = laneEl.offsetTop;
            const laneBottom = laneTop + laneEl.offsetHeight;

            if (maxY >= laneTop && minY <= laneBottom) {
              const trackId = laneEl.getAttribute('data-track-id');
              const track = project.tracks.find((t) => t.id === trackId);
              if (track) {
                track.clips.forEach((clip) => {
                  const clipLeft = clip.startTime * this._pixelsPerSecond;
                  const clipRight = clipLeft + Math.max(20, clip.duration * this._pixelsPerSecond);

                  if (maxX >= clipLeft && minX <= clipRight) {
                    newlySelectedIds.add(clip.id);
                  }
                });
              }
            }
          });

          const allClipEls = this._container.querySelectorAll<HTMLElement>('.video-clip-item');
          allClipEls.forEach((el) => {
            const id = el.getAttribute('data-clip-id') || '';
            el.classList.toggle('is-selected', newlySelectedIds.has(id));
          });
        }
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (hasDragged) {
          this._isDraggingMarquee = false;
          this._marqueeElement?.classList.add('is-hidden');
          this.selectClips(Array.from(newlySelectedIds));
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }, { signal });
  }

  public bindKeyboardShortcuts(signal: AbortSignal): void {
    window.addEventListener('keydown', (e) => {
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement).tagName?.toLowerCase())) return;

      if (e.key === 's' || e.key === 'S' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        this.splitSelectedClip();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.deleteSelectedClip();
      } else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.duplicateSelectedClip();
      }
    }, { signal });
  }

}
