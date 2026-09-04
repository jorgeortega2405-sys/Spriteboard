import crypto from 'crypto';
import { config } from '../config/env.js';
import { logger } from '../services/logger.service.js';
export function generateCsrfToken(req, res) {
    let secret = req.cookies?._csrf_secret;
    if (!secret) {
        secret = crypto.randomBytes(32).toString('hex');
        res.cookie('_csrf_secret', secret, {
            httpOnly: true,
            sameSite: 'lax',
            secure: config.nodeEnv === 'production',
            maxAge: 24 * 60 * 60 * 1000,
        });
    }
    // Token generado de forma segura mediante HMAC
    const token = crypto.createHmac('sha256', config.csrfSecret).update(secret).digest('hex');
    // Guardar también en cookie legible por el cliente
    res.cookie('XSRF-TOKEN', token, {
        httpOnly: false,
        sameSite: 'lax',
        secure: config.nodeEnv === 'production',
        maxAge: 24 * 60 * 60 * 1000,
    });
    return token;
}
export function validateCsrf(req, res, next) {
    // Omitir métodos de lectura segura
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }
    const secret = req.cookies?._csrf_secret;
    const providedToken = req.headers['x-csrf-token'] || req.body?._csrf;
    if (!secret || !providedToken) {
        logger.security.warn('Petición bloqueada por token CSRF ausente o no válido', {
            method: req.method,
            path: req.originalUrl || req.url,
        });
        res.status(403).json({ error: 'Token CSRF ausente o no válido' });
        return;
    }
    const expectedToken = crypto.createHmac('sha256', config.csrfSecret).update(secret).digest('hex');
    if (providedToken.length !== expectedToken.length ||
        !crypto.timingSafeEqual(Buffer.from(providedToken), Buffer.from(expectedToken))) {
        logger.security.warn('Petición bloqueada por token CSRF inválido', {
            method: req.method,
            path: req.originalUrl || req.url,
        });
        res.status(403).json({ error: 'Token CSRF inválido' });
        return;
    }
    next();
}
