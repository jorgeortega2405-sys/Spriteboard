import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config/env.js';
export const COOKIE_NAME = 'sprite_session';
export const MAX_CONCURRENT_ACCOUNTS = 5;
export async function hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
}
export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}
// Firmar payload multicuentas de sesión
export function createMultiAccountToken(session) {
    const payloadStr = JSON.stringify(session);
    const payloadBase64 = Buffer.from(payloadStr, 'utf-8').toString('base64url');
    const signature = crypto.createHmac('sha256', config.sessionSecret).update(payloadBase64).digest('base64url');
    return `${payloadBase64}.${signature}`;
}
// Firmar payload de sesión clásica (compatibilidad hacia atrás)
export function createSessionToken(user) {
    return createMultiAccountToken({
        activeId: user.id,
        accounts: [
            {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar_url: user.avatar_url ?? null,
                google_id: user.google_id ?? null,
                last_accessed: Date.now(),
            },
        ],
    });
}
// Verificar y extraer sesión multicuentas
export function verifyMultiAccountToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 2)
            return null;
        const [payloadBase64, signature] = parts;
        const expectedSignature = crypto.createHmac('sha256', config.sessionSecret).update(payloadBase64).digest('base64url');
        if (signature.length !== expectedSignature.length ||
            !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return null;
        }
        const payloadStr = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
        const parsed = JSON.parse(payloadStr);
        if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.accounts) && typeof parsed.activeId === 'number') {
                return parsed;
            }
            else if (typeof parsed.id === 'number') {
                // Sesión clásica de usuario individual migrada en caliente
                return {
                    activeId: parsed.id,
                    accounts: [
                        {
                            id: parsed.id,
                            username: parsed.username,
                            email: parsed.email,
                            avatar_url: parsed.avatar_url ?? null,
                            google_id: parsed.google_id ?? null,
                            last_accessed: Date.now(),
                        },
                    ],
                };
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
// Verificar y extraer usuario activo de la sesión
export function verifySessionToken(token) {
    const session = verifyMultiAccountToken(token);
    if (!session)
        return null;
    const activeAccount = session.accounts.find((a) => a.id === session.activeId);
    return activeAccount || session.accounts[0] || null;
}
// Obtener la sesión multicuentas desde la request HTTP
export function getMultiAccountSession(req) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token)
        return null;
    return verifyMultiAccountToken(token);
}
// Configurar cookie con el payload multicuentas
export function setMultiAccountCookie(res, session) {
    const token = createMultiAccountToken(session);
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.nodeEnv === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    });
}
// Configurar cookie de sesión simple (compatibilidad)
export function setSessionCookie(res, user) {
    const token = createSessionToken(user);
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.nodeEnv === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    });
}
// Agregar o actualizar una cuenta en el pool de la sesión
export function addAccountToSession(res, req, user) {
    const existingSession = getMultiAccountSession(req);
    let accounts = existingSession ? [...existingSession.accounts] : [];
    const existingIndex = accounts.findIndex((a) => a.id === user.id);
    const now = Date.now();
    const sessionAcc = {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url ?? null,
        google_id: user.google_id ?? null,
        last_accessed: now,
    };
    if (existingIndex >= 0) {
        accounts[existingIndex] = sessionAcc;
    }
    else {
        // Si se alcanza el límite máximo de 5 cuentas, descartar la menos recientemente accedida
        if (accounts.length >= MAX_CONCURRENT_ACCOUNTS) {
            accounts.sort((a, b) => (a.last_accessed || 0) - (b.last_accessed || 0));
            accounts.shift();
        }
        accounts.push(sessionAcc);
    }
    const newSession = {
        activeId: user.id,
        accounts,
    };
    setMultiAccountCookie(res, newSession);
    return newSession;
}
// Cambiar la cuenta activa dentro del pool de la sesión
export function switchAccountInSession(res, req, targetUserId) {
    const session = getMultiAccountSession(req);
    if (!session) {
        return { success: false, activeUser: null, accounts: [] };
    }
    const target = session.accounts.find((a) => a.id === targetUserId);
    if (!target) {
        return { success: false, activeUser: null, accounts: session.accounts };
    }
    target.last_accessed = Date.now();
    session.activeId = targetUserId;
    setMultiAccountCookie(res, session);
    return { success: true, activeUser: target, accounts: session.accounts };
}
// Remover una cuenta del pool de la sesión (o la activa si no se especifica)
export function removeAccountFromSession(res, req, userId) {
    const session = getMultiAccountSession(req);
    if (!session) {
        clearSessionCookie(res);
        return { remainingCount: 0, activeUser: null, accounts: [] };
    }
    const idToRemove = userId ?? session.activeId;
    session.accounts = session.accounts.filter((a) => a.id !== idToRemove);
    if (session.accounts.length === 0) {
        clearSessionCookie(res);
        return { remainingCount: 0, activeUser: null, accounts: [] };
    }
    // Si se removió la cuenta activa, activar la más recientemente accedida de las restantes
    if (session.activeId === idToRemove) {
        session.accounts.sort((a, b) => (b.last_accessed || 0) - (a.last_accessed || 0));
        session.activeId = session.accounts[0].id;
    }
    setMultiAccountCookie(res, session);
    const activeUser = session.accounts.find((a) => a.id === session.activeId) || session.accounts[0];
    return { remainingCount: session.accounts.length, activeUser, accounts: session.accounts };
}
// Actualizar los datos de la cuenta activa en la sesión sin perder las demás cuentas
export function updateActiveAccountInSession(res, req, updatedData) {
    const session = getMultiAccountSession(req);
    if (!session)
        return;
    const idx = session.accounts.findIndex((a) => a.id === session.activeId);
    if (idx >= 0) {
        session.accounts[idx] = {
            ...session.accounts[idx],
            ...updatedData,
            last_accessed: Date.now(),
        };
        setMultiAccountCookie(res, session);
    }
}
// Limpiar todas las cuentas de la sesión
export function clearSessionCookie(res) {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.nodeEnv === 'production',
    });
}
