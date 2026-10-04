import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, getApi, postApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { PresentationProject, PresentationSlideItem, StageCanvasOptions } from '../../types/stage.types.js';

export interface StageLoaderHost {
  accessLevel: 'private' | 'public';
  activeSlideId: string;
  canvasRecord: any;
  canvasServerId: number | null;
  canvasType: 'presentation' | 'social';
  canvasUserId: number | null;
  canvasUuid: string;
  container: HTMLElement;
  getActiveSlide(): PresentationSlideItem;
  isOwner: boolean;
  ownerInfo: { avatarUrl: string | null; id: number | null; subscriptionTier: string; username: string } | null;
  publicRole: 'editor' | 'viewer';
  role: 'editor' | 'owner' | 'viewer';
  roomToken: string;
  selectedSlideId: string | null;
  slideDuration: number;
  slideHeight: number;
  slides: PresentationSlideItem[];
  slideWidth: number;
  stageOptions: StageCanvasOptions;
  updateSlideDurationUI(): void;
}

export class StageLoaderManager {
  private host: StageLoaderHost;

  constructor(host: StageLoaderHost) {
    this.host = host;
  }

  public async loadPresentationData(): Promise<void> {
    let rawData: any = null;
    let canvas: any = this.host.canvasRecord || (await getLocalCanvasByUuid(this.host.canvasUuid));
    if (canvas && canvas.data) {
      this.host.canvasRecord = canvas;
      rawData = canvas.data;
      this.host.canvasServerId = canvas.id || null;
      this.host.canvasUserId = canvas.user_id || null;
      if (canvas.role) this.host.role = canvas.role;
      if (canvas.room_token) this.host.roomToken = canvas.room_token;
      if (canvas.public_role) this.host.publicRole = canvas.public_role;
      if (canvas.access_level) this.host.accessLevel = canvas.access_level;
    }

    if (!canvas || !canvas.data || (!this.host.canvasServerId && currentUser)) {
      try {
        const res = await getApi(API_ROUTES.canvases.byId(this.host.canvasUuid));
        if (res.ok) {
          const body = await res.json();
          if (body && body.canvas) {
            canvas = body.canvas;
            this.host.canvasRecord = canvas;
            rawData = canvas.data;
            this.host.canvasServerId = canvas.id || null;
            this.host.canvasUserId = canvas.user_id || null;
            if (body.role) this.host.role = body.role;
            if (canvas.public_role) this.host.publicRole = canvas.public_role;
            if (canvas.access_level) this.host.accessLevel = canvas.access_level;
            if (body.room_token) this.host.roomToken = body.room_token;
            if (body.owner) {
              this.host.ownerInfo = {
                avatarUrl: body.owner.avatar_url || null,
                id: body.owner.id || null,
                subscriptionTier: body.owner.subscription_tier || 'free',
                username: body.owner.username || 'Propietario',
              };
            }
            if (canvas.data) {
              void saveLocalCanvas({
                ...canvas,
                data: canvas.data,
                is_local: false,
                role: this.host.role,
                room_token: this.host.roomToken,
              });
            }
          }
        } else if (res.status === 404 && currentUser && rawData) {
          const syncRes = await postApi(API_ROUTES.canvases.sync, {
            canvas_type: this.host.canvasType || 'presentation',
            data: rawData,
            height: this.host.slideHeight,
            name: this.host.canvasRecord?.name || (this.host.canvasType === 'social' ? 'Diseño para redes sin título' : 'Presentación sin título'),
            unit: this.host.canvasType || 'presentation',
            uuid: this.host.canvasUuid,
            width: this.host.slideWidth,
          });
          if (syncRes.ok) {
            const syncBody = await syncRes.json();
            if (syncBody?.canvas) {
              canvas = syncBody.canvas;
              this.host.canvasRecord = canvas;
              this.host.canvasServerId = canvas.id || null;
              this.host.canvasUserId = canvas.user_id || null;
              this.host.role = syncBody.role || 'owner';
              this.host.roomToken = syncBody.room_token || '';
              void saveLocalCanvas({
                ...canvas,
                data: rawData,
                is_local: false,
                role: this.host.role,
                room_token: this.host.roomToken,
              });
            }
          }
        }
      } catch {}
    }

    if (!rawData) {
      const local = await getLocalCanvasByUuid(this.host.canvasUuid);
      if (local && local.data) {
        rawData = local.data;
        if (!this.host.canvasRecord) this.host.canvasRecord = local;
      }
    }

    const isEmbedded = Boolean(this.host.stageOptions.isEmbedded || (typeof window !== 'undefined' && (window.self !== window.top || window.location.search.includes('embedded=true'))));
    if (!isEmbedded && this.host.canvasServerId && !this.host.roomToken) {
      try {
        const tokenRes = await getApi(API_ROUTES.canvases.token(this.host.canvasUuid));
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData?.room_token) {
            this.host.roomToken = tokenData.room_token;
          }
        }
      } catch {}
    }

    if (canvas) {
      this.host.canvasServerId = canvas.id || this.host.canvasServerId;
      this.host.canvasUserId = canvas.user_id || this.host.canvasUserId;
      if (this.host.canvasUserId && currentUser) {
        this.host.isOwner = currentUser.id === this.host.canvasUserId;
      } else if (this.host.canvasUserId && !currentUser) {
        this.host.isOwner = false;
      } else {
        this.host.isOwner = true;
      }
    }

    let project: PresentationProject | null = null;
    if (rawData) {
      try {
        project = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      } catch {}
    }

    const rawSlides = (project && Array.isArray((project as any).slides) && (project as any).slides.length > 0)
      ? (project as any).slides
      : (project && Array.isArray(project.pages) && project.pages.length > 0)
      ? project.pages
      : null;

    if (rawSlides && rawSlides.length > 0) {
      this.host.slides = rawSlides.map((p: any, idx: number) => ({
        background: p.background || { color: '#ffffff', dotColor: '#cbd5e1', type: 'solid' },
        camera: p.camera || { x: 0, y: 0, zoom: 1 },
        createdAt: p.createdAt || Date.now(),
        duration: p.duration || 5.0,
        elements: Array.isArray(p.elements) ? p.elements : [],
        id: p.id || (this.host.canvasType === 'social' ? `page-${idx + 1}` : `slide-${idx + 1}`),
        name: p.name || (this.host.canvasType === 'social' ? `Página ${idx + 1}` : `Diapositiva ${idx + 1}`),
      }));
      this.host.activeSlideId = (project as any)?.activeSlideId || project?.activePageId || this.host.slides[0].id;
      this.host.selectedSlideId = this.host.activeSlideId;
      this.host.slideWidth = project?.width || (canvas?.width || (this.host.canvasType === 'social' ? 940 : 1280));
      this.host.slideHeight = project?.height || (canvas?.height || (this.host.canvasType === 'social' ? 788 : 720));
    } else {
      this.host.slides = [
        {
          background: { color: '#ffffff', dotColor: '#cbd5e1', type: 'solid' },
          camera: { x: 0, y: 0, zoom: 1 },
          createdAt: Date.now(),
          duration: 5.0,
          elements: [],
          id: this.host.canvasType === 'social' ? 'page-1' : 'slide-1',
          name: this.host.canvasType === 'social' ? 'Página 1' : 'Diapositiva 1',
        },
      ];
      this.host.activeSlideId = this.host.slides[0].id;
      this.host.selectedSlideId = this.host.slides[0].id;
      this.host.slideWidth = canvas?.width || (this.host.canvasType === 'social' ? 940 : 1280);
      this.host.slideHeight = canvas?.height || (this.host.canvasType === 'social' ? 788 : 720);
    }

    const titleEl = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-title"]');
    if (titleEl) {
      titleEl.textContent = this.host.canvasRecord?.name || (this.host.canvasType === 'social' ? 'Diseño para redes sin título' : 'Presentación sin título');
    }

    const currentSlide = this.host.getActiveSlide();
    if (currentSlide?.duration) {
      this.host.slideDuration = currentSlide.duration;
      this.host.updateSlideDurationUI();
    }
  }
}
