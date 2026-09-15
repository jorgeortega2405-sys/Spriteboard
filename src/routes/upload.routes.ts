import { getObject } from '../services/s3.service.js';
import { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

router.get('/uploads/*', async (req: Request, res: Response): Promise<void> => {
  const rawSubpath = req.params[0] || '';
  const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
  const safePath = path.resolve(uploadsDir, rawSubpath);

  if (!safePath.startsWith(uploadsDir + path.sep)) {
    res.status(403).json({ error: 'Acceso denegado.' });
    return;
  }

  const relativeSubpath = path.relative(uploadsDir, safePath).replace(/\\/g, '/');
  const s3Key = `uploads/${relativeSubpath}`;

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
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Length', s3Obj.buffer.length);
      res.end(s3Obj.buffer);
      return;
    }
  } catch {}

  if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.sendFile(safePath);
    return;
  }

  res.status(404).json({ error: 'Archivo no encontrado.' });
});

export default router;
