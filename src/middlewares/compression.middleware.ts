import { NextFunction, Request, Response } from 'express';
import zlib from 'zlib';

const COMPRESSIBLE_TYPES = /json|text|javascript|css|xml|svg|html/i;

export function compressionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const supportsGzip = typeof acceptEncoding === 'string' && acceptEncoding.includes('gzip');
  const supportsDeflate = typeof acceptEncoding === 'string' && acceptEncoding.includes('deflate');

  if (!supportsGzip && !supportsDeflate) {
    return next();
  }

  const originalSend = res.send.bind(res);

  res.json = function (body: any): Response {
    const jsonStr = JSON.stringify(body);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return (res as any).send(Buffer.from(jsonStr, 'utf-8'));
  };

  res.send = function (chunk: any): Response {
    if (!chunk || res.headersSent) {
      return originalSend(chunk);
    }

    const contentType = res.getHeader('Content-Type');
    const contentTypeStr = typeof contentType === 'string' ? contentType : '';

    if (!COMPRESSIBLE_TYPES.test(contentTypeStr)) {
      return originalSend(chunk);
    }

    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(typeof chunk === 'string' ? chunk : String(chunk), 'utf-8');

    if (buffer.length < 1024) {
      res.setHeader('Content-Length', buffer.length);
      return originalSend(buffer);
    }

    try {
      if (supportsGzip) {
        const compressed = zlib.gzipSync(buffer, { level: 6 });
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Content-Length', compressed.length);
        return originalSend(compressed);
      } else if (supportsDeflate) {
        const compressed = zlib.deflateSync(buffer, { level: 6 });
        res.setHeader('Content-Encoding', 'deflate');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Content-Length', compressed.length);
        return originalSend(compressed);
      }
    } catch {
      return originalSend(buffer);
    }

    return originalSend(buffer);
  };

  next();
}
