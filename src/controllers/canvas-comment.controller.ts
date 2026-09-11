import { Request, Response } from 'express';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { createCanvasComment, deleteCanvasComment, listCanvasComments, updateCanvasComment } from '../services/canvas-comment.service.js';
import { logger } from '../services/logger.service.js';

export async function listCommentsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    const user = getCurrentUser(req);
    const frameIndex = req.query.frameIndex !== undefined ? Number(req.query.frameIndex) : undefined;

    const comments = await listCanvasComments(uuid, user ? user.id : undefined, frameIndex);
    res.json({ comments, success: true });
  } catch (err: any) {
    logger.db.error('Error al listar comentarios del lienzo', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function createCommentHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Debes iniciar sesión para comentar.' });
      return;
    }

    const { uuid } = req.params;
    const { content, frameIndex, parentId, posX, posY } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'El contenido del comentario es obligatorio.' });
      return;
    }

    const comment = await createCanvasComment(uuid, user.id, {
      content: content.trim(),
      frameIndex: frameIndex !== undefined ? Number(frameIndex) : 0,
      parentId: typeof parentId === 'string' ? parentId : undefined,
      posX: posX !== undefined && posX !== null ? Number(posX) : undefined,
      posY: posY !== undefined && posY !== null ? Number(posY) : undefined,
    });

    res.status(201).json({ comment, success: true });
  } catch (err: any) {
    logger.db.error('Error al crear comentario', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function updateCommentHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { commentUuid, uuid } = req.params;
    const { content, status } = req.body;

    const comment = await updateCanvasComment(uuid, commentUuid, user.id, {
      content: typeof content === 'string' ? content.trim() : undefined,
      status: status === 'resolved' || status === 'open' ? status : undefined,
    });

    res.json({ comment, success: true });
  } catch (err: any) {
    logger.db.error('Error al actualizar comentario', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function deleteCommentHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { commentUuid, uuid } = req.params;
    await deleteCanvasComment(uuid, commentUuid, user.id);

    res.json({ success: true });
  } catch (err: any) {
    logger.db.error('Error al eliminar comentario', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}
