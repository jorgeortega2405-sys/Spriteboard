import { Request, Response } from 'express';
import { getBillingOverview, getBillingTransactions, processRefundTransaction } from '../services/billing.service.js';
import { logger } from '../services/logger.service.js';

export async function handleGetBillingOverview(req: Request, res: Response): Promise<void> {
  try {
    const data = await getBillingOverview();
    res.json(data);
  } catch (error) {
    logger.app.error('Error al responder métricas de facturación', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar las métricas de facturación.' });
  }
}

export async function handleGetBillingTransactions(req: Request, res: Response): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));

    const result = await getBillingTransactions(search, status, page, limit);
    res.json(result);
  } catch (error) {
    logger.app.error('Error al responder lista de transacciones', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar el listado de transacciones.' });
  }
}

export async function handleProcessRefund(req: Request, res: Response): Promise<void> {
  try {
    const purchaseId = parseInt(req.params.id, 10);
    const { reason } = req.body;

    if (isNaN(purchaseId) || purchaseId <= 0) {
      res.status(400).json({ error: 'Identificador de transacción inválido.' });
      return;
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      res.status(400).json({ error: 'Debes proporcionar un motivo válido para el reembolso.' });
      return;
    }

    const adminUser = (req as any).user;
    const adminIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    await processRefundTransaction(purchaseId, reason.trim(), adminUser?.id || 1, adminIp);
    res.json({ message: 'Reembolso procesado exitosamente.' });
  } catch (error: any) {
    logger.app.error('Error al ejecutar reembolso', error);
    const knownErrors = ['Transacción no encontrada', 'La transacción ya se encuentra reembolsada'];
    const message = error instanceof Error && knownErrors.includes(error.message)
      ? error.message
      : 'Ha ocurrido un error al procesar el reembolso.';
    res.status(400).json({ error: message });
  }
}
