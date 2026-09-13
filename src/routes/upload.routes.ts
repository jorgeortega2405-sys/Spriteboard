import { getObject } from '../services/s3.service.js';
import { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

router.get('/uploads/*', async (req: Request, res: Response): Promise<void> => {
  const rawSubpath = req.params[0] || '';
  const sanitizedSubpath = rawSubpath.replace(/\.\./g, '').replace(/^\/+/, '');
  const s3Key = `uploads/${sanitizedSubpath}`;

  try {
    const s3Obj = await getObject(s3Key);
    if (s3Obj && s3Obj.buffer) {
      if (s3Obj.etag && req.headers['if-none-match'] === s3Obj.etag) {
        res.status(304).end();
        return;
      }

      if (s3Obj.contentType) {
        res.setHeader('Content-Type', s3Obj.contentType);
      }
      if (s3Obj.etag) {
        res.setHeader('ETag', s3Obj.etag);
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Length', s3Obj.buffer.length);
      res.end(s3Obj.buffer);
      return;
    }
  } catch {}

  const localPath = path.join(process.cwd(), 'public', 'uploads', sanitizedSubpath);
  if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
    res.sendFile(localPath);
    return;
  }

  res.status(404).json({ error: 'Archivo no encontrado.' });
});

export default router;
