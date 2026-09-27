import { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getObject } from '../services/s3.service.js';

const router = Router();

function setMediaCorsHeaders(res: Response): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, If-Range, If-None-Match, Cache-Control, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, ETag');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}

router.options('/uploads/*', (_req: Request, res: Response): void => {
  setMediaCorsHeaders(res);
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

router.get('/uploads/*', async (req: Request, res: Response): Promise<void> => {
  setMediaCorsHeaders(res);

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
        if (s3Obj.contentType.includes('image/svg+xml')) {
          res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        }
      }
      if (s3Obj.etag) {
        res.setHeader('ETag', s3Obj.etag);
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Accept-Ranges', 'bytes');

      const rangeHeader = req.headers.range;
      const totalLength = s3Obj.buffer.length;

      if (rangeHeader && rangeHeader.startsWith('bytes=')) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;

        if (start >= totalLength || end >= totalLength || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${totalLength}`).end();
          return;
        }

        const chunksize = (end - start) + 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalLength}`);
        res.setHeader('Content-Length', chunksize);
        res.end(s3Obj.buffer.subarray(start, end + 1));
        return;
      }

      res.setHeader('Content-Length', totalLength);
      res.end(s3Obj.buffer);
      return;
    }
  } catch {}

  if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    if (safePath.endsWith('.svg')) {
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(safePath, { acceptRanges: true });
    return;
  }

  res.status(404).json({ error: 'Archivo no encontrado.' });
});

export default router;
