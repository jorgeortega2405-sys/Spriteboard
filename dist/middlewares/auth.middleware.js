import { verifySessionToken, getMultiAccountSession, COOKIE_NAME } from '../services/auth.service.js';
export function getCurrentUser(req) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token)
        return null;
    return verifySessionToken(token);
}
export function getLinkedAccounts(req) {
    const session = getMultiAccountSession(req);
    return session ? session.accounts : [];
}
export function requireAuth(req, res, next) {
    const user = getCurrentUser(req);
    if (!user) {
        res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
        return;
    }
    next();
}
