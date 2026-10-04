import { VideoClip } from '../video.types.js';

export interface TimelineContextMenuManagerOptions {
  container: HTMLElement;
  deleteSelectedClip: () => void;
  detachAudioFromClip: () => void;
  duplicateSelectedClip: () => void;
  getSelectedClip: () => VideoClip | null;
  rippleDeleteSelectedClip: () => void;
  selectClip: (clipId: string) => void;
  splitSelectedClip: () => void;
}

export class TimelineContextMenuManager {
  private _container: HTMLElement;
  private _contextMenuEl: HTMLElement | null = null;
  private _deleteSelectedClip: () => void;
  private _detachAudioFromClip: () => void;
  private _duplicateSelectedClip: () => void;
  private _getSelectedClip: () => VideoClip | null;
  private _rippleDeleteSelectedClip: () => void;
  private _selectClip: (clipId: string) => void;
  private _splitSelectedClip: () => void;

  constructor(options: TimelineContextMenuManagerOptions) {
    this._container = options.container;
    this._deleteSelectedClip = options.deleteSelectedClip;
    this._detachAudioFromClip = options.detachAudioFromClip;
    this._duplicateSelectedClip = options.duplicateSelectedClip;
    this._getSelectedClip = options.getSelectedClip;
    this._rippleDeleteSelectedClip = options.rippleDeleteSelectedClip;
    this._selectClip = options.selectClip;
    this._splitSelectedClip = options.splitSelectedClip;
  }

  public bindContextMenu(signal: AbortSignal): void {
    this._contextMenuEl = this._container.querySelector<HTMLElement>('[data-ref="video-clip-context-menu"]');
    if (!this._contextMenuEl) return;

    window.addEventListener(
      'click',
      (e) => {
        if (this._contextMenuEl && !this._contextMenuEl.contains(e.target as Node)) {
          this.hideContextMenu();
        }
      },
      { signal }
    );

    const btnDetach = this._contextMenuEl.querySelector<HTMLElement>('[data-ref="ctx-btn-detach-audio"]');
    const btnSplit = this._contextMenuEl.querySelector<HTMLElement>('[data-ref="ctx-btn-split"]');
    const btnDuplicate = this._contextMenuEl.querySelector<HTMLElement>('[data-ref="ctx-btn-duplicate"]');
    const btnRipple = this._contextMenuEl.querySelector<HTMLElement>('[data-ref="ctx-btn-ripple-delete"]');
    const btnDelete = this._contextMenuEl.querySelector<HTMLElement>('[data-ref="ctx-btn-delete"]');

    btnDetach?.addEventListener(
      'click',
      () => {
        this.hideContextMenu();
        this._detachAudioFromClip();
      },
      { signal }
    );

    btnSplit?.addEventListener(
      'click',
      () => {
        this.hideContextMenu();
        this._splitSelectedClip();
      },
      { signal }
    );

    btnDuplicate?.addEventListener(
      'click',
      () => {
        this.hideContextMenu();
        this._duplicateSelectedClip();
      },
      { signal }
    );

    btnRipple?.addEventListener(
      'click',
      () => {
        this.hideContextMenu();
        this._rippleDeleteSelectedClip();
      },
      { signal }
    );

    btnDelete?.addEventListener(
      'click',
      () => {
        this.hideContextMenu();
        this._deleteSelectedClip();
      },
      { signal }
    );
  }

  public showContextMenu(e: MouseEvent, clipId: string): void {
    if (!this._contextMenuEl) {
      this._contextMenuEl = this._container.querySelector<HTMLElement>('[data-ref="video-clip-context-menu"]');
    }
    if (!this._contextMenuEl) return;

    this._selectClip(clipId);
    const clip = this._getSelectedClip();

    const btnDetach = this._contextMenuEl.querySelector<HTMLElement>('[data-ref="ctx-btn-detach-audio"]');
    if (btnDetach) {
      btnDetach.style.display = clip && clip.mediaType === 'video' && clip.assetUrl ? 'flex' : 'none';
    }

    const menuW = 220;
    const menuH = 180;
    const x = Math.min(window.innerWidth - menuW - 10, Math.max(10, e.clientX));
    const y = Math.min(window.innerHeight - menuH - 10, Math.max(10, e.clientY));

    this._contextMenuEl.style.left = `${x}px`;
    this._contextMenuEl.style.top = `${y}px`;
    this._contextMenuEl.style.display = 'flex';
  }

  public hideContextMenu(): void {
    if (this._contextMenuEl) {
      this._contextMenuEl.style.display = 'none';
    }
  }
}
