import { navigate } from '../app-router.js';
import { openUpgradeModal } from '../components/upgrade-modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, postApi } from './api.service.js';
import { saveLocalCanvas } from './canvas-storage.service.js';
import { t } from './i18n.service.js';
import { showToast } from './toast.service.js';

export interface CreateCanvasOptions {
  name: string;
  width: number;
  height: number;
  templateImage?: string | null;
  bgType?: 'transparent' | 'solid';
  solidColor?: string;
  checkSize?: number;
  fps?: number;
  onionSkin?: boolean;
}

export async function createAndOpenCanvas(options: CreateCanvasOptions): Promise<void> {
  const width = options.width;
  const height = options.height;

  const userTier = (currentUser?.subscription_tier || 'free').toLowerCase();
  const maxDim = userTier === 'business' || userTier === 'negocios' ? 4096 : (userTier === 'pro' ? 2048 : 1024);
  if (width > maxDim || height > maxDim) {
    const tierName = userTier === 'free' ? 'Gratis' : (userTier === 'pro' ? 'Pro' : 'Negocios');
    showToast(`El tamaño (${width}×${height} px) supera el límite de tu plan ${tierName} (${maxDim}×${maxDim} px).`, 'warning');
    openUpgradeModal(userTier === 'free' ? 'pro' : 'business');
    return;
  }

  const name = options.name.trim() || t('canvas.input_name_placeholder');
  const bgType = options.bgType || 'transparent';
  const solidColor = options.solidColor || '#ffffff';
  const checkSize = options.checkSize || 16;
  const fps = options.fps || 8;
  const onionSkin = options.onionSkin ?? false;

  let templateDataUrl: string | null = null;

  if (options.templateImage) {
    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        const img = new Image();
        await new Promise<void>((resolve) => {
          let resolved = false;
          const done = () => {
            if (resolved) return;
            resolved = true;
            try {
              ctx.drawImage(img, 0, 0, width, height);
            } catch {}
            resolve();
          };
          img.onload = done;
          img.onerror = () => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          };
          img.src = options.templateImage!;
          if (img.complete && img.naturalWidth > 0) {
            done();
          }
        });
        try {
          templateDataUrl = offscreen.toDataURL('image/png');
        } catch {}
      }
    } catch {}

    if (!templateDataUrl) {
      templateDataUrl = options.templateImage;
    }
  }

  const initialProject = {
    version: 1,
    fps,
    onionSkin,
    activeFrameId: 'frame_1',
    background: {
      type: bgType,
      color: solidColor,
      checkSize: checkSize,
      checkColor1: '#ffffff',
      checkColor2: '#e2e8f0',
    },
    animationTags: [],
    frames: [
      {
        id: 'frame_1',
        name: 'Cuadro 1',
        activeLayerId: 'layer_1',
        layers: [
          {
            id: 'layer_1',
            name: options.templateImage ? name : 'Capa 1',
            visible: true,
            opacity: 1.0,
            data: templateDataUrl || '',
          },
        ],
      },
    ],
  };

  const initialData = JSON.stringify(initialProject);

  let previewThumbnail: string | null = null;
  const maxThumbDim = 320;
  let thumbW = width;
  let thumbH = height;
  if (thumbW > maxThumbDim || thumbH > maxThumbDim) {
    const ratio = Math.min(maxThumbDim / thumbW, maxThumbDim / thumbH);
    thumbW = Math.max(1, Math.round(thumbW * ratio));
    thumbH = Math.max(1, Math.round(thumbH * ratio));
  }

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbW;
  thumbCanvas.height = thumbH;
  const thumbCtx = thumbCanvas.getContext('2d');

  if (thumbCtx) {
    thumbCtx.imageSmoothingEnabled = false;
    if (templateDataUrl) {
      const thumbImg = new Image();
      await new Promise<void>((r) => {
        thumbImg.onload = () => {
          try {
            thumbCtx.drawImage(thumbImg, 0, 0, thumbW, thumbH);
          } catch {}
          r();
        };
        thumbImg.onerror = () => r();
        thumbImg.src = templateDataUrl!;
        if (thumbImg.complete && thumbImg.naturalWidth > 0) {
          try {
            thumbCtx.drawImage(thumbImg, 0, 0, thumbW, thumbH);
          } catch {}
          r();
        }
      });
    } else {
      if (bgType === 'solid') {
        thumbCtx.fillStyle = solidColor;
        thumbCtx.fillRect(0, 0, thumbW, thumbH);
      } else {
        const cs = Math.max(4, Math.round(checkSize * (thumbW / width)));
        for (let y = 0; y < thumbH; y += cs) {
          for (let x = 0; x < thumbW; x += cs) {
            const isEven = (Math.floor(x / cs) + Math.floor(y / cs)) % 2 === 0;
            thumbCtx.fillStyle = isEven ? '#ffffff' : '#e2e8f0';
            thumbCtx.fillRect(x, y, cs, cs);
          }
        }
      }
    }
    try {
      previewThumbnail = thumbCanvas.toDataURL('image/png');
    } catch {
      previewThumbnail = templateDataUrl;
    }
  } else {
    previewThumbnail = templateDataUrl;
  }

  if (currentUser) {
    const res = await postApi(API_ROUTES.canvases.base, {
      name,
      width,
      height,
      unit: 'px',
      data: initialData,
      preview_thumbnail: previewThumbnail,
    });

    if (res.ok) {
      const created = await res.json();
      const canvasUuid = created?.canvas?.uuid || created?.uuid;
      showToast(t('canvas.toast_created'), 'success');
      navigate(`/design/${canvasUuid}`);
      return;
    }

    const err = await res.json().catch(() => null);
    throw new Error(err?.message || t('canvas.error_save'));
  }

  const localUuid = crypto.randomUUID();
  const now = new Date().toISOString();
  await saveLocalCanvas({
    uuid: localUuid,
    name,
    width,
    height,
    unit: 'px',
    data: initialData,
    preview_thumbnail: previewThumbnail || undefined,
    created_at: now,
    updated_at: now,
    is_local: true,
  });

  showToast(t('canvas.toast_created_guest'), 'success');
  navigate(`/design/${localUuid}`);
}
