import { API_ROUTES } from '../config/api-routes.js';
import { postApi } from './api.service.js';

export interface RemoveBackgroundResponse {
  error?: string;
  mimeType?: string;
  success: boolean;
  upgradeRequired?: boolean;
  url?: string;
}

export async function removeImageBackground(imageSrc: string | File | Blob): Promise<RemoveBackgroundResponse> {
  try {
    let res: Response;

    if (imageSrc instanceof File || imageSrc instanceof Blob) {
      const formData = new FormData();
      formData.append('image', imageSrc);
      res = await postApi(API_ROUTES.ai.removeBackground, formData);
    } else if (typeof imageSrc === 'string') {
      const trimmed = imageSrc.trim();
      if (trimmed.startsWith('data:image/')) {
        res = await postApi(API_ROUTES.ai.removeBackground, { imageBase64: trimmed });
      } else {
        res = await postApi(API_ROUTES.ai.removeBackground, { imageUrl: trimmed });
      }
    } else {
      return {
        error: 'Formato de imagen inválido.',
        success: false,
      };
    }

    if (!res.ok) {
      let errMsg = 'No se pudo eliminar el fondo de la imagen.';
      let upgradeRequired = false;
      try {
        const body = await res.json();
        if (body?.error) {
          errMsg = body.error;
        }
        if (body?.upgradeRequired || res.status === 403) {
          upgradeRequired = true;
        }
      } catch {}
      return {
        error: errMsg,
        success: false,
        upgradeRequired,
      };
    }

    const data = await res.json();
    if (!data || !data.success || !data.url) {
      return {
        error: data?.error || 'No se recibió la imagen procesada.',
        success: false,
      };
    }

    return {
      mimeType: data.mimeType || 'image/png',
      success: true,
      url: data.url,
    };
  } catch {
    return {
      error: 'Ha ocurrido un error al comunicarse con el servicio de IA.',
      success: false,
    };
  }
}
