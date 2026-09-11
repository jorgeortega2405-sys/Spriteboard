import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { canvasPool, pool } from '../config/database.config.js';
import { CanvasComment, CanvasCommentAuthor, CanvasCommentReply, CreateCommentDto, UpdateCommentDto } from '../types/canvas-comment.types.js';
import { getCanvasUserRole } from './canvas.service.js';
import { logger } from './logger.service.js';
import { createNotification } from './notification.service.js';

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export async function listCanvasComments(
  canvasUuid: string,
  userId?: number,
  frameIndex?: number
): Promise<CanvasComment[]> {
  const roleInfo = await getCanvasUserRole(canvasUuid, userId, false);
  if (!roleInfo) {
    throw new Error('Lienzo no encontrado o sin acceso.');
  }

  const canvasId = roleInfo.canvas.id;

  let query = `
    SELECT cc.id, cc.uuid, cc.canvas_id, cc.user_id, cc.parent_id, cc.pos_x, cc.pos_y,
           cc.frame_index, cc.content, cc.status, cc.created_at, cc.updated_at,
           u.username, u.avatar_url
    FROM db_canvas.canvas_comments cc
    LEFT JOIN db_identity.users u ON u.id = cc.user_id
    WHERE cc.canvas_id = ?
  `;
  const params: any[] = [canvasId];

  if (frameIndex !== undefined && frameIndex !== null) {
    query += ' AND cc.frame_index = ?';
    params.push(frameIndex);
  }

  query += ' ORDER BY cc.created_at ASC';

  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(query, params);

  const commentsMap = new Map<number, CanvasComment>();
  const repliesList: Array<{ parentId: number; reply: CanvasCommentReply }> = [];

  for (const r of rows) {
    const author: CanvasCommentAuthor = {
      avatar_url: r.avatar_url || null,
      id: r.user_id,
      initials: getInitials(r.username || 'Usuario'),
      username: r.username || 'Usuario',
    };

    if (r.parent_id) {
      repliesList.push({
        parentId: r.parent_id,
        reply: {
          author,
          canvas_id: r.canvas_id,
          content: r.content,
          created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          id: r.id,
          parent_id: r.parent_id,
          status: r.status,
          updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
          user_id: r.user_id,
          uuid: r.uuid,
        },
      });
    } else {
      commentsMap.set(r.id, {
        author,
        canvas_id: r.canvas_id,
        content: r.content,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        frame_index: r.frame_index ?? 0,
        id: r.id,
        parent_id: null,
        pos_x: r.pos_x !== null && r.pos_x !== undefined ? Number(r.pos_x) : null,
        pos_y: r.pos_y !== null && r.pos_y !== undefined ? Number(r.pos_y) : null,
        replies: [],
        reply_count: 0,
        status: r.status,
        updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
        user_id: r.user_id,
        uuid: r.uuid,
      });
    }
  }

  for (const item of repliesList) {
    const parent = commentsMap.get(item.parentId);
    if (parent) {
      parent.replies.push(item.reply);
      parent.reply_count = parent.replies.length;
    }
  }

  return Array.from(commentsMap.values());
}

export async function createCanvasComment(
  canvasUuid: string,
  userId: number,
  dto: CreateCommentDto
): Promise<CanvasComment | CanvasCommentReply> {
  const roleInfo = await getCanvasUserRole(canvasUuid, userId, false);
  if (!roleInfo) {
    throw new Error('Lienzo no encontrado o sin acceso.');
  }

  const canvas = roleInfo.canvas;
  const canvasId = canvas.id;
  const content = (dto.content || '').trim();
  if (!content) {
    throw new Error('El comentario no puede estar vacío.');
  }

  let parentNumericId: number | null = null;
  if (dto.parentId) {
    const [pRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM db_canvas.canvas_comments WHERE uuid = ? AND canvas_id = ? LIMIT 1',
      [dto.parentId, canvasId]
    );
    if (pRows.length > 0) {
      parentNumericId = pRows[0].id;
    }
  }

  const uuid = crypto.randomUUID();
  const posX = dto.posX !== undefined && dto.posX !== null ? Number(dto.posX) : null;
  const posY = dto.posY !== undefined && dto.posY !== null ? Number(dto.posY) : null;
  const frameIndex = Number(dto.frameIndex || 0);

  const [res] = await canvasPool.execute<mysql.ResultSetHeader>(
    `INSERT INTO db_canvas.canvas_comments
     (uuid, canvas_id, user_id, parent_id, pos_x, pos_y, frame_index, content, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
    [uuid, canvasId, userId, parentNumericId, posX, posY, frameIndex, content]
  );

  const insertId = res.insertId;

  const [uRows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, username, avatar_url FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const authorUser = uRows[0];
  const author: CanvasCommentAuthor = {
    avatar_url: authorUser?.avatar_url || null,
    id: userId,
    initials: getInitials(authorUser?.username || 'Usuario'),
    username: authorUser?.username || 'Usuario',
  };

  const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
  const mentionedUsernames = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(content)) !== null) {
    mentionedUsernames.add(match[1]);
  }

  for (const uname of mentionedUsernames) {
    try {
      const [mRows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM users WHERE username = ? LIMIT 1',
        [uname]
      );
      if (mRows.length > 0 && mRows[0].id !== userId) {
        await createNotification({
          linkUrl: `/design/${canvas.uuid}`,
          message: `${author.username} te mencionó en "${canvas.name}": "${content.slice(0, 100)}"`,
          title: 'Te han mencionado en un comentario',
          type: 'mention',
          userId: mRows[0].id,
        });
      }
    } catch (notifErr) {
      logger.app.warn(`Error al enviar notificación de mención a ${uname}`, notifErr);
    }
  }

  if (canvas.user_id !== userId && !mentionedUsernames.has(canvas.owner_name || '')) {
    try {
      await createNotification({
        linkUrl: `/design/${canvas.uuid}`,
        message: `${author.username} comentó en "${canvas.name}"`,
        title: 'Nuevo comentario en tu lienzo',
        type: 'comment',
        userId: canvas.user_id,
      });
    } catch (notifErr) {
      logger.app.warn('Error al notificar al dueño del lienzo', notifErr);
    }
  }

  const nowIso = new Date().toISOString();

  if (parentNumericId) {
    return {
      author,
      canvas_id: canvasId,
      content,
      created_at: nowIso,
      id: insertId,
      parent_id: parentNumericId,
      status: 'open',
      updated_at: nowIso,
      user_id: userId,
      uuid,
    };
  }

  return {
    author,
    canvas_id: canvasId,
    content,
    created_at: nowIso,
    frame_index: frameIndex,
    id: insertId,
    parent_id: null,
    pos_x: posX,
    pos_y: posY,
    replies: [],
    reply_count: 0,
    status: 'open',
    updated_at: nowIso,
    user_id: userId,
    uuid,
  };
}

export async function updateCanvasComment(
  canvasUuid: string,
  commentUuid: string,
  userId: number,
  dto: UpdateCommentDto
): Promise<CanvasComment | CanvasCommentReply> {
  const roleInfo = await getCanvasUserRole(canvasUuid, userId, false);
  if (!roleInfo) {
    throw new Error('Lienzo no encontrado o sin acceso.');
  }

  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT * FROM db_canvas.canvas_comments WHERE uuid = ? AND canvas_id = ? LIMIT 1',
    [commentUuid, roleInfo.canvas.id]
  );
  if (rows.length === 0) {
    throw new Error('Comentario no encontrado.');
  }

  const comment = rows[0];
  const isAuthor = comment.user_id === userId;
  const isOwner = roleInfo.canvas.user_id === userId;
  const isEditor = roleInfo.role === 'editor' || roleInfo.role === 'owner';

  if (!isAuthor && !isOwner && !isEditor) {
    throw new Error('No tienes permiso para modificar este comentario.');
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (dto.content !== undefined && isAuthor) {
    const trimmed = dto.content.trim();
    if (!trimmed) throw new Error('El comentario no puede estar vacío.');
    updates.push('content = ?');
    params.push(trimmed);
  }

  if (dto.status !== undefined) {
    updates.push('status = ?');
    params.push(dto.status);
  }

  if (updates.length > 0) {
    params.push(comment.id);
    await canvasPool.execute(
      `UPDATE db_canvas.canvas_comments SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  const [uRows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id, username, avatar_url FROM users WHERE id = ? LIMIT 1',
    [comment.user_id]
  );
  const authorUser = uRows[0];
  const author: CanvasCommentAuthor = {
    avatar_url: authorUser?.avatar_url || null,
    id: comment.user_id,
    initials: getInitials(authorUser?.username || 'Usuario'),
    username: authorUser?.username || 'Usuario',
  };

  const updatedContent = dto.content !== undefined && isAuthor ? dto.content.trim() : comment.content;
  const updatedStatus = dto.status !== undefined ? dto.status : comment.status;

  if (comment.parent_id) {
    return {
      author,
      canvas_id: comment.canvas_id,
      content: updatedContent,
      created_at: new Date(comment.created_at).toISOString(),
      id: comment.id,
      parent_id: comment.parent_id,
      status: updatedStatus,
      updated_at: new Date().toISOString(),
      user_id: comment.user_id,
      uuid: comment.uuid,
    };
  }

  return {
    author,
    canvas_id: comment.canvas_id,
    content: updatedContent,
    created_at: new Date(comment.created_at).toISOString(),
    frame_index: comment.frame_index ?? 0,
    id: comment.id,
    parent_id: null,
    pos_x: comment.pos_x !== null ? Number(comment.pos_x) : null,
    pos_y: comment.pos_y !== null ? Number(comment.pos_y) : null,
    replies: [],
    reply_count: 0,
    status: updatedStatus,
    updated_at: new Date().toISOString(),
    user_id: comment.user_id,
    uuid: comment.uuid,
  };
}

export async function deleteCanvasComment(
  canvasUuid: string,
  commentUuid: string,
  userId: number
): Promise<boolean> {
  const roleInfo = await getCanvasUserRole(canvasUuid, userId, false);
  if (!roleInfo) {
    throw new Error('Lienzo no encontrado o sin acceso.');
  }

  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, user_id FROM db_canvas.canvas_comments WHERE uuid = ? AND canvas_id = ? LIMIT 1',
    [commentUuid, roleInfo.canvas.id]
  );
  if (rows.length === 0) {
    throw new Error('Comentario no encontrado.');
  }

  const comment = rows[0];
  const isAuthor = comment.user_id === userId;
  const isOwner = roleInfo.canvas.user_id === userId;

  if (!isAuthor && !isOwner) {
    throw new Error('No tienes permiso para eliminar este comentario.');
  }

  await canvasPool.execute('DELETE FROM db_canvas.canvas_comments WHERE id = ?', [comment.id]);
  return true;
}
