import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { createCanvasComment, deleteCanvasComment, listCanvasComments, updateCanvasComment } from '../services/canvas-comment.service.js';
import { sendBadRequest, sendCreated, sendInternalError, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function listCommentsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    const user = getCurrentUser(req);
    const frameIndex = req.query.frameIndex !== undefined ? Number(req.query.frameIndex) : undefined;

    const comments = await listCanvasComments(uuid, user ? user.id : undefined, frameIndex);
    sendSuccess(res, { comments, success: true });
  } catch (err: any) {
    sendInternalError(res, 'Error al listar comentarios del lienzo', err);
  }
}

export async function createCommentHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'Debes iniciar sesión para comentar.');
      return;
    }

    const { uuid } = req.params;
    const { content, frameIndex, parentId, posX, posY } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      sendBadRequest(res, 'El contenido del comentario es obligatorio.');
      return;
    }

    const comment = await createCanvasComment(uuid, user.id, {
      content: content.trim(),
      frameIndex: frameIndex !== undefined ? Number(frameIndex) : 0,
      parentId: typeof parentId === 'string' ? parentId : undefined,
      posX: posX !== undefined && posX !== null ? Number(posX) : undefined,
      posY: posY !== undefined && posY !== null ? Number(posY) : undefined,
    });

    sendCreated(res, { comment, success: true });
  } catch (err: any) {
    sendInternalError(res, 'Error al crear comentario', err);
  }
}

export async function updateCommentHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const { commentUuid, uuid } = req.params;
    const { content, status } = req.body;

    const comment = await updateCanvasComment(uuid, commentUuid, user.id, {
      content: typeof content === 'string' ? content.trim() : undefined,
      status: status === 'resolved' || status === 'open' ? status : undefined,
    });

    sendSuccess(res, { comment, success: true });
  } catch (err: any) {
    sendInternalError(res, 'Error al actualizar comentario', err);
  }
}

export async function deleteCommentHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const { commentUuid, uuid } = req.params;
    await deleteCanvasComment(uuid, commentUuid, user.id);

    sendSuccess(res, { success: true });
  } catch (err: any) {
    sendInternalError(res, 'Error al eliminar comentario', err);
  }
}
