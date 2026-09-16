import type { Request, Response } from 'express';
import { createAd, createAdvertiser, deleteAd, deleteAdvertiser, getActiveAdsByPlacement, getAdById, getAdsByAdvertiserId, getAdvertiserById, getAdvertisers, toggleAdStatus, updateAd, updateAdvertiser } from '../services/ad-manager.service.js';
import { logger } from '../services/logger.service.js';

export async function getAdvertisersController(req: Request, res: Response): Promise<void> {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const data = await getAdvertisers({ limit, page, search, status, type });
    res.json({ ok: true, ...data });
  } catch (error) {
    logger.app.error('Error en getAdvertisersController', error);
    res.status(500).json({ error: 'Ha ocurrido un error al consultar los anunciantes.', ok: false });
  }
}

export async function getAdvertiserByIdController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'ID de anunciante inválido.', ok: false });
      return;
    }

    const advertiser = await getAdvertiserById(id);
    if (!advertiser) {
      res.status(404).json({ error: 'Anunciante no encontrado.', ok: false });
      return;
    }

    res.json({ advertiser, ok: true });
  } catch (error) {
    logger.app.error('Error en getAdvertiserByIdController', error);
    res.status(500).json({ error: 'Ha ocurrido un error al obtener los datos del anunciante.', ok: false });
  }
}

export async function createAdvertiserController(req: Request, res: Response): Promise<void> {
  try {
    const { contact_email, name, notes, provider_name, status, type, website } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'El nombre del anunciante es obligatorio.', ok: false });
      return;
    }

    const advertiser = await createAdvertiser({
      contact_email,
      name,
      notes,
      provider_name,
      status,
      type: type === 'provider' ? 'provider' : 'direct',
      website,
    });

    res.status(201).json({ advertiser, ok: true });
  } catch (error) {
    logger.app.error('Error en createAdvertiserController', error);
    res.status(500).json({ error: 'Ha ocurrido un error al registrar el anunciante.', ok: false });
  }
}

export async function updateAdvertiserController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'ID de anunciante inválido.', ok: false });
      return;
    }

    const advertiser = await updateAdvertiser(id, req.body);
    if (!advertiser) {
      res.status(404).json({ error: 'Anunciante no encontrado.', ok: false });
      return;
    }

    res.json({ advertiser, ok: true });
  } catch (error) {
    logger.app.error('Error en updateAdvertiserController', error);
    res.status(500).json({ error: 'Ha ocurrido un error al actualizar el anunciante.', ok: false });
  }
}

export async function deleteAdvertiserController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'ID de anunciante inválido.', ok: false });
      return;
    }

    const deleted = await deleteAdvertiser(id);
    if (!deleted) {
      res.status(404).json({ error: 'Anunciante no encontrado o ya eliminado.', ok: false });
      return;
    }

    res.json({ message: 'Anunciante eliminado correctamente.', ok: true });
  } catch (error) {
    logger.app.error('Error en deleteAdvertiserController', error);
    res.status(500).json({ error: 'Ha ocurrido un error al eliminar el anunciante.', ok: false });
  }
}

export async function getAdsByAdvertiserController(req: Request, res: Response): Promise<void> {
  try {
    const advertiserId = Number(req.params.id);
    if (isNaN(advertiserId) || advertiserId <= 0) {
      res.status(400).json({ error: 'ID de anunciante inválido.', ok: false });
      return;
    }

    const ads = await getAdsByAdvertiserId(advertiserId);
    res.json({ ads, ok: true });
  } catch (error) {
    logger.app.error('Error en getAdsByAdvertiserController', error);
    res.status(500).json({ error: 'Ha ocurrido un error al consultar los anuncios.', ok: false });
  }
}

export async function getAdByIdController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'ID de anuncio inválido.', ok: false });
      return;
    }

    const ad = await getAdById(id);
    if (!ad) {
      res.status(404).json({ error: 'Anuncio no encontrado.', ok: false });
      return;
    }

    res.json({ ad, ok: true });
  } catch (error) {
    logger.app.error('Error en getAdByIdController', error);
    res.status(500).json({ error: 'Ha ocurrido un error al obtener el anuncio.', ok: false });
  }
}

export async function createAdController(req: Request, res: Response): Promise<void> {
  try {
    const advertiserId = Number(req.params.id);
    if (isNaN(advertiserId) || advertiserId <= 0) {
      res.status(400).json({ error: 'ID de anunciante inválido.', ok: false });
      return;
    }

    const { badge_text, description, frequency, image_url, placements, priority, status, target_url, title } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'El título del anuncio es obligatorio.', ok: false });
      return;
    }
    if (!image_url || typeof image_url !== 'string' || !image_url.trim()) {
      res.status(400).json({ error: 'La URL de la imagen del anuncio es obligatoria.', ok: false });
      return;
    }
    if (!target_url || typeof target_url !== 'string' || !target_url.trim()) {
      res.status(400).json({ error: 'La URL de destino del anuncio es obligatoria.', ok: false });
      return;
    }

    const ad = await createAd(advertiserId, {
      badge_text,
      description,
      frequency,
      image_url,
      placements,
      priority,
      status,
      target_url,
      title,
    });

    res.status(201).json({ ad, ok: true });
  } catch (error) {
    logger.app.error('Error en createAdController', error);
    res.status(500).json({ error: 'Ha ocurrido un error al crear el anuncio.', ok: false });
  }
}

export async function updateAdController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'ID de anuncio inválido.', ok: false });
      return;
    }

    const ad = await updateAd(id, req.body);
    if (!ad) {
      res.status(404).json({ error: 'Anuncio no encontrado.', ok: false });
      return;
    }

    res.json({ ad, ok: true });
  } catch (error) {
    logger.app.error('Error en updateAdController', error);
    res.status(500).json({ error: 'Ha ocurrido un error al actualizar el anuncio.', ok: false });
  }
}

export async function deleteAdController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'ID de anuncio inválido.', ok: false });
      return;
    }

    const deleted = await deleteAd(id);
    if (!deleted) {
      res.status(404).json({ error: 'Anuncio no encontrado o ya eliminado.', ok: false });
      return;
    }

    res.json({ message: 'Anuncio eliminado correctamente.', ok: true });
  } catch (error) {
    logger.app.error('Error en deleteAdController', error);
    res.status(500).json({ error: 'Ha ocurrido un error al eliminar el anuncio.', ok: false });
  }
}

export async function toggleAdStatusController(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'ID de anuncio inválido.', ok: false });
      return;
    }

    const ad = await toggleAdStatus(id, req.body.status);
    if (!ad) {
      res.status(404).json({ error: 'Anuncio no encontrado.', ok: false });
      return;
    }

    res.json({ ad, ok: true });
  } catch (error) {
    logger.app.error('Error en toggleAdStatusController', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cambiar el estado del anuncio.', ok: false });
  }
}

export async function getPublicAdsController(req: Request, res: Response): Promise<void> {
  try {
    const placement = typeof req.query.placement === 'string' ? req.query.placement : 'home';
    const ads = await getActiveAdsByPlacement(placement);
    res.json({ ads, ok: true });
  } catch (error) {
    logger.app.error('Error en getPublicAdsController', error);
    res.status(500).json({ error: 'Ha ocurrido un error al consultar los anuncios públicos.', ok: false });
  }
}
