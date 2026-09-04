import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export async function sendVerificationCodeEmail(
  toEmail: string,
  username: string,
  code: string
): Promise<void> {
  const fromAddress = `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`;

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Código de Verificación</title>
  </head>
  <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f9fafb; margin: 0; padding: 32px 16px; color: #111827;">
    <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);">
      <div style="padding: 28px 24px; border-bottom: 1px solid #f3f4f6; text-align: center;">
        <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: #111827;">Spriteboard</h2>
      </div>
      <div style="padding: 32px 24px; text-align: center;">
        <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #111827;">Verifica tu cuenta</h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; color: #4b5563; line-height: 1.5;">
          Hola <strong>${username}</strong>, usa el siguiente código de 6 dígitos para completar tu registro:
        </p>
        <div style="display: inline-block; background-color: #111827; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 14px 28px; border-radius: 12px; margin: 0 auto 24px auto;">
          ${code}
        </div>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
          Este código es válido durante <strong>15 minutos</strong>.
        </p>
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">
          Si tú no creaste esta cuenta, puedes ignorar este mensaje de forma segura.
        </p>
      </div>
      <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6;">
        © ${new Date().getFullYear()} Spriteboard. Todos los derechos reservados.
      </div>
    </div>
  </body>
  </html>
  `;

  await transporter.sendMail({
    from: fromAddress,
    to: toEmail,
    subject: `${code} es tu código de verificación de Spriteboard`,
    text: `Hola ${username}, tu código de verificación de Spriteboard es: ${code}. Válido por 15 minutos.`,
    html: htmlContent,
  });
}
