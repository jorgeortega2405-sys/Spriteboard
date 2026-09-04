import { Request, Response } from 'express';
import { generateAvatarSvg } from '../services/avatar.service.js';

export function handleAvatarRequest(req: Request, res: Response): void {
  const name = String(req.query.name || req.query.username || 'User').trim();
  const size = Number(req.query.size) || 80;

  const svg = generateAvatarSvg(name, size);

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.send(svg);
}
