import { config } from '../config/env.js';
import { generateCsrfToken } from '../middlewares/csrf.middleware.js';
export function getAppConfig(req, res) {
    res.json({
        appName: config.appName,
    });
}
export function getCsrfToken(req, res) {
    const token = generateCsrfToken(req, res);
    res.json({ csrfToken: token });
}
export function getHealth(req, res) {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
}
