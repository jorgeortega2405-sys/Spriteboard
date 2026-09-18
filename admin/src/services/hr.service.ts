import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/database.config.js';
import { UserRole } from '../types/auth.types.js';
import { CompensationHistoryRecord, EmployeeDocumentRecord, EmployeeRecord, HireEmployeeInput, OrgChartNode, TimeOffBalanceRecord, TimeOffRequestRecord, TimeOffRequestType, TimeOffStatus } from '../types/hr.types.js';
import { revokeAllUserSessions } from './auth.service.js';
import { logger } from './logger.service.js';
import { sendHireWelcomeEmail, sendTimeOffStatusEmail } from './mail.service.js';
import { getUserRoles } from './role.service.js';
import { ensureUserUuidColumn, findUserByEmail, updateUserRoles } from './user.service.js';

let isHrTablesEnsured = false;

export async function ensureHrTables(): Promise<void> {
  if (isHrTablesEnsured) return;
  try {
    await ensureUserUuidColumn();

    try {
      const [columns] = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM users LIKE "force_password_change"');
      if (columns.length === 0) {
        await pool.query('ALTER TABLE users ADD COLUMN force_password_change TINYINT(1) NOT NULL DEFAULT 0');
      }
    } catch {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        user_id INT NOT NULL UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        document_id VARCHAR(50) NOT NULL,
        personal_email VARCHAR(255) NOT NULL,
        work_email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(50) NULL,
        job_title VARCHAR(150) NOT NULL,
        department VARCHAR(100) NOT NULL,
        manager_id INT NULL,
        contract_type ENUM('full_time', 'part_time', 'contractor', 'internship', 'temporary') NOT NULL DEFAULT 'full_time',
        work_mode ENUM('remote', 'hybrid', 'onsite') NOT NULL DEFAULT 'remote',
        salary DECIMAL(12, 2) NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        hire_date DATE NOT NULL,
        status ENUM('onboarding', 'active', 'suspended', 'terminated') NOT NULL DEFAULT 'active',
        emergency_contact_name VARCHAR(150) NULL,
        emergency_contact_phone VARCHAR(50) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_emp_department (department),
        INDEX idx_emp_status (status),
        INDEX idx_emp_manager (manager_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    try {
      const [empCols] = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM employees LIKE "manager_id"');
      if (empCols.length === 0) {
        await pool.query('ALTER TABLE employees ADD COLUMN manager_id INT NULL AFTER department');
      }
    } catch {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        employee_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size_bytes BIGINT NOT NULL DEFAULT 0,
        mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
        document_type ENUM('contract', 'nda', 'id_card', 'resume', 'other') NOT NULL DEFAULT 'contract',
        uploaded_by INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_doc_employee (employee_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_compensation_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        employee_id INT NOT NULL,
        change_type ENUM('hire', 'promotion', 'salary_adjustment', 'department_transfer', 'role_change') NOT NULL,
        previous_job_title VARCHAR(150) NULL,
        new_job_title VARCHAR(150) NOT NULL,
        previous_department VARCHAR(100) NULL,
        new_department VARCHAR(100) NOT NULL,
        previous_salary DECIMAL(12, 2) NULL,
        new_salary DECIMAL(12, 2) NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        effective_date DATE NOT NULL,
        reason TEXT NULL,
        approved_by_user_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_comp_emp (employee_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_time_off_balances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        year INT NOT NULL,
        vacation_days_total INT NOT NULL DEFAULT 15,
        vacation_days_used INT NOT NULL DEFAULT 0,
        sick_days_used INT NOT NULL DEFAULT 0,
        personal_days_used INT NOT NULL DEFAULT 0,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_emp_balance_year (employee_id, year),
        INDEX idx_pto_balance_emp (employee_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_time_off_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        employee_id INT NOT NULL,
        request_type ENUM('vacation', 'sick_leave', 'personal', 'maternity_paternity', 'unpaid', 'other') NOT NULL DEFAULT 'vacation',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_days INT NOT NULL DEFAULT 1,
        reason TEXT NULL,
        status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        reviewed_by_user_id INT NULL,
        rejection_reason TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pto_req_emp (employee_id),
        INDEX idx_pto_req_status (status),
        INDEX idx_pto_req_dates (start_date, end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    isHrTablesEnsured = true;
    logger.db.info('Tablas de Recursos Humanos (RRHH Enterprise v2) verificadas');
  } catch (error) {
    logger.db.error('Error al inicializar tablas de RRHH', { error: String(error) });
  }
}

export function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function hireEmployee(
  input: HireEmployeeInput,
  contractFile?: { buffer: Buffer; mimeType: string; originalName: string; size: number },
  actorUserId?: number
): Promise<{ employee: EmployeeRecord; temporaryPassword?: string }> {
  await ensureHrTables();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const normalizedEmail = input.work_email.trim().toLowerCase();
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new Error(`El correo corporativo ${normalizedEmail} ya está registrado en el sistema.`);
    }

    const [existingEmp] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM employees WHERE work_email = ? OR document_id = ? LIMIT 1',
      [normalizedEmail, input.document_id.trim()]
    );
    if (existingEmp.length > 0) {
      throw new Error('Ya existe un colaborador registrado con este correo o documento de identidad.');
    }

    const generatedUsername = input.username?.trim()
      ? input.username.trim()
      : `${input.first_name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}.${input.last_name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.floor(100 + Math.random() * 900)}`;

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const userUuid = crypto.randomUUID();

    const [userInsertResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO users (uuid, email, username, password_hash, role, subscription_tier, two_factor_enabled, force_password_change, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'enterprise', 0, 1, NOW(), NOW())`,
      [userUuid, normalizedEmail, generatedUsername, passwordHash, input.role]
    );

    const userId = userInsertResult.insertId;
    await updateUserRoles(userId, [input.role], actorUserId || 1);

    const employeeUuid = crypto.randomUUID();
    const hireDate = input.hire_date || new Date().toISOString().split('T')[0];

    const [empInsertResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO employees (
        uuid, user_id, first_name, last_name, document_id, personal_email, work_email,
        phone, job_title, department, manager_id, contract_type, work_mode, salary, currency, hire_date, status,
        emergency_contact_name, emergency_contact_phone, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NOW(), NOW())`,
      [
        employeeUuid,
        userId,
        input.first_name.trim(),
        input.last_name.trim(),
        input.document_id.trim(),
        input.personal_email.trim().toLowerCase(),
        normalizedEmail,
        input.phone?.trim() || null,
        input.job_title.trim(),
        input.department.trim(),
        input.manager_id || null,
        input.contract_type || 'full_time',
        input.work_mode || 'remote',
        input.salary !== undefined && input.salary !== null ? Number(input.salary) : null,
        input.currency || 'USD',
        hireDate,
        input.emergency_contact_name?.trim() || null,
        input.emergency_contact_phone?.trim() || null,
      ]
    );

    const employeeId = empInsertResult.insertId;

    const compHistoryUuid = crypto.randomUUID();
    await conn.query(
      `INSERT INTO employee_compensation_history (
        uuid, employee_id, change_type, new_job_title, new_department, new_salary, currency, effective_date, reason, approved_by_user_id, created_at
      ) VALUES (?, ?, 'hire', ?, ?, ?, ?, ?, 'Contratación inicial del colaborador', ?, NOW())`,
      [
        compHistoryUuid,
        employeeId,
        input.job_title.trim(),
        input.department.trim(),
        input.salary !== undefined && input.salary !== null ? Number(input.salary) : null,
        input.currency || 'USD',
        hireDate,
        actorUserId || null,
      ]
    );

    const currentYear = new Date().getFullYear();
    await conn.query(
      `INSERT INTO employee_time_off_balances (employee_id, year, vacation_days_total, vacation_days_used, sick_days_used, personal_days_used, updated_at)
       VALUES (?, ?, 15, 0, 0, 0, NOW())
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [employeeId, currentYear]
    );

    if (contractFile) {
      const contractsDir = path.resolve(process.cwd(), 'admin/data/contracts');
      if (!fs.existsSync(contractsDir)) {
        fs.mkdirSync(contractsDir, { recursive: true });
      }

      const docUuid = crypto.randomUUID();
      const ext = path.extname(contractFile.originalName) || '.pdf';
      const storedFileName = `contract_${employeeUuid}_${Date.now()}${ext}`;
      const fullPath = path.join(contractsDir, storedFileName);

      fs.writeFileSync(fullPath, contractFile.buffer);

      await conn.query(
        `INSERT INTO employee_documents (uuid, employee_id, file_name, file_path, file_size_bytes, mime_type, document_type, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'contract', ?, NOW())`,
        [docUuid, employeeId, contractFile.originalName, fullPath, contractFile.size, contractFile.mimeType, actorUserId || userId]
      );
    }

    await conn.commit();

    const [empRows] = await pool.query<EmployeeRecord[]>(
      `SELECT e.*, u.username, u.avatar_url, m.first_name AS manager_first_name, m.last_name AS manager_last_name, m.job_title AS manager_job_title
       FROM employees e
       JOIN users u ON e.user_id = u.id
       LEFT JOIN employees m ON e.manager_id = m.id
       WHERE e.id = ? LIMIT 1`,
      [employeeId]
    );

    const createdEmployee = empRows[0];
    if (createdEmployee) {
      createdEmployee.role = input.role;
      createdEmployee.roles = [input.role];
      if (createdEmployee.manager_first_name) {
        createdEmployee.manager_name = `${createdEmployee.manager_first_name} ${createdEmployee.manager_last_name || ''}`.trim();
      }
    }

    logger.security.info('Colaborador contratado y cuenta creada en RRHH', {
      actorUserId,
      department: input.department,
      employeeId,
      jobTitle: input.job_title,
      role: input.role,
      workEmail: normalizedEmail,
    });

    void sendHireWelcomeEmail({
      department: input.department,
      fullName: `${input.first_name} ${input.last_name}`.trim(),
      jobTitle: input.job_title,
      personalEmail: input.personal_email,
      temporaryPassword,
      username: generatedUsername,
      workEmail: normalizedEmail,
    });

    return {
      employee: createdEmployee,
      temporaryPassword,
    };
  } catch (error) {
    await conn.rollback();
    logger.db.error('Error durante la transacción de contratación en RRHH', { error: String(error) });
    throw error;
  } finally {
    conn.release();
  }
}

export async function listEmployees(options: {
  canViewSalary?: boolean;
  department?: string;
  limit?: number;
  page?: number;
  role?: string;
  search?: string;
  status?: string;
}): Promise<{
  employees: EmployeeRecord[];
  pagination: { limit: number; page: number; total: number; totalPages: number };
}> {
  await ensureHrTables();
  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, Math.min(100, options.limit || 20));
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (options.department && options.department !== 'all') {
    whereClauses.push('e.department = ?');
    params.push(options.department);
  }

  if (options.status && options.status !== 'all') {
    whereClauses.push('e.status = ?');
    params.push(options.status);
  }

  if (options.search && options.search.trim()) {
    const term = `%${options.search.trim()}%`;
    whereClauses.push('(e.first_name LIKE ? OR e.last_name LIKE ? OR e.document_id LIKE ? OR e.work_email LIKE ? OR e.personal_email LIKE ? OR e.job_title LIKE ? OR u.username LIKE ?)');
    params.push(term, term, term, term, term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT e.id) as total
     FROM employees e
     JOIN users u ON e.user_id = u.id
     ${whereSql}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const [rows] = await pool.query<EmployeeRecord[]>(
    `SELECT e.*, u.username, u.avatar_url, u.role,
            m.first_name AS manager_first_name, m.last_name AS manager_last_name, m.job_title AS manager_job_title
     FROM employees e
     JOIN users u ON e.user_id = u.id
     LEFT JOIN employees m ON e.manager_id = m.id
     ${whereSql}
     ORDER BY e.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const employees = await Promise.all(
    rows.map(async (emp) => {
      const roles = await getUserRoles(emp.user_id);
      emp.roles = roles;
      if (roles.length > 0) emp.role = roles[0];
      if (!options.canViewSalary) {
        emp.salary = null;
      }
      if (emp.manager_first_name) {
        emp.manager_name = `${emp.manager_first_name} ${emp.manager_last_name || ''}`.trim();
      }
      return emp;
    })
  );

  return {
    employees,
    pagination: {
      limit,
      page,
      total,
      totalPages,
    },
  };
}

export async function getEmployeeById(idOrUuid: number | string, canViewSalary = false): Promise<EmployeeRecord | null> {
  await ensureHrTables();
  const isUuid = typeof idOrUuid === 'string' && idOrUuid.includes('-');
  const queryField = isUuid ? 'e.uuid' : 'e.id';

  const [rows] = await pool.query<EmployeeRecord[]>(
    `SELECT e.*, u.username, u.avatar_url, u.role,
            m.first_name AS manager_first_name, m.last_name AS manager_last_name, m.job_title AS manager_job_title
     FROM employees e
     JOIN users u ON e.user_id = u.id
     LEFT JOIN employees m ON e.manager_id = m.id
     WHERE ${queryField} = ? LIMIT 1`,
    [idOrUuid]
  );

  if (rows.length === 0) return null;
  const emp = rows[0];
  const roles = await getUserRoles(emp.user_id);
  emp.roles = roles;
  if (roles.length > 0) emp.role = roles[0];

  if (!canViewSalary) {
    emp.salary = null;
  }
  if (emp.manager_first_name) {
    emp.manager_name = `${emp.manager_first_name} ${emp.manager_last_name || ''}`.trim();
  }

  return emp;
}

export async function getOrganizationChart(): Promise<OrgChartNode[]> {
  await ensureHrTables();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.id, e.uuid, e.user_id, e.first_name, e.last_name, e.job_title, e.department, e.manager_id, e.status, e.work_email,
            u.avatar_url, u.role
     FROM employees e
     JOIN users u ON e.user_id = u.id
     WHERE e.status != 'terminated'
     ORDER BY e.department ASC, e.job_title ASC`
  );

  const nodesMap = new Map<number, OrgChartNode>();
  const rootNodes: OrgChartNode[] = [];

  rows.forEach((r) => {
    nodesMap.set(r.id, {
      avatar_url: r.avatar_url || null,
      department: r.department,
      direct_reports_count: 0,
      id: r.id,
      job_title: r.job_title,
      manager_id: r.manager_id || null,
      name: `${r.first_name} ${r.last_name}`.trim(),
      role: r.role || 'USER',
      status: r.status,
      subordinates: [],
      user_id: r.user_id,
      uuid: r.uuid,
      work_email: r.work_email,
    });
  });

  nodesMap.forEach((node) => {
    if (node.manager_id && nodesMap.has(node.manager_id)) {
      const manager = nodesMap.get(node.manager_id)!;
      manager.subordinates = manager.subordinates || [];
      manager.subordinates.push(node);
      manager.direct_reports_count = manager.subordinates.length;
    } else {
      rootNodes.push(node);
    }
  });

  return rootNodes;
}

export async function recordCompensationChange(
  employeeId: number,
  data: {
    changeType: 'department_transfer' | 'promotion' | 'role_change' | 'salary_adjustment';
    currency?: string;
    effectiveDate?: string;
    newDepartment?: string;
    newJobTitle?: string;
    newPlatformRole?: UserRole;
    newSalary?: number;
    reason?: string;
  },
  actorUserId?: number
): Promise<CompensationHistoryRecord> {
  await ensureHrTables();
  const currentEmp = await getEmployeeById(employeeId, true);
  if (!currentEmp) {
    throw new Error('Colaborador no encontrado.');
  }

  const newTitle = (data.newJobTitle || currentEmp.job_title).trim();
  const newDept = (data.newDepartment || currentEmp.department).trim();
  const newSal = data.newSalary !== undefined && data.newSalary !== null ? Number(data.newSalary) : currentEmp.salary;
  const currency = data.currency || currentEmp.currency;
  const effectiveDate = data.effectiveDate || new Date().toISOString().split('T')[0];
  const historyUuid = crypto.randomUUID();

  await pool.query(
    `INSERT INTO employee_compensation_history (
      uuid, employee_id, change_type, previous_job_title, new_job_title,
      previous_department, new_department, previous_salary, new_salary, currency,
      effective_date, reason, approved_by_user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      historyUuid,
      employeeId,
      data.changeType,
      currentEmp.job_title,
      newTitle,
      currentEmp.department,
      newDept,
      currentEmp.salary,
      newSal,
      currency,
      effectiveDate,
      data.reason?.trim() || null,
      actorUserId || null,
    ]
  );

  await pool.query(
    `UPDATE employees SET job_title = ?, department = ?, salary = ?, currency = ?, updated_at = NOW() WHERE id = ?`,
    [newTitle, newDept, newSal, currency, employeeId]
  );

  if (data.newPlatformRole) {
    await updateUserRoles(currentEmp.user_id, [data.newPlatformRole], actorUserId || 1);
  }

  logger.security.info('Ajuste de compensación y cargo registrado en RRHH', {
    actorUserId,
    changeType: data.changeType,
    employeeId,
    newDept,
    newSal,
    newTitle,
  });

  const [records] = await pool.query<CompensationHistoryRecord[]>(
    'SELECT * FROM employee_compensation_history WHERE uuid = ? LIMIT 1',
    [historyUuid]
  );
  return records[0];
}

export async function getEmployeeCompensationHistory(employeeId: number, canViewSalary = false): Promise<CompensationHistoryRecord[]> {
  await ensureHrTables();
  const [rows] = await pool.query<CompensationHistoryRecord[]>(
    `SELECT h.*, u.username AS approved_by_name
     FROM employee_compensation_history h
     LEFT JOIN users u ON h.approved_by_user_id = u.id
     WHERE h.employee_id = ?
     ORDER BY h.effective_date DESC, h.created_at DESC`,
    [employeeId]
  );

  return rows.map((r) => {
    if (!canViewSalary) {
      r.previous_salary = null;
      r.new_salary = null;
    }
    return r;
  });
}

export async function getEmployeeTimeOffSummary(employeeId: number): Promise<{
  balance: { personal_days_used: number; sick_days_used: number; vacation_days_remaining: number; vacation_days_total: number; vacation_days_used: number; year: number };
  requests: TimeOffRequestRecord[];
}> {
  await ensureHrTables();
  const currentYear = new Date().getFullYear();

  let [balances] = await pool.query<TimeOffBalanceRecord[]>(
    'SELECT * FROM employee_time_off_balances WHERE employee_id = ? AND year = ? LIMIT 1',
    [employeeId, currentYear]
  );

  if (balances.length === 0) {
    await pool.query(
      `INSERT INTO employee_time_off_balances (employee_id, year, vacation_days_total, vacation_days_used, sick_days_used, personal_days_used, updated_at)
       VALUES (?, ?, 15, 0, 0, 0, NOW())`,
      [employeeId, currentYear]
    );
    [balances] = await pool.query<TimeOffBalanceRecord[]>(
      'SELECT * FROM employee_time_off_balances WHERE employee_id = ? AND year = ? LIMIT 1',
      [employeeId, currentYear]
    );
  }

  const b = balances[0] || { personal_days_used: 0, sick_days_used: 0, vacation_days_total: 15, vacation_days_used: 0, year: currentYear };
  const vacation_days_remaining = Math.max(0, (b.vacation_days_total || 15) - (b.vacation_days_used || 0));

  const [requests] = await pool.query<TimeOffRequestRecord[]>(
    `SELECT r.*, u.username AS reviewed_by_name
     FROM employee_time_off_requests r
     LEFT JOIN users u ON r.reviewed_by_user_id = u.id
     WHERE r.employee_id = ?
     ORDER BY r.created_at DESC LIMIT 20`,
    [employeeId]
  );

  return {
    balance: {
      personal_days_used: b.personal_days_used || 0,
      sick_days_used: b.sick_days_used || 0,
      vacation_days_remaining,
      vacation_days_total: b.vacation_days_total || 15,
      vacation_days_used: b.vacation_days_used || 0,
      year: currentYear,
    },
    requests,
  };
}

export async function requestTimeOff(data: {
  employeeId: number;
  endDate: string;
  reason?: string;
  requestType: TimeOffRequestType;
  startDate: string;
  totalDays?: number;
}): Promise<TimeOffRequestRecord> {
  await ensureHrTables();
  const reqUuid = crypto.randomUUID();

  let days = data.totalDays;
  if (!days || days <= 0) {
    const start = new Date(data.startDate).getTime();
    const end = new Date(data.endDate).getTime();
    const diff = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
    days = diff;
  }

  await pool.query(
    `INSERT INTO employee_time_off_requests (
      uuid, employee_id, request_type, start_date, end_date, total_days, reason, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
    [reqUuid, data.employeeId, data.requestType, data.startDate, data.endDate, days, data.reason?.trim() || null]
  );

  const [records] = await pool.query<TimeOffRequestRecord[]>(
    'SELECT * FROM employee_time_off_requests WHERE uuid = ? LIMIT 1',
    [reqUuid]
  );
  return records[0];
}

export async function reviewTimeOffRequest(
  requestIdOrUuid: number | string,
  status: 'approved' | 'rejected',
  actorUserId?: number,
  rejectionReason?: string
): Promise<TimeOffRequestRecord> {
  await ensureHrTables();
  const isUuid = typeof requestIdOrUuid === 'string' && requestIdOrUuid.includes('-');
  const queryField = isUuid ? 'r.uuid' : 'r.id';

  const [rows] = await pool.query<TimeOffRequestRecord[]>(
    `SELECT r.*, e.first_name, e.last_name, e.work_email, e.id AS emp_id
     FROM employee_time_off_requests r
     JOIN employees e ON r.employee_id = e.id
     WHERE ${queryField} = ? LIMIT 1`,
    [requestIdOrUuid]
  );

  if (rows.length === 0) {
    throw new Error('Solicitud de ausencia no encontrada.');
  }

  const req = rows[0];
  await pool.query(
    `UPDATE employee_time_off_requests
     SET status = ?, reviewed_by_user_id = ?, rejection_reason = ?, updated_at = NOW()
     WHERE id = ?`,
    [status, actorUserId || null, rejectionReason?.trim() || null, req.id]
  );

  if (status === 'approved') {
    const currentYear = new Date(req.start_date).getFullYear();
    if (req.request_type === 'vacation') {
      await pool.query(
        `UPDATE employee_time_off_balances SET vacation_days_used = vacation_days_used + ?, updated_at = NOW() WHERE employee_id = ? AND year = ?`,
        [req.total_days, req.employee_id, currentYear]
      );
    } else if (req.request_type === 'sick_leave') {
      await pool.query(
        `UPDATE employee_time_off_balances SET sick_days_used = sick_days_used + ?, updated_at = NOW() WHERE employee_id = ? AND year = ?`,
        [req.total_days, req.employee_id, currentYear]
      );
    } else if (req.request_type === 'personal') {
      await pool.query(
        `UPDATE employee_time_off_balances SET personal_days_used = personal_days_used + ?, updated_at = NOW() WHERE employee_id = ? AND year = ?`,
        [req.total_days, req.employee_id, currentYear]
      );
    }
  }

  logger.security.info('Solicitud de vacaciones/ausencia revisada en RRHH', {
    actorUserId,
    requestId: req.id,
    status,
    totalDays: req.total_days,
  });

  const empFullName = `${(req as any).first_name || ''} ${(req as any).last_name || ''}`.trim();
  const workEmail = (req as any).work_email;

  if (workEmail) {
    const typeNames: Record<string, string> = {
      maternity_paternity: 'Maternidad/Paternidad',
      other: 'Permiso Especial',
      personal: 'Día Personal',
      sick_leave: 'Licencia Médica',
      unpaid: 'Permiso No Remunerado',
      vacation: 'Vacaciones',
    };
    void sendTimeOffStatusEmail({
      employeeEmail: workEmail,
      employeeName: empFullName,
      endDate: String(req.end_date).slice(0, 10),
      notes: rejectionReason,
      startDate: String(req.start_date).slice(0, 10),
      status,
      totalDays: req.total_days,
      typeLabel: typeNames[req.request_type] || 'Ausencia',
    });
  }

  const [updated] = await pool.query<TimeOffRequestRecord[]>(
    'SELECT * FROM employee_time_off_requests WHERE id = ? LIMIT 1',
    [req.id]
  );
  return updated[0];
}

export async function listTimeOffRequests(options: {
  department?: string;
  limit?: number;
  page?: number;
  status?: string;
}): Promise<{
  pagination: { limit: number; page: number; total: number; totalPages: number };
  requests: TimeOffRequestRecord[];
}> {
  await ensureHrTables();
  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, Math.min(100, options.limit || 20));
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (options.status && options.status !== 'all') {
    whereClauses.push('r.status = ?');
    params.push(options.status);
  }

  if (options.department && options.department !== 'all') {
    whereClauses.push('e.department = ?');
    params.push(options.department);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(r.id) as total
     FROM employee_time_off_requests r
     JOIN employees e ON r.employee_id = e.id
     ${whereSql}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const [rows] = await pool.query<TimeOffRequestRecord[]>(
    `SELECT r.*, CONCAT(e.first_name, ' ', e.last_name) AS employee_name, e.department AS employee_department, e.uuid AS employee_uuid,
            u.username AS reviewed_by_name
     FROM employee_time_off_requests r
     JOIN employees e ON r.employee_id = e.id
     LEFT JOIN users u ON r.reviewed_by_user_id = u.id
     ${whereSql}
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    pagination: { limit, page, total, totalPages },
    requests: rows,
  };
}

export async function getCompanyTimeOffCalendar(month?: number, year?: number): Promise<Array<{
  department: string;
  employee_id: number;
  employee_name: string;
  end_date: string;
  id: number;
  request_type: TimeOffRequestType;
  start_date: string;
  total_days: number;
}>> {
  await ensureHrTables();
  const curYear = year || new Date().getFullYear();
  const curMonth = month || new Date().getMonth() + 1;

  const startDateStr = `${curYear}-${String(curMonth).padStart(2, '0')}-01`;
  const nextMonth = curMonth === 12 ? 1 : curMonth + 1;
  const nextYear = curMonth === 12 ? curYear + 1 : curYear;
  const endDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, r.employee_id, r.request_type, r.start_date, r.end_date, r.total_days,
            CONCAT(e.first_name, ' ', e.last_name) AS employee_name, e.department
     FROM employee_time_off_requests r
     JOIN employees e ON r.employee_id = e.id
     WHERE r.status = 'approved'
       AND r.start_date < ? AND r.end_date >= ?
     ORDER BY r.start_date ASC`,
    [endDateStr, startDateStr]
  );

  return rows.map((r) => ({
    department: r.department,
    employee_id: r.employee_id,
    employee_name: r.employee_name,
    end_date: String(r.end_date).slice(0, 10),
    id: r.id,
    request_type: r.request_type,
    start_date: String(r.start_date).slice(0, 10),
    total_days: r.total_days,
  }));
}

export async function updateEmployeeStatus(idOrUuid: number | string, status: 'active' | 'onboarding' | 'suspended' | 'terminated', actorUserId?: number): Promise<void> {
  await ensureHrTables();
  const emp = await getEmployeeById(idOrUuid, true);
  if (!emp) throw new Error('Colaborador no encontrado.');

  await pool.query('UPDATE employees SET status = ?, updated_at = NOW() WHERE id = ?', [status, emp.id]);

  if (status === 'suspended' || status === 'terminated') {
    await revokeAllUserSessions(emp.user_id);
    logger.security.info(`Sesiones revocadas para colaborador en estado ${status}`, { actorUserId, employeeId: emp.id, userId: emp.user_id });
  }

  logger.security.info('Estado de colaborador actualizado', { actorUserId, employeeId: emp.id, newStatus: status });
}

export async function addEmployeeDocument(
  employeeIdOrUuid: number | string,
  doc: { buffer: Buffer; documentType: 'contract' | 'id_card' | 'nda' | 'other' | 'resume'; mimeType: string; originalName: string; size: number },
  uploadedBy: number
): Promise<EmployeeDocumentRecord> {
  await ensureHrTables();
  const emp = await getEmployeeById(employeeIdOrUuid, true);
  if (!emp) throw new Error('Colaborador no encontrado.');

  const contractsDir = path.resolve(process.cwd(), 'admin/data/contracts');
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  const docUuid = crypto.randomUUID();
  const ext = path.extname(doc.originalName) || '.pdf';
  const storedFileName = `doc_${emp.uuid}_${Date.now()}${ext}`;
  const fullPath = path.join(contractsDir, storedFileName);

  fs.writeFileSync(fullPath, doc.buffer);

  await pool.query(
    `INSERT INTO employee_documents (uuid, employee_id, file_name, file_path, file_size_bytes, mime_type, document_type, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [docUuid, emp.id, doc.originalName, fullPath, doc.size, doc.mimeType, doc.documentType, uploadedBy]
  );

  const [rows] = await pool.query<EmployeeDocumentRecord[]>(
    'SELECT * FROM employee_documents WHERE uuid = ? LIMIT 1',
    [docUuid]
  );

  return rows[0];
}

export async function getEmployeeDocuments(employeeId: number): Promise<EmployeeDocumentRecord[]> {
  await ensureHrTables();
  const [rows] = await pool.query<EmployeeDocumentRecord[]>(
    `SELECT d.*, u.username as uploaded_by_username
     FROM employee_documents d
     LEFT JOIN users u ON d.uploaded_by = u.id
     WHERE d.employee_id = ?
     ORDER BY d.created_at DESC`,
    [employeeId]
  );
  return rows;
}

export async function getDocumentByUuid(uuid: string): Promise<EmployeeDocumentRecord | null> {
  await ensureHrTables();
  const [rows] = await pool.query<EmployeeDocumentRecord[]>(
    'SELECT * FROM employee_documents WHERE uuid = ? LIMIT 1',
    [uuid]
  );
  return rows.length > 0 ? rows[0] : null;
}
