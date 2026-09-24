import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { addBrandChart, addBrandColor, addBrandTemplate, createBrandKit, deleteBrandAsset, deleteBrandChart, deleteBrandColor, deleteBrandFont, deleteBrandKit, deleteBrandTemplate, duplicateBrandKit, getBrandKitDetail, getUserBrandKits, saveBrandAsset, setBrandFonts, setDefaultBrandKit, updateBrandKit } from '../services/brand.service.js';
import { sendBadRequest, sendCreated, sendForbidden, sendInternalError, sendNotFound, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function getBrandKitsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const kits = await getUserBrandKits(user.id);
    sendSuccess(res, { kits });
  } catch (err) {
    sendInternalError(res, 'Error al obtener kits de marca', err, 'No se pudieron cargar los kits de marca.');
  }
}

export async function getBrandKitDetailHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    if (!uuid) {
      sendBadRequest(res, 'Identificador de kit requerido.');
      return;
    }

    const kit = await getBrandKitDetail(uuid, user.id);
    if (!kit) {
      sendNotFound(res, 'Kit de marca no encontrado.');
      return;
    }

    sendSuccess(res, { kit });
  } catch (err) {
    sendInternalError(res, 'Error al obtener detalle de kit de marca', err, 'No se pudo cargar el kit de marca.');
  }
}

export async function createBrandKitHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { brand_guidelines, brand_voice, color, description, icon, is_default, name, team_id } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      sendBadRequest(res, 'El nombre del kit de marca es obligatorio.');
      return;
    }

    const kit = await createBrandKit(user.id, {
      brand_guidelines,
      brand_voice,
      color,
      description,
      icon,
      is_default,
      name,
      team_id,
    });

    sendCreated(res, { kit });
  } catch (err: any) {
    if (err?.message && err.message.includes('exclusiva')) {
      sendForbidden(res, err.message);
      return;
    }
    if (err?.message && err.message.includes('límite')) {
      sendForbidden(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al crear kit de marca', err, 'No se pudo crear el kit de marca.');
  }
}

export async function updateBrandKitHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    if (!uuid) {
      sendBadRequest(res, 'Identificador de kit requerido.');
      return;
    }

    const { brand_guidelines, brand_voice, color, description, icon, is_default, name } = req.body;

    const kit = await updateBrandKit(uuid, user.id, {
      brand_guidelines,
      brand_voice,
      color,
      description,
      icon,
      is_default,
      name,
    });

    sendSuccess(res, { kit });
  } catch (err: any) {
    if (err?.message === 'Kit de marca no encontrado.') {
      sendNotFound(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al actualizar kit de marca', err, 'No se pudo actualizar el kit de marca.');
  }
}

export async function deleteBrandKitHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    if (!uuid) {
      sendBadRequest(res, 'Identificador de kit requerido.');
      return;
    }

    await deleteBrandKit(uuid, user.id);
    sendSuccess(res, { message: 'Kit de marca eliminado correctamente.' });
  } catch (err: any) {
    if (err?.message === 'Kit de marca no encontrado.') {
      sendNotFound(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al eliminar kit de marca', err, 'No se pudo eliminar el kit de marca.');
  }
}

export async function duplicateBrandKitHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    if (!uuid) {
      sendBadRequest(res, 'Identificador de kit requerido.');
      return;
    }

    const kit = await duplicateBrandKit(uuid, user.id);
    sendCreated(res, { kit });
  } catch (err: any) {
    if (err?.message === 'Kit de marca no encontrado.') {
      sendNotFound(res, err.message);
      return;
    }
    if (err?.message && err.message.includes('límite')) {
      sendForbidden(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al duplicar kit de marca', err, 'No se pudo duplicar el kit de marca.');
  }
}

export async function setDefaultBrandKitHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    if (!uuid) {
      sendBadRequest(res, 'Identificador de kit requerido.');
      return;
    }

    await setDefaultBrandKit(uuid, user.id);
    sendSuccess(res, { message: 'Kit de marca establecido como predeterminado.' });
  } catch (err: any) {
    if (err?.message === 'Kit de marca no encontrado.') {
      sendNotFound(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al definir kit predeterminado', err, 'No se pudo actualizar el kit predeterminado.');
  }
}

export async function addBrandColorHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    const { color_type, gradient_data, hex, name, palette_name, sort_order } = req.body;

    if (!hex || typeof hex !== 'string') {
      sendBadRequest(res, 'El código de color es obligatorio.');
      return;
    }
    if (!name || typeof name !== 'string') {
      sendBadRequest(res, 'El nombre del color es obligatorio.');
      return;
    }

    const color = await addBrandColor(uuid, user.id, {
      color_type,
      gradient_data,
      hex,
      name,
      palette_name,
      sort_order,
    });

    sendCreated(res, { color });
  } catch (err: any) {
    if (err?.message === 'Kit de marca no encontrado.') {
      sendNotFound(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al añadir color al kit', err, 'No se pudo guardar el color.');
  }
}

export async function deleteBrandColorHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { colorUuid, uuid } = req.params;
    await deleteBrandColor(uuid, colorUuid, user.id);
    sendSuccess(res, { message: 'Color eliminado correctamente.' });
  } catch (err: any) {
    if (err?.message === 'Kit de marca no encontrado.') {
      sendNotFound(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al eliminar color', err, 'No se pudo eliminar el color.');
  }
}

export async function setBrandFontsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    const { fonts } = req.body;

    if (!Array.isArray(fonts) || fonts.length === 0) {
      sendBadRequest(res, 'La lista de tipografías es requerida.');
      return;
    }

    const updatedFonts = await setBrandFonts(uuid, user.id, fonts);
    sendSuccess(res, { fonts: updatedFonts });
  } catch (err: any) {
    if (err?.message === 'Kit de marca no encontrado.') {
      sendNotFound(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al actualizar tipografías de marca', err, 'No se pudieron actualizar las tipografías.');
  }
}

export async function deleteBrandFontHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { fontUuid, uuid } = req.params;
    await deleteBrandFont(uuid, fontUuid, user.id);
    sendSuccess(res, { message: 'Tipografía eliminada correctamente.' });
  } catch (err: any) {
    if (err?.message === 'Kit de marca no encontrado.') {
      sendNotFound(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al eliminar tipografía', err, 'No se pudo eliminar la tipografía.');
  }
}

export async function uploadBrandAssetHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    const file = req.file;

    if (!file) {
      sendBadRequest(res, 'No se ha subido ningún archivo.');
      return;
    }

    const assetType = (req.body.asset_type || 'logo') as any;
    const category = req.body.category || 'general';
    const name = req.body.name || file.originalname || 'recurso';
    const tags = req.body.tags ? (typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags) : undefined;

    const asset = await saveBrandAsset(uuid, user.id, assetType, category, name, file, tags);
    sendCreated(res, { asset });
  } catch (err: any) {
    if (err?.message === 'Kit de marca no encontrado.') {
      sendNotFound(res, err.message);
      return;
    }
    if (err?.message && err.message.includes('almacenamiento')) {
      sendForbidden(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al subir recurso de marca', err, err?.message || 'No se pudo subir el archivo.');
  }
}

export async function deleteBrandAssetHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { assetUuid, uuid } = req.params;
    await deleteBrandAsset(uuid, assetUuid, user.id);
    sendSuccess(res, { message: 'Recurso eliminado correctamente.' });
  } catch (err: any) {
    if (err?.message === 'Kit de marca no encontrado.' || err?.message === 'Recurso no encontrado.') {
      sendNotFound(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al eliminar recurso de marca', err, 'No se pudo eliminar el recurso.');
  }
}

export async function addBrandChartHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    const { chart_type, config, name, palette, sample_data } = req.body;

    if (!name || typeof name !== 'string') {
      sendBadRequest(res, 'El nombre de la gráfica es obligatorio.');
      return;
    }
    if (!Array.isArray(palette) || palette.length === 0) {
      sendBadRequest(res, 'La paleta de colores para la gráfica es requerida.');
      return;
    }

    const chart = await addBrandChart(uuid, user.id, {
      chart_type,
      config,
      name,
      palette,
      sample_data,
    });

    sendCreated(res, { chart });
  } catch (err: any) {
    if (err?.message === 'Kit de marca no encontrado.') {
      sendNotFound(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al añadir gráfica al kit', err, 'No se pudo guardar la gráfica.');
  }
}

export async function deleteBrandChartHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { chartUuid, uuid } = req.params;
    await deleteBrandChart(uuid, chartUuid, user.id);
    sendSuccess(res, { message: 'Gráfica eliminada correctamente.' });
  } catch (err: any) {
    if (err?.message === 'Kit de marca no encontrado.') {
      sendNotFound(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al eliminar gráfica', err, 'No se pudo eliminar la gráfica.');
  }
}

export async function addBrandTemplateHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { uuid } = req.params;
    const { canvas_data, canvas_type, canvas_uuid, description, name, preview_thumbnail } = req.body;

    if (!name || typeof name !== 'string') {
      sendBadRequest(res, 'El nombre de la plantilla es requerido.');
      return;
    }

    const template = await addBrandTemplate(uuid, user.id, {
      canvas_data,
      canvas_type,
      canvas_uuid,
      description,
      name,
      preview_thumbnail,
    });

    sendCreated(res, { template });
  } catch (err: any) {
    if (err?.message === 'Kit de marca no encontrado.') {
      sendNotFound(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al añadir plantilla de marca', err, 'No se pudo asociar la plantilla al kit.');
  }
}

export async function deleteBrandTemplateHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { templateUuid, uuid } = req.params;
    await deleteBrandTemplate(uuid, templateUuid, user.id);
    sendSuccess(res, { message: 'Plantilla de marca eliminada correctamente.' });
  } catch (err: any) {
    if (err?.message === 'Kit de marca no encontrado.') {
      sendNotFound(res, err.message);
      return;
    }
    sendInternalError(res, 'Error al eliminar plantilla de marca', err, 'No se pudo eliminar la plantilla.');
  }
}
