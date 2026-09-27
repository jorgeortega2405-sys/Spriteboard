import { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getObjectStream, headObject } from '../services/s3.service.js';

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

router.head('/uploads/*', async (req: Request, res: Response): Promise<void> => {
  setMediaCorsHeaders(res);

  const rawSubpath = req.params[0] || '';
  const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
  const safePath = path.resolve(uploadsDir, rawSubpath);

  if (!safePath.startsWith(uploadsDir + path.sep)) {
    res.status(403).end();
    return;
  }

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

  const relativeSubpath = path.relative(uploadsDir, safePath).replace(/\\/g, '/');
  const s3Key = `uploads/${relativeSubpath}`;

  try {
    const s3Meta = await headObject(s3Key);
    if (s3Meta) {
      if (s3Meta.contentType) {
        res.setHeader('Content-Type', s3Meta.contentType);
      }
      if (s3Meta.etag) {
        res.setHeader('ETag', s3Meta.etag);
      }
      if (s3Meta.contentLength !== undefined) {
        res.setHeader('Content-Length', s3Meta.contentLength);
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.status(200).end();
      return;
    }
  } catch {}

  res.status(404).end();
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

  const relativeSubpath = path.relative(uploadsDir, safePath).replace(/\\/g, '/');
  const s3Key = `uploads/${relativeSubpath}`;

  try {
    const s3Stream = await getObjectStream(s3Key, req.headers.range);
    if (s3Stream) {
      if (s3Stream.etag && req.headers['if-none-match'] === s3Stream.etag) {
        res.status(304).end();
        return;
      }

      if (s3Stream.contentType) {
        res.setHeader('Content-Type', s3Stream.contentType);
        if (s3Stream.contentType.includes('image/svg+xml')) {
          res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        }
      }
      if (s3Stream.etag) {
        res.setHeader('ETag', s3Stream.etag);
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Accept-Ranges', 'bytes');

      if (s3Stream.contentRange) {
        res.status(206);
        res.setHeader('Content-Range', s3Stream.contentRange);
      } else {
        res.status(200);
      }

      if (s3Stream.contentLength !== undefined) {
        res.setHeader('Content-Length', s3Stream.contentLength);
      }

      s3Stream.stream.pipe(res);
      return;
    }
  } catch {}

  res.status(404).json({ error: 'Archivo no encontrado.' });
});

export default router;
