import { generateVideoSubtitlesApi } from '../../../services/api.service.js';
import { showToast } from '../../../services/toast.service.js';
import { setupDropdown } from '../../../utils/dom.util.js';
import { VideoClip, VideoProject, VideoTrack } from '../video.types.js';

export interface TimelineModalsManagerOptions {
  container: HTMLElement;
  getProject: () => VideoProject;
  getSelectedClip: () => VideoClip | null;
  onClipSelected?: (clipId: string | null) => void;
  onProjectChanged: () => void;
  recomputeProjectDuration: () => void;
  render: () => void;
  selectClip: (clipId: string) => void;
}

export class TimelineModalsManager {
  private _container: HTMLElement;
  private _getProject: () => VideoProject;
  private _getSelectedClip: () => VideoClip | null;
  private _onClipSelected?: (clipId: string | null) => void;
  private _onProjectChanged: () => void;
  private _recomputeProjectDuration: () => void;
  private _render: () => void;
  private _selectClip: (clipId: string) => void;

  private _selectedTransitionType = 'none';
  private _selectedSubtitleSourceClipId = '';
  private _selectedSubtitleLang = 'auto';
  private _selectedSubtitleStyle = 'karaoke_yellow';

  constructor(options: TimelineModalsManagerOptions) {
    this._container = options.container;
    this._getProject = options.getProject;
    this._getSelectedClip = options.getSelectedClip;
    this._onClipSelected = options.onClipSelected;
    this._onProjectChanged = options.onProjectChanged;
    this._recomputeProjectDuration = options.recomputeProjectDuration;
    this._render = options.render;
    this._selectClip = options.selectClip;
  }

  private recomputeProjectDuration(): void {
    this._recomputeProjectDuration();
  }

  private getSelectedClip(): VideoClip | null {
    return this._getSelectedClip();
  }

  private selectClip(clipId: string): void {
    this._selectClip(clipId);
  }

  private render(): void {
    this._render();
  }

  public openFiltersModal(): void {
    let clip = this.getSelectedClip();
    if (!clip) {
      const project = this._getProject();
      const playheadTime = project.currentTime || 0;
      for (const track of project.tracks) {
        const c = track.clips.find((cl) => playheadTime >= cl.startTime && playheadTime <= cl.startTime + cl.duration);
        if (c) {
          clip = c;
          this.selectClip(c.id);
          break;
        }
      }
    }
    if (!clip) {
      showToast('Selecciona un clip en la línea de tiempo para ajustar filtros.', 'info');
      return;
    }
    const backdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-filters-backdrop"]');
    if (!backdrop) return;

    const inBrightness = this._container.querySelector<HTMLInputElement>('[data-ref="input-filter-brightness"]');
    const inContrast = this._container.querySelector<HTMLInputElement>('[data-ref="input-filter-contrast"]');
    const inSaturate = this._container.querySelector<HTMLInputElement>('[data-ref="input-filter-saturate"]');
    const valBrightness = this._container.querySelector<HTMLElement>('[data-ref="val-filter-brightness"]');
    const valContrast = this._container.querySelector<HTMLElement>('[data-ref="val-filter-contrast"]');
    const valSaturate = this._container.querySelector<HTMLElement>('[data-ref="val-filter-saturate"]');
    const presetBtns = this._container.querySelectorAll<HTMLElement>('[data-ref^="btn-filter-preset-"]');

    const f = clip.filters || {};
    if (inBrightness) inBrightness.value = String(f.brightness ?? 1);
    if (inContrast) inContrast.value = String(f.contrast ?? 1);
    if (inSaturate) inSaturate.value = String(f.saturate ?? 1);
    if (valBrightness) valBrightness.textContent = `${Math.round((f.brightness ?? 1) * 100)}%`;
    if (valContrast) valContrast.textContent = `${Math.round((f.contrast ?? 1) * 100)}%`;
    if (valSaturate) valSaturate.textContent = `${Math.round((f.saturate ?? 1) * 100)}%`;

    const curPreset = f.preset || 'none';
    presetBtns.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-preset') === curPreset));

    backdrop.classList.add('is-visible');
  }

  public openTransitionsModal(): void {
    let clip = this.getSelectedClip();
    if (!clip) {
      const project = this._getProject();
      const playheadTime = project.currentTime || 0;
      for (const track of project.tracks) {
        const c = track.clips.find((cl) => playheadTime >= cl.startTime && playheadTime <= cl.startTime + cl.duration);
        if (c) {
          clip = c;
          this.selectClip(c.id);
          break;
        }
      }
    }
    if (!clip) {
      showToast('Selecciona un clip en la línea de tiempo para configurar la transición.', 'info');
      return;
    }
    const backdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-transitions-backdrop"]');
    if (!backdrop) return;

    const selectType = this._container.querySelector<HTMLSelectElement>('[data-ref="select-transition-type"]');
    const inDuration = this._container.querySelector<HTMLInputElement>('[data-ref="input-transition-duration"]');
    const valDuration = this._container.querySelector<HTMLElement>('[data-ref="val-transition-duration"]');

    const trans = clip.transition || { duration: 1.0, type: 'none' as const };
    this._selectedTransitionType = trans.type;
    const textEl = this._container.querySelector<HTMLElement>('[data-ref="transition-type-selected-text"]');
    const typeNames: Record<string, string> = {
      none: 'Ninguna (Corte Directo)',
      fade: 'Fundido a Negro (Fade Out/In)',
      dissolve: 'Disolución Cruzada (Cross Dissolve)',
      slide_left: 'Deslizar a la Izquierda (Slide)',
      wipe_left: 'Barrido a la Izquierda (Wipe)',
    };
    if (textEl) textEl.textContent = typeNames[this._selectedTransitionType] || 'Ninguna (Corte Directo)';
    this._container.querySelectorAll<HTMLElement>('[data-ref="dropdown-menu-transition-type"] .menu-item').forEach((item) => {
      item.classList.toggle('is-active', item.getAttribute('data-value') === this._selectedTransitionType);
    });
    if (inDuration) inDuration.value = String(trans.duration || 1.0);
    if (valDuration) valDuration.textContent = `${(trans.duration || 1.0).toFixed(1)}s`;

    backdrop.classList.add('is-visible');
  }

  public openAudioFadeModal(): void {
    let clip = this.getSelectedClip();
    if (!clip) {
      const project = this._getProject();
      const playheadTime = project.currentTime || 0;
      for (const track of project.tracks) {
        const c = track.clips.find((cl) => playheadTime >= cl.startTime && playheadTime <= cl.startTime + cl.duration);
        if (c) {
          clip = c;
          this.selectClip(c.id);
          break;
        }
      }
    }
    if (!clip) {
      showToast('Selecciona un clip en la línea de tiempo para configurar fundidos.', 'info');
      return;
    }
    const backdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-audio-fade-backdrop"]');
    if (!backdrop) return;

    const inFadeIn = this._container.querySelector<HTMLInputElement>('[data-ref="input-audio-fade-in"]');
    const inFadeOut = this._container.querySelector<HTMLInputElement>('[data-ref="input-audio-fade-out"]');
    const valFadeIn = this._container.querySelector<HTMLElement>('[data-ref="val-audio-fade-in"]');
    const valFadeOut = this._container.querySelector<HTMLElement>('[data-ref="val-audio-fade-out"]');

    if (inFadeIn) inFadeIn.value = String(clip.audioFadeIn || 0);
    if (inFadeOut) inFadeOut.value = String(clip.audioFadeOut || 0);
    if (valFadeIn) valFadeIn.textContent = `${(clip.audioFadeIn || 0).toFixed(1)}s`;
    if (valFadeOut) valFadeOut.textContent = `${(clip.audioFadeOut || 0).toFixed(1)}s`;

    backdrop.classList.add('is-visible');
  }

  public openSubtitlesModal(): void {
    const project = this._getProject();
    const eligibleClips: { clip: VideoClip; trackName: string }[] = [];

    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if ((clip.mediaType === 'video' || clip.mediaType === 'audio') && clip.assetUrl) {
          eligibleClips.push({ clip, trackName: track.name });
        }
      }
    }

    if (eligibleClips.length === 0) {
      showToast('No hay clips de video o audio en el proyecto para generar subtítulos.', 'info');
      return;
    }

    const backdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-subtitles-backdrop"]');
    const sourceList = this._container.querySelector<HTMLElement>('[data-ref="list-subtitles-source"]');
    const sourceText = this._container.querySelector<HTMLElement>('[data-ref="subtitles-source-selected-text"]');
    const errorBanner = this._container.querySelector<HTMLElement>('[data-ref="banner-subtitles-error"]');

    if (errorBanner) errorBanner.style.display = 'none';

    const selectedClip = this.getSelectedClip();
    let initialClip = eligibleClips[0];
    if (selectedClip) {
      const match = eligibleClips.find((i) => i.clip.id === selectedClip.id);
      if (match) initialClip = match;
    }
    this._selectedSubtitleSourceClipId = initialClip.clip.id;
    const startFmt = `${Math.floor(initialClip.clip.startTime / 60)}:${Math.floor(initialClip.clip.startTime % 60).toString().padStart(2, '0')}`;
    const endFmt = `${Math.floor((initialClip.clip.startTime + initialClip.clip.duration) / 60)}:${Math.floor((initialClip.clip.startTime + initialClip.clip.duration) % 60).toString().padStart(2, '0')}`;
    if (sourceText) sourceText.textContent = `${initialClip.clip.name} (${initialClip.trackName}) [${startFmt} - ${endFmt}]`;

    if (sourceList) {
      sourceList.innerHTML = eligibleClips.map((item) => {
        const startFormatted = `${Math.floor(item.clip.startTime / 60)}:${Math.floor(item.clip.startTime % 60).toString().padStart(2, '0')}`;
        const endFormatted = `${Math.floor((item.clip.startTime + item.clip.duration) / 60)}:${Math.floor((item.clip.startTime + item.clip.duration) % 60).toString().padStart(2, '0')}`;
        const isSel = item.clip.id === this._selectedSubtitleSourceClipId;
        return `<button type="button" class="menu-item${isSel ? ' is-active' : ''}" data-ref="btn-sub-src-${item.clip.id}" data-value="${item.clip.id}">
          <span class="menu-item__text">${item.clip.name} (${item.trackName}) [${startFormatted} - ${endFormatted}]</span>
        </button>`;
      }).join('');
    }

    if (backdrop) {
      backdrop.classList.add('is-visible');
    }
  }

  public bindModals(signal: AbortSignal): void {
    const filtersBackdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-filters-backdrop"]');
    const btnCloseFilters = this._container.querySelector<HTMLElement>('[data-ref="btn-close-filters-modal"]');
    const btnApplyFilters = this._container.querySelector<HTMLElement>('[data-ref="btn-apply-filters"]');
    const btnResetFilters = this._container.querySelector<HTMLElement>('[data-ref="btn-reset-filters"]');

    const inBrightness = this._container.querySelector<HTMLInputElement>('[data-ref="input-filter-brightness"]');
    const inContrast = this._container.querySelector<HTMLInputElement>('[data-ref="input-filter-contrast"]');
    const inSaturate = this._container.querySelector<HTMLInputElement>('[data-ref="input-filter-saturate"]');
    const valBrightness = this._container.querySelector<HTMLElement>('[data-ref="val-filter-brightness"]');
    const valContrast = this._container.querySelector<HTMLElement>('[data-ref="val-filter-contrast"]');
    const valSaturate = this._container.querySelector<HTMLElement>('[data-ref="val-filter-saturate"]');
    const presetBtns = this._container.querySelectorAll<HTMLElement>('[data-ref^="btn-filter-preset-"]');

    inBrightness?.addEventListener('input', () => {
      if (valBrightness) valBrightness.textContent = `${Math.round(parseFloat(inBrightness.value) * 100)}%`;
    }, { signal });

    inContrast?.addEventListener('input', () => {
      if (valContrast) valContrast.textContent = `${Math.round(parseFloat(inContrast.value) * 100)}%`;
    }, { signal });

    inSaturate?.addEventListener('input', () => {
      if (valSaturate) valSaturate.textContent = `${Math.round(parseFloat(inSaturate.value) * 100)}%`;
    }, { signal });

    presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        presetBtns.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
      }, { signal });
    });

    const closeFilters = () => {
      if (filtersBackdrop) {
        filtersBackdrop.classList.remove('is-visible');
      }
    };

    btnCloseFilters?.addEventListener('click', closeFilters, { signal });
    filtersBackdrop?.addEventListener('click', (e) => {
      if (e.target === filtersBackdrop) closeFilters();
    }, { signal });

    btnResetFilters?.addEventListener('click', () => {
      if (inBrightness) inBrightness.value = '1';
      if (inContrast) inContrast.value = '1';
      if (inSaturate) inSaturate.value = '1';
      if (valBrightness) valBrightness.textContent = '100%';
      if (valContrast) valContrast.textContent = '100%';
      if (valSaturate) valSaturate.textContent = '100%';
      presetBtns.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-preset') === 'none'));
    }, { signal });

    btnApplyFilters?.addEventListener('click', () => {
      const clip = this.getSelectedClip();
      if (clip) {
        const activePresetBtn = this._container.querySelector<HTMLElement>('[data-ref^="btn-filter-preset-"].is-active');
        const preset = (activePresetBtn?.getAttribute('data-preset') || 'none') as any;
        clip.filters = {
          brightness: inBrightness ? parseFloat(inBrightness.value) : 1,
          contrast: inContrast ? parseFloat(inContrast.value) : 1,
          preset,
          saturate: inSaturate ? parseFloat(inSaturate.value) : 1,
        };
        this.render();
        this._onProjectChanged();
      }
      closeFilters();
    }, { signal });

    const transBackdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-transitions-backdrop"]');
    const btnCloseTrans = this._container.querySelector<HTMLElement>('[data-ref="btn-close-transitions-modal"]');
    const btnApplyTrans = this._container.querySelector<HTMLElement>('[data-ref="btn-apply-transition"]');
    const inTransDur = this._container.querySelector<HTMLInputElement>('[data-ref="input-transition-duration"]');
    const valTransDur = this._container.querySelector<HTMLElement>('[data-ref="val-transition-duration"]');

    const transWrapper = this._container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-transition-type"]');
    const transTrigger = this._container.querySelector<HTMLElement>('[data-ref="btn-trigger-transition-type"]');
    const transMenu = this._container.querySelector<HTMLElement>('[data-ref="dropdown-menu-transition-type"]');
    const transBackdropEl = this._container.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-transition-type"]');
    const transText = this._container.querySelector<HTMLElement>('[data-ref="transition-type-selected-text"]');

    if (transWrapper && transTrigger && transMenu) {
      setupDropdown(transWrapper, { backdrop: transBackdropEl || undefined, menu: transMenu, trigger: transTrigger });
      transMenu.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest<HTMLElement>('.menu-item');
        if (!item) return;
        const val = item.getAttribute('data-value');
        if (val) {
          this._selectedTransitionType = val;
          transMenu.querySelectorAll('.menu-item').forEach((m) => m.classList.toggle('is-active', m === item));
          if (transText) {
            const spanText = item.querySelector('.menu-item__text')?.textContent;
            if (spanText) transText.textContent = spanText;
          }
        }
      }, { signal });
    }

    inTransDur?.addEventListener('input', () => {
      if (valTransDur) valTransDur.textContent = `${parseFloat(inTransDur.value).toFixed(1)}s`;
    }, { signal });

    const closeTrans = () => {
      if (transBackdrop) {
        transBackdrop.classList.remove('is-visible');
      }
    };

    btnCloseTrans?.addEventListener('click', closeTrans, { signal });
    transBackdrop?.addEventListener('click', (e) => {
      if (e.target === transBackdrop) closeTrans();
    }, { signal });

    btnApplyTrans?.addEventListener('click', () => {
      const clip = this.getSelectedClip();
      if (clip && inTransDur) {
        clip.transition = {
          duration: parseFloat(inTransDur.value) || 1.0,
          type: this._selectedTransitionType as any,
        };
        this.render();
        this._onProjectChanged();
      }
      closeTrans();
    }, { signal });

    const fadeBackdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-audio-fade-backdrop"]');
    const btnCloseFade = this._container.querySelector<HTMLElement>('[data-ref="btn-close-audio-fade-modal"]');
    const btnApplyFade = this._container.querySelector<HTMLElement>('[data-ref="btn-apply-audio-fade"]');
    const inFadeIn = this._container.querySelector<HTMLInputElement>('[data-ref="input-audio-fade-in"]');
    const inFadeOut = this._container.querySelector<HTMLInputElement>('[data-ref="input-audio-fade-out"]');
    const valFadeIn = this._container.querySelector<HTMLElement>('[data-ref="val-audio-fade-in"]');
    const valFadeOut = this._container.querySelector<HTMLElement>('[data-ref="val-audio-fade-out"]');

    inFadeIn?.addEventListener('input', () => {
      if (valFadeIn) valFadeIn.textContent = `${parseFloat(inFadeIn.value).toFixed(1)}s`;
    }, { signal });

    inFadeOut?.addEventListener('input', () => {
      if (valFadeOut) valFadeOut.textContent = `${parseFloat(inFadeOut.value).toFixed(1)}s`;
    }, { signal });

    const closeFade = () => {
      if (fadeBackdrop) {
        fadeBackdrop.classList.remove('is-visible');
      }
    };

    btnCloseFade?.addEventListener('click', closeFade, { signal });
    fadeBackdrop?.addEventListener('click', (e) => {
      if (e.target === fadeBackdrop) closeFade();
    }, { signal });

    btnApplyFade?.addEventListener('click', () => {
      const clip = this.getSelectedClip();
      if (clip && inFadeIn && inFadeOut) {
        clip.audioFadeIn = parseFloat(inFadeIn.value) || 0;
        clip.audioFadeOut = parseFloat(inFadeOut.value) || 0;
        this.render();
        this._onProjectChanged();
      }
      closeFade();
    }, { signal });

    const subBackdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-subtitles-backdrop"]');
    const btnCloseSub = this._container.querySelector<HTMLElement>('[data-ref="btn-close-subtitles-modal"]');
    const btnGenSub = this._container.querySelector<HTMLElement>('[data-ref="btn-generate-subtitles"]');
    const btnGenSubText = this._container.querySelector<HTMLElement>('[data-ref="btn-generate-subtitles-text"]');
    const errorBanner = this._container.querySelector<HTMLElement>('[data-ref="banner-subtitles-error"]');
    const errorText = this._container.querySelector<HTMLElement>('[data-ref="subtitles-error-text"]');

    const subSrcWrapper = this._container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-subtitles-source"]');
    const subSrcTrigger = this._container.querySelector<HTMLElement>('[data-ref="btn-trigger-subtitles-source"]');
    const subSrcMenu = this._container.querySelector<HTMLElement>('[data-ref="dropdown-menu-subtitles-source"]');
    const subSrcBackdrop = this._container.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-subtitles-source"]');
    const subSrcText = this._container.querySelector<HTMLElement>('[data-ref="subtitles-source-selected-text"]');

    if (subSrcWrapper && subSrcTrigger && subSrcMenu) {
      setupDropdown(subSrcWrapper, { backdrop: subSrcBackdrop || undefined, menu: subSrcMenu, trigger: subSrcTrigger });
      subSrcMenu.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest<HTMLElement>('.menu-item');
        if (!item) return;
        const val = item.getAttribute('data-value');
        if (val) {
          this._selectedSubtitleSourceClipId = val;
          subSrcMenu.querySelectorAll('.menu-item').forEach((m) => m.classList.toggle('is-active', m === item));
          if (subSrcText) {
            const spanText = item.querySelector('.menu-item__text')?.textContent;
            if (spanText) subSrcText.textContent = spanText;
          }
        }
      }, { signal });
    }

    const subLangWrapper = this._container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-subtitles-lang"]');
    const subLangTrigger = this._container.querySelector<HTMLElement>('[data-ref="btn-trigger-subtitles-lang"]');
    const subLangMenu = this._container.querySelector<HTMLElement>('[data-ref="dropdown-menu-subtitles-lang"]');
    const subLangBackdrop = this._container.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-subtitles-lang"]');
    const subLangText = this._container.querySelector<HTMLElement>('[data-ref="subtitles-lang-selected-text"]');

    if (subLangWrapper && subLangTrigger && subLangMenu) {
      setupDropdown(subLangWrapper, { backdrop: subLangBackdrop || undefined, menu: subLangMenu, trigger: subLangTrigger });
      subLangMenu.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest<HTMLElement>('.menu-item');
        if (!item) return;
        const val = item.getAttribute('data-value');
        if (val) {
          this._selectedSubtitleLang = val;
          subLangMenu.querySelectorAll('.menu-item').forEach((m) => m.classList.toggle('is-active', m === item));
          if (subLangText) {
            const spanText = item.querySelector('.menu-item__text')?.textContent;
            if (spanText) subLangText.textContent = spanText;
          }
        }
      }, { signal });
    }

    const subStyleWrapper = this._container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-subtitles-style"]');
    const subStyleTrigger = this._container.querySelector<HTMLElement>('[data-ref="btn-trigger-subtitles-style"]');
    const subStyleMenu = this._container.querySelector<HTMLElement>('[data-ref="dropdown-menu-subtitles-style"]');
    const subStyleBackdrop = this._container.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-subtitles-style"]');
    const subStyleText = this._container.querySelector<HTMLElement>('[data-ref="subtitles-style-selected-text"]');

    if (subStyleWrapper && subStyleTrigger && subStyleMenu) {
      setupDropdown(subStyleWrapper, { backdrop: subStyleBackdrop || undefined, menu: subStyleMenu, trigger: subStyleTrigger });
      subStyleMenu.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest<HTMLElement>('.menu-item');
        if (!item) return;
        const val = item.getAttribute('data-value');
        if (val) {
          this._selectedSubtitleStyle = val;
          subStyleMenu.querySelectorAll('.menu-item').forEach((m) => m.classList.toggle('is-active', m === item));
          if (subStyleText) {
            const spanText = item.querySelector('.menu-item__text')?.textContent;
            if (spanText) subStyleText.textContent = spanText;
          }
        }
      }, { signal });
    }

    const closeSub = () => {
      if (subBackdrop) {
        subBackdrop.classList.remove('is-visible');
      }
    };

    btnCloseSub?.addEventListener('click', closeSub, { signal });
    subBackdrop?.addEventListener('click', (e) => {
      if (e.target === subBackdrop) closeSub();
    }, { signal });

    btnGenSub?.addEventListener('click', async () => {
      const project = this._getProject();
      const clipId = this._selectedSubtitleSourceClipId;
      let targetClip: VideoClip | null = null;

      for (const track of project.tracks) {
        const found = track.clips.find((c) => c.id === clipId);
        if (found) {
          targetClip = found;
          break;
        }
      }

      if (!targetClip || !targetClip.assetUrl) {
        if (errorBanner && errorText) {
          errorText.textContent = 'Selecciona un clip válido con audio para transcribir.';
          errorBanner.style.display = 'flex';
        }
        return;
      }

      if (btnGenSub) (btnGenSub as HTMLButtonElement).disabled = true;
      if (btnGenSubText) btnGenSubText.textContent = 'Transcribiendo con Gemini IA...';
      if (errorBanner) errorBanner.style.display = 'none';

      try {
        const language = this._selectedSubtitleLang || 'auto';
        const style = this._selectedSubtitleStyle || 'karaoke_yellow';

        const result = await generateVideoSubtitlesApi(targetClip.assetUrl, {
          language,
          offsetSeconds: targetClip.startTime,
        });

        if (!result.success || !result.subtitles) {
          if (errorBanner && errorText) {
            errorText.textContent = result.error || 'No se pudieron generar los subtítulos. Intenta nuevamente.';
            errorBanner.style.display = 'flex';
          }
          return;
        }

        if (result.subtitles.length === 0) {
          showToast('No se detectó voz ni diálogo inteligible en el audio del clip seleccionado.', 'info');
          closeSub();
          return;
        }

        let subtitleTrack = project.tracks.find((t) => t.name === 'Subtítulos IA' && t.type === 'overlay');
        if (!subtitleTrack) {
          subtitleTrack = {
            clips: [],
            id: `track_${Date.now()}_subtitles`,
            name: 'Subtítulos IA',
            type: 'overlay',
          };
          project.tracks.push(subtitleTrack);
        }

        const isKaraokeYellow = style === 'karaoke_yellow';
        const isKaraokeWhite = style === 'karaoke_white';
        const isKaraoke = isKaraokeYellow || isKaraokeWhite;

        const baseColor = isKaraokeWhite ? '#fde047' : (style === 'yellow' ? '#fde047' : '#ffffff');
        const highlightColor = isKaraokeWhite ? '#ffffff' : '#facc15';
        const highlightStyle = isKaraoke ? 'karaoke' : 'none';
        const bgColor = style === 'boxed' ? 'rgba(0, 0, 0, 0.75)' : undefined;
        const strokeColor = '#000000';
        const strokeWidth = isKaraoke ? 5 : (style === 'standard' || style === 'yellow' ? 4 : 0);
        const fontSize = 46;

        for (let i = 0; i < result.subtitles.length; i++) {
          const item = result.subtitles[i] as { end: number; start: number; text: string; words?: Array<{ end: number; start: number; word: string }> };
          const dur = Math.max(0.4, item.end - item.start);

          const words = (item.words && item.words.length > 0)
            ? item.words.map((w: any) => ({
                end: Math.min(dur, Math.max(0.05, w.end)),
                start: Math.max(0, w.start),
                word: w.word,
              }))
            : undefined;

          const subClip: VideoClip = {
            duration: dur,
            id: `sub_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
            mediaType: 'text',
            name: item.text.slice(0, 20),
            sourceDuration: dur,
            startTime: item.start,
            textConfig: {
              backgroundColor: bgColor,
              color: baseColor,
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize,
              fontWeight: '800',
              highlightColor: isKaraoke ? highlightColor : undefined,
              highlightStyle,
              strokeColor,
              strokeWidth,
              text: item.text,
              textAlign: 'center',
              words,
            },
            transform: {
              x: project.width ? project.width / 2 : 960,
              y: project.height ? Math.round(project.height * 0.85) : 920,
            },
            trimEnd: dur,
            trimStart: 0,
            volume: 1,
          };

          subtitleTrack.clips.push(subClip);
        }

        this.recomputeProjectDuration();
        this.render();
        this._onProjectChanged();
        closeSub();
        showToast(`Se generaron ${result.subtitles.length} subtítulos con IA exitosamente.`, 'success');
      } catch {
        if (errorBanner && errorText) {
          errorText.textContent = 'Ocurrió un error inesperado al procesar los subtítulos.';
          errorBanner.style.display = 'flex';
        }
      } finally {
        if (btnGenSub) (btnGenSub as HTMLButtonElement).disabled = false;
        if (btnGenSubText) btnGenSubText.textContent = 'Generar Subtítulos';
      }
    }, { signal });
  }

}
