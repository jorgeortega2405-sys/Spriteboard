import nodemailer from 'nodemailer';
import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';

const transporter = nodemailer.createTransport({
  auth: {
    pass: config.smtp.pass,
    user: config.smtp.user,
  },
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  socketTimeout: 10000,
});

function escapeHtml(str: unknown): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendHireWelcomeEmail(options: {
  department: string;
  fullName: string;
  jobTitle: string;
  loginUrl?: string;
  personalEmail: string;
  temporaryPassword?: string;
  username: string;
  workEmail: string;
}): Promise<boolean> {
  const {
    department,
    fullName,
    jobTitle,
    loginUrl = `${config.adminUrl}/login`,
    personalEmail,
    temporaryPassword,
    username,
    workEmail,
  } = options;

  const subject = `¡Bienvenido al equipo de Spriteboard, ${fullName}!`;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(subject)}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background: #0f172a; padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
        .header p { margin: 6px 0 0 0; font-size: 14px; color: #94a3b8; }
        .body { padding: 28px 24px; }
        .cred-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0; }
        .cred-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
        .cred-row:last-child { margin-bottom: 0; }
        .cred-label { color: #64748b; }
        .cred-val { font-weight: 600; color: #0f172a; font-family: monospace; }
        .btn { display: inline-block; width: 100%; text-align: center; background: #0f172a; color: #ffffff !important; padding: 12px 0; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 16px; }
        .notice { font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>¡Bienvenido a bordo!</h1>
          <p>${escapeHtml(jobTitle)} · ${escapeHtml(department)}</p>
        </div>
        <div class="body">
          <p>Hola <strong>${escapeHtml(fullName)}</strong>,</p>
          <p>Estamos muy entusiasmados de darte la bienvenida al equipo de <strong>Spriteboard</strong>. Tu expediente y cuenta de acceso administrativo han sido configurados correctamente.</p>
          
          <div class="cred-box">
            <div class="cred-row">
              <span class="cred-label">Correo Corporativo:</span>
              <span class="cred-val">${escapeHtml(workEmail)}</span>
            </div>
            <div class="cred-row">
              <span class="cred-label">Usuario:</span>
              <span class="cred-val">${escapeHtml(username)}</span>
            </div>
            ${temporaryPassword ? `
              <div class="cred-row">
                <span class="cred-label">Contraseña Temporal:</span>
                <span class="cred-val">${escapeHtml(temporaryPassword)}</span>
              </div>
            ` : ''}
          </div>

          <p style="font-size: 13px; color: #475569;">
            Por motivos de seguridad, en tu primer ingreso el sistema te solicitará <strong>actualizar tu contraseña</strong> y configurar la <strong>Autenticación de Dos Factores (2FA)</strong>.
          </p>

          <a href="${escapeHtml(loginUrl)}" class="btn" target="_blank" rel="noopener noreferrer">Iniciar Sesión y Activar Cuenta</a>

          <div class="notice">
            Si tienes alguna duda sobre tu proceso de inducción o tu documentación, por favor ponte en contacto con el departamento de Recursos Humanos.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const recipients = [workEmail];
  if (personalEmail && personalEmail !== workEmail) {
    recipients.push(personalEmail);
  }

  try {
    if (!config.smtp.user || !config.smtp.pass) {
      logger.app.info('SMTP no configurado en entorno. Se omite envío de correo de bienvenida', { recipients, workEmail });
      return false;
    }

    await transporter.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      html,
      subject,
      text: `Bienvenido a Spriteboard, ${fullName}. Tu cuenta corporativa es ${workEmail} y tu usuario ${username}. Inicia sesión en ${loginUrl}`,
      to: recipients.join(', '),
    });

    logger.security.info('Correo de bienvenida y onboarding enviado', { recipients, workEmail });
    return true;
  } catch (err) {
    logger.app.error('Error al enviar correo de bienvenida al colaborador', { error: String(err), recipients });
    return false;
  }
}

export async function sendTimeOffStatusEmail(options: {
  employeeEmail: string;
  employeeName: string;
  endDate: string;
  notes?: string;
  startDate: string;
  status: 'approved' | 'rejected';
  totalDays: number;
  typeLabel: string;
}): Promise<boolean> {
  const { employeeEmail, employeeName, endDate, notes, startDate, status, totalDays, typeLabel } = options;

  const isApproved = status === 'approved';
  const subject = isApproved
    ? `Solicitud de ${typeLabel} Aprobada`
    : `Actualización sobre tu solicitud de ${typeLabel}`;

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b; }
        .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 24px; }
        .status { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 12px; margin-bottom: 12px; }
        .approved { background: #dcfce7; color: #15803d; }
        .rejected { background: #fee2e2; color: #b91c1c; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="status ${isApproved ? 'approved' : 'rejected'}">
          ${isApproved ? 'APROBADA' : 'RECHAZADA'}
        </span>
        <h2 style="margin: 0 0 12px 0; font-size: 18px;">Hola ${escapeHtml(employeeName)},</h2>
        <p style="font-size: 14px; line-height: 1.5;">
          Tu solicitud de <strong>${escapeHtml(typeLabel)}</strong> por <strong>${totalDays} día(s)</strong> (del <strong>${escapeHtml(startDate)}</strong> al <strong>${escapeHtml(endDate)}</strong>) ha sido <strong>${isApproved ? 'aprobada' : 'rechazada'}</strong> por el equipo de administración.
        </p>
        ${notes ? `
          <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px; color: #475569; margin: 16px 0;">
            <strong>Comentarios:</strong> ${escapeHtml(notes)}
          </div>
        ` : ''}
        <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">
          Spriteboard RRHH · Notificación automática del sistema.
        </p>
      </div>
    </body>
    </html>
  `;

  try {
    if (!config.smtp.user || !config.smtp.pass) return false;

    await transporter.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      html,
      subject,
      text: `Tu solicitud de ${typeLabel} ha sido ${isApproved ? 'aprobada' : 'rechazada'}.`,
      to: employeeEmail,
    });
    return true;
  } catch (err) {
    logger.app.error('Error al enviar notificación de estado de PTO', { employeeEmail, error: String(err) });
    return false;
  }
}
