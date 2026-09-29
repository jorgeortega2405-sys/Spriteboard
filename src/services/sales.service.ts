import { pool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import { SalesInquiryInput, SalesInquiryRecord } from '../types/sales.types.js';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

export async function createSalesInquiry(input: SalesInquiryInput): Promise<SalesInquiryRecord> {
  const uuid = crypto.randomUUID();

  const [result] = await pool.query<mysql.ResultSetHeader>(
    `INSERT INTO sales_inquiries (
      uuid, user_id, first_name, last_name, company_email,
      contact_reason, company_name, company_size, country_or_region,
      role_level, department, phone_number, how_can_we_help, ip_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid,
      input.user_id || null,
      input.first_name.trim(),
      input.last_name.trim(),
      input.company_email.trim().toLowerCase(),
      input.contact_reason.trim(),
      input.company_name.trim(),
      input.company_size.trim(),
      input.country_or_region.trim(),
      input.role_level.trim(),
      input.department.trim(),
      input.phone_number.trim(),
      input.how_can_we_help.trim(),
      input.ip_address || null,
    ]
  );

  logger.app.info('Sales inquiry created', {
    company: input.company_name,
    email: input.company_email,
    inquiryId: result.insertId,
    reason: input.contact_reason,
    userId: input.user_id,
    uuid,
  });

  return {
    company_email: input.company_email,
    company_name: input.company_name,
    company_size: input.company_size,
    contact_reason: input.contact_reason,
    country_or_region: input.country_or_region,
    created_at: new Date().toISOString(),
    department: input.department,
    first_name: input.first_name,
    how_can_we_help: input.how_can_we_help,
    id: result.insertId,
    ip_address: input.ip_address,
    last_name: input.last_name,
    phone_number: input.phone_number,
    role_level: input.role_level,
    status: 'new',
    updated_at: new Date().toISOString(),
    user_id: input.user_id,
    uuid,
  };
}
