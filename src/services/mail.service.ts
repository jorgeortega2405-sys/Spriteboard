import nodemailer from 'nodemailer';
import { createRequire } from 'module';
import { config } from '../config/env.js';

const require = createRequire(import.meta.url);
const emailTemplates = require('../config/email-templates.json');

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

export function escapeHtml(str: unknown): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderTemplateString(
  template: string,
  variables: Record<string, string | number>,
  isHtml = false
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    if (key in variables) {
      const val = variables[key];
      return isHtml ? escapeHtml(val) : String(val);
    }
    return match;
  });
}

export async function sendTemplateEmail(
  templateKey: string,
  toEmail: string,
  variables: Record<string, string | number> = {}
): Promise<void> {
  const template: EmailTemplate | undefined = emailTemplates[templateKey];
  if (!template) {
    throw new Error(`Plantilla de email no encontrada: ${templateKey}`);
  }

  const mergedVariables: Record<string, string | number> = {
    appName: config.appName,
    year: new Date().getFullYear(),
    ...variables,
  };

  const subject = renderTemplateString(template.subject, mergedVariables, false);
  const html = renderTemplateString(template.html, mergedVariables, true);
  const text = renderTemplateString(template.text, mergedVariables, false);

  const fromAddress = `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`;

  await transporter.sendMail({
    from: fromAddress,
    to: toEmail,
    subject,
    text,
    html,
  });
}

export async function sendVerificationCodeEmail(
  toEmail: string,
  username: string,
  code: string,
  expiresInMinutes = 15
): Promise<void> {
  await sendTemplateEmail('verification_code', toEmail, {
    username,
    code,
    expiresIn: expiresInMinutes,
  });
}

export async function sendWelcomeEmail(
  toEmail: string,
  username: string
): Promise<void> {
  await sendTemplateEmail('welcome', toEmail, {
    username,
  });
}

export async function sendPasswordResetEmail(
  toEmail: string,
  username: string,
  resetUrl: string,
  expiresInMinutes = 15
): Promise<void> {
  await sendTemplateEmail('password_reset', toEmail, {
    username,
    resetUrl,
    expiresIn: expiresInMinutes,
  });
}

export async function sendEmailChangeCodeEmail(
  toEmail: string,
  username: string,
  code: string,
  expiresInMinutes = 15
): Promise<void> {
  await sendTemplateEmail('email_change_code', toEmail, {
    username,
    code,
    expiresIn: expiresInMinutes,
  });
}

