import { pool } from '../src/config/database.config.js';
import { logger } from '../src/services/logger.service.js';

async function resetDesigners(): Promise<void> {
  try {
    logger.app.info('Iniciando limpieza y reseteo de diseñadores en la base de datos...');

    const [delRoles] = await pool.query(
      `DELETE ur FROM user_roles ur 
       JOIN roles r ON ur.role_id = r.id 
       WHERE r.name = 'DESIGNER'`
    );
    logger.app.info('Roles de diseñador eliminados de user_roles', { affected: (delRoles as any)?.affectedRows || 0 });

    const [updRole] = await pool.query(
      `UPDATE users SET role = 'USER' WHERE role = 'DESIGNER'`
    );
    logger.app.info('Usuarios con role=DESIGNER actualizados a USER', { affected: (updRole as any)?.affectedRows || 0 });

    const [updHandles] = await pool.query(
      `UPDATE users 
       SET designer_handle = NULL, 
           designer_onboarded = FALSE, 
           designer_onboarded_at = NULL`
    );
    logger.app.info('Campos de diseñador reseteados en tabla users', { affected: (updHandles as any)?.affectedRows || 0 });

    await pool.query('DELETE FROM designer_applications');
    logger.app.info('Solicitudes de diseñador eliminadas');

    await pool.query('DELETE FROM designer_payout_transfers');
    await pool.query('DELETE FROM designer_payout_profiles');
    logger.app.info('Perfiles y transferencias de payouts de diseñador eliminados');

    await pool.query('DELETE FROM creator_pool_shares');
    await pool.query('DELETE FROM creator_pool_cycles');
    logger.app.info('Participaciones y ciclos de Creator Pool eliminados');

    logger.app.info('Reseteo de diseñadores completado con éxito. Todas las cuentas de usuario se mantienen intactas.');
    process.exit(0);
  } catch (error) {
    logger.app.error('Error al resetear registros de diseñadores', error);
    process.exit(1);
  }
}

void resetDesigners();
