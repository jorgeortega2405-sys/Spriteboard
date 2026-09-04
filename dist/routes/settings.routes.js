import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { handleUpdateAvatar, handleDeleteAvatar, handleUpdateUsername, handleRequestEmailChangeCode, handleVerifyEmailChangeCode, handleUpdateEmail, handleGetPreferences, handleUpdatePreferences, } from '../controllers/settings.controller.js';
const router = Router();
// Configurar multer en memoria para validar tamaño y mimetype de forma segura
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB máximo
    },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Formato de imagen no compatible. Usa PNG, JPG o WEBP.'));
        }
    },
});
// Wrapper para capturar errores de multer (como archivo > 2MB)
function uploadAvatarMiddleware(req, res, next) {
    upload.single('avatar')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                res.status(400).json({ error: 'La imagen supera el límite permitido de 2 MB.' });
                return;
            }
            res.status(400).json({ error: 'Error al procesar el archivo.' });
            return;
        }
        else if (err) {
            res.status(400).json({ error: err.message || 'Archivo inválido.' });
            return;
        }
        next();
    });
}
// Todas las rutas de configuración requieren autenticación activa
router.use(requireAuth);
// Rutas de Avatar
router.post('/settings/avatar', uploadAvatarMiddleware, handleUpdateAvatar);
router.delete('/settings/avatar', handleDeleteAvatar);
router.post('/settings/avatar/delete', handleDeleteAvatar);
// Rutas de Credenciales
router.post('/settings/username', handleUpdateUsername);
router.post('/settings/email/request-code', handleRequestEmailChangeCode);
router.post('/settings/email/verify-code', handleVerifyEmailChangeCode);
router.post('/settings/email', handleUpdateEmail);
// Rutas de Preferencias
router.get('/settings/preferences', handleGetPreferences);
router.post('/settings/preferences', handleUpdatePreferences);
export default router;
