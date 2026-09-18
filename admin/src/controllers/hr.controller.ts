import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { AuditService } from '../services/audit.service.js';
import { addEmployeeDocument, getCompanyTimeOffCalendar, getDocumentByUuid, getEmployeeById, getEmployeeCompensationHistory, getEmployeeDocuments, getEmployeeTimeOffSummary, getOrganizationChart, hireEmployee, listEmployees, listTimeOffRequests, recordCompensationChange, requestTimeOff, reviewTimeOffRequest, updateEmployeeStatus } from '../services/hr.service.js';
import { logger } from '../services/logger.service.js';
import { UserRole } from '../types/auth.types.js';
import { validateEmail } from '../utils/validators.util.js';

export async function handleListEmployees(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = req.query.search as string | undefined;
    const department = req.query.department as string | undefined;
    const status = req.query.status as string | undefined;
    const role = req.query.role as string | undefined;

    const user = (req as any).user;
    const userPermissions: string[] = user?.permissions || [];
    const canViewSalary = userPermissions.includes('*') || userPermissions.includes('hr:salary_view') || user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_ADMIN';

    const result = await listEmployees({
      canViewSalary,
      department,
      limit,
      page,
      role,
      search,
      status,
    });

    res.json(result);
  } catch (error) {
    logger.app.error('Error al obtener lista de colaboradores', { error: String(error) });
    res.status(500).json({ error: 'Ha ocurrido un error al cargar los colaboradores.' });
  }
}

export async function handleGetEmployeeDetails(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Identificador de colaborador no proporcionado.' });
      return;
    }

    const user = (req as any).user;
    const userPermissions: string[] = user?.permissions || [];
    const canViewSalary = userPermissions.includes('*') || userPermissions.includes('hr:salary_view') || user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_ADMIN';

    const employee = await getEmployeeById(id, canViewSalary);
    if (!employee) {
      res.status(404).json({ error: 'Colaborador no encontrado.' });
      return;
    }

    const documents = await getEmployeeDocuments(employee.id);
    const careerHistory = await getEmployeeCompensationHistory(employee.id, canViewSalary);
    const timeOffSummary = await getEmployeeTimeOffSummary(employee.id);

    let manager = null;
    if (employee.manager_id) {
      manager = await getEmployeeById(employee.manager_id, false);
    }

    res.json({
      balance: timeOffSummary.balance,
      career_history: careerHistory,
      documents,
      employee,
      manager,
    });
  } catch (error) {
    logger.app.error('Error al obtener detalles de colaborador', { error: String(error) });
    res.status(500).json({ error: 'Ha ocurrido un error al obtener el expediente del colaborador.' });
  }
}

export async function handleHireEmployee(req: Request, res: Response): Promise<void> {
  try {
    const adminId = (req as any).user?.id || 1;
    const {
      contract_type,
      currency,
      department,
      document_id,
      emergency_contact_name,
      emergency_contact_phone,
      first_name,
      hire_date,
      job_title,
      last_name,
      manager_id,
      personal_email,
      phone,
      role,
      salary,
      username,
      work_email,
      work_mode,
    } = req.body;

    if (!first_name || !first_name.trim()) {
      res.status(400).json({ error: 'El nombre es obligatorio.' });
      return;
    }

    if (!last_name || !last_name.trim()) {
      res.status(400).json({ error: 'El apellido es obligatorio.' });
      return;
    }

    if (!document_id || !document_id.trim()) {
      res.status(400).json({ error: 'El documento de identidad es obligatorio.' });
      return;
    }

    if (!personal_email || !validateEmail(personal_email.trim()).valid) {
      res.status(400).json({ error: 'El correo personal no es válido.' });
      return;
    }

    if (!work_email || !validateEmail(work_email.trim()).valid) {
      res.status(400).json({ error: 'El correo corporativo no es válido.' });
      return;
    }

    if (!job_title || !job_title.trim()) {
      res.status(400).json({ error: 'El cargo o puesto es obligatorio.' });
      return;
    }

    if (!department || !department.trim()) {
      res.status(400).json({ error: 'El departamento es obligatorio.' });
      return;
    }

    const contractFile = req.file
      ? {
          buffer: fs.readFileSync(req.file.path),
          mimeType: req.file.mimetype,
          originalName: req.file.originalname,
          size: req.file.size,
        }
      : undefined;

    const result = await hireEmployee(
      {
        contract_type,
        currency,
        department,
        document_id,
        emergency_contact_name,
        emergency_contact_phone,
        first_name,
        hire_date,
        job_title,
        last_name,
        manager_id: manager_id ? parseInt(manager_id, 10) : undefined,
        personal_email,
        phone,
        role: (role as UserRole) || 'USER',
        salary: salary ? parseFloat(salary) : undefined,
        username,
        work_email,
        work_mode,
      },
      contractFile,
      adminId
    );

    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }

    void AuditService.recordAdminAudit({
      action: 'HIRE_EMPLOYEE',
      actorId: adminId,
      actorRole: (req as any).user?.role || 'ADMIN',
      actorUsername: (req as any).user?.username || 'admin',
      description: `Contratación de colaborador ${first_name} ${last_name} (${job_title} · ${department})`,
      ipAddress: req.ip || '',
      module: 'hr',
      newValues: { contract_type, department, job_title, personal_email, role, work_email },
      riskLevel: 'critical',
      targetId: result.employee.id,
      targetType: 'employee',
      userAgent: req.headers['user-agent'] || '',
    });

    res.status(201).json({
      employee: result.employee,
      message: 'Colaborador contratado exitosamente.',
      success: true,
      temporaryPassword: result.temporaryPassword,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }
    logger.app.error('Error al procesar contratación en controlador', { error: String(error) });
    res.status(400).json({ error: (error as Error).message || 'Ha ocurrido un error al procesar la contratación.' });
  }
}

export async function handleGetOrgChart(_req: Request, res: Response): Promise<void> {
  try {
    const orgChart = await getOrganizationChart();
    res.json({ orgChart });
  } catch (error) {
    logger.app.error('Error al obtener organigrama', { error: String(error) });
    res.status(500).json({ error: 'Ha ocurrido un error al cargar el organigrama.' });
  }
}

export async function handlePromoteEmployee(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?.id || 1;
    const { change_type, currency, effective_date, new_department, new_job_title, new_platform_role, new_salary, reason } = req.body;

    if (!id) {
      res.status(400).json({ error: 'Identificador de colaborador no proporcionado.' });
      return;
    }

    const employee = await getEmployeeById(id, true);
    if (!employee) {
      res.status(404).json({ error: 'Colaborador no encontrado.' });
      return;
    }

    const record = await recordCompensationChange(
      employee.id,
      {
        changeType: change_type || 'promotion',
        currency,
        effectiveDate: effective_date,
        newDepartment: new_department,
        newJobTitle: new_job_title,
        newPlatformRole: new_platform_role,
        newSalary: new_salary !== undefined && new_salary !== null ? parseFloat(new_salary) : undefined,
        reason,
      },
      adminId
    );

    void AuditService.recordAdminAudit({
      action: 'PROMOTE_OR_SALARY_CHANGE',
      actorId: adminId,
      actorRole: (req as any).user?.role || 'ADMIN',
      actorUsername: (req as any).user?.username || 'admin',
      description: `Ajuste laboral/salarial (${change_type || 'promotion'}) para colaborador #${employee.id} (${employee.first_name} ${employee.last_name}): ${reason || 'Sin justificación'}`,
      ipAddress: req.ip || '',
      module: 'hr',
      newValues: { change_type, effective_date, new_department, new_job_title, new_platform_role, new_salary, reason },
      riskLevel: 'critical',
      targetId: employee.id,
      targetType: 'employee',
      userAgent: req.headers['user-agent'] || '',
    });

    res.status(200).json({
      historyRecord: record,
      message: 'Cambio de puesto o salario registrado exitosamente.',
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al registrar promoción/ajuste salarial', { error: String(error) });
    res.status(400).json({ error: (error as Error).message || 'Ha ocurrido un error al registrar el ajuste.' });
  }
}

export async function handleGetCareerHistory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({ error: 'Identificador no proporcionado.' });
      return;
    }

    const user = (req as any).user;
    const userPermissions: string[] = user?.permissions || [];
    const canViewSalary = userPermissions.includes('*') || userPermissions.includes('hr:salary_view') || user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_ADMIN';

    const employee = await getEmployeeById(id, canViewSalary);
    if (!employee) {
      res.status(404).json({ error: 'Colaborador no encontrado.' });
      return;
    }

    const history = await getEmployeeCompensationHistory(employee.id, canViewSalary);
    res.json({ history });
  } catch (error) {
    logger.app.error('Error al obtener historial de carrera', { error: String(error) });
    res.status(500).json({ error: 'Ha ocurrido un error al obtener el historial.' });
  }
}

export async function handleListTimeOffRequests(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const status = req.query.status as string | undefined;
    const department = req.query.department as string | undefined;

    const result = await listTimeOffRequests({ department, limit, page, status });
    res.json(result);
  } catch (error) {
    logger.app.error('Error al listar solicitudes de vacaciones', { error: String(error) });
    res.status(500).json({ error: 'Ha ocurrido un error al listar las solicitudes.' });
  }
}

export async function handleSubmitTimeOffRequest(req: Request, res: Response): Promise<void> {
  try {
    const { employee_id, end_date, reason, request_type, start_date, total_days } = req.body;

    if (!employee_id || !start_date || !end_date) {
      res.status(400).json({ error: 'Colaborador, fecha de inicio y fecha de fin son obligatorios.' });
      return;
    }

    const employee = await getEmployeeById(employee_id, false);
    if (!employee) {
      res.status(404).json({ error: 'Colaborador no encontrado.' });
      return;
    }

    const request = await requestTimeOff({
      employeeId: employee.id,
      endDate: end_date,
      reason,
      requestType: request_type || 'vacation',
      startDate: start_date,
      totalDays: total_days ? parseInt(total_days, 10) : undefined,
    });

    res.status(201).json({
      message: 'Solicitud de vacaciones/ausencia registrada exitosamente.',
      request,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al enviar solicitud de vacaciones', { error: String(error) });
    res.status(400).json({ error: (error as Error).message || 'Ha ocurrido un error al enviar la solicitud.' });
  }
}

export async function handleReviewTimeOffRequest(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { rejection_reason, status } = req.body;
    const adminId = (req as any).user?.id || 1;

    if (!id || !status || (status !== 'approved' && status !== 'rejected')) {
      res.status(400).json({ error: 'Identificador y estado (approved/rejected) válidos son requeridos.' });
      return;
    }

    const updated = await reviewTimeOffRequest(id, status, adminId, rejection_reason);

    void AuditService.recordAdminAudit({
      action: 'REVIEW_TIME_OFF',
      actorId: adminId,
      actorRole: (req as any).user?.role || 'ADMIN',
      actorUsername: (req as any).user?.username || 'admin',
      description: `Revisión de solicitud de PTO #${id} marcada como "${status}": ${rejection_reason || 'Sin notas'}`,
      ipAddress: req.ip || '',
      module: 'hr',
      newValues: { rejection_reason, status },
      riskLevel: 'high',
      targetId: id,
      targetType: 'time_off_request',
      userAgent: req.headers['user-agent'] || '',
    });

    res.json({
      message: `Solicitud ${status === 'approved' ? 'aprobada' : 'rechazada'} exitosamente.`,
      request: updated,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al revisar solicitud de vacaciones', { error: String(error) });
    res.status(400).json({ error: (error as Error).message || 'Ha ocurrido un error al procesar la solicitud.' });
  }
}

export async function handleGetTimeOffCalendar(req: Request, res: Response): Promise<void> {
  try {
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

    const calendar = await getCompanyTimeOffCalendar(month, year);
    res.json({ calendar });
  } catch (error) {
    logger.app.error('Error al obtener calendario de ausencias', { error: String(error) });
    res.status(500).json({ error: 'Ha ocurrido un error al cargar el calendario.' });
  }
}

export async function handleDownloadDocument(req: Request, res: Response): Promise<void> {
  try {
    const { docUuid } = req.params;
    if (!docUuid) {
      res.status(400).json({ error: 'Identificador de documento no proporcionado.' });
      return;
    }

    const doc = await getDocumentByUuid(docUuid);
    if (!doc) {
      res.status(404).json({ error: 'Documento no encontrado.' });
      return;
    }

    const resolvedPath = path.resolve(doc.file_path);
    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: 'El archivo físico del documento no se encuentra disponible.' });
      return;
    }

    const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
    const safeFilename = encodeURIComponent(doc.file_name).replace(/['()]/g, escape);

    res.setHeader('Content-Type', doc.mime_type || 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${doc.file_name}"; filename*=UTF-8''${safeFilename}`);
    res.setHeader('Content-Length', doc.file_size_bytes);

    const fileStream = fs.createReadStream(resolvedPath);
    fileStream.pipe(res);
  } catch (error) {
    logger.app.error('Error al descargar documento de colaborador', { error: String(error) });
    res.status(500).json({ error: 'Ha ocurrido un error al obtener el documento.' });
  }
}

export async function handleUpdateEmployeeStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = (req as any).user?.id || 1;

    if (!id || !status) {
      res.status(400).json({ error: 'Identificador y nuevo estado son obligatorios.' });
      return;
    }

    const validStatuses = ['active', 'onboarding', 'suspended', 'terminated'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Estado laboral no válido.' });
      return;
    }

    await updateEmployeeStatus(id, status as any, adminId);

    void AuditService.recordAdminAudit({
      action: 'UPDATE_EMPLOYEE_STATUS',
      actorId: adminId,
      actorRole: (req as any).user?.role || 'ADMIN',
      actorUsername: (req as any).user?.username || 'admin',
      description: `Actualización de estado laboral de colaborador #${id} a "${status}"`,
      ipAddress: req.ip || '',
      module: 'hr',
      newValues: { status },
      riskLevel: 'high',
      targetId: id,
      targetType: 'employee',
      userAgent: req.headers['user-agent'] || '',
    });

    res.json({ message: 'Estado laboral actualizado con éxito.', success: true });
  } catch (error) {
    logger.app.error('Error al actualizar estado del colaborador', { error: String(error) });
    res.status(400).json({ error: (error as Error).message || 'Ha ocurrido un error al actualizar el estado.' });
  }
}

export async function handleUploadDocument(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { document_type } = req.body;
    const adminId = (req as any).user?.id || 1;

    if (!id) {
      res.status(400).json({ error: 'Identificador de colaborador no proporcionado.' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Debe adjuntar un archivo de documento.' });
      return;
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const doc = await addEmployeeDocument(
      id,
      {
        buffer: fileBuffer,
        documentType: document_type || 'contract',
        mimeType: req.file.mimetype,
        originalName: req.file.originalname,
        size: req.file.size,
      },
      adminId
    );

    if (fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }

    void AuditService.recordAdminAudit({
      action: 'UPLOAD_EMPLOYEE_DOCUMENT',
      actorId: adminId,
      actorRole: (req as any).user?.role || 'ADMIN',
      actorUsername: (req as any).user?.username || 'admin',
      description: `Subida de documento "${doc.file_name}" (${document_type || 'contract'}) para colaborador #${id}`,
      ipAddress: req.ip || '',
      module: 'hr',
      newValues: { document_type: document_type || 'contract', file_name: doc.file_name, file_size_bytes: doc.file_size_bytes },
      riskLevel: 'medium',
      targetId: id,
      targetType: 'employee',
      userAgent: req.headers['user-agent'] || '',
    });

    res.status(201).json({
      document: doc,
      message: 'Documento adjuntado exitosamente.',
      success: true,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    }
    logger.app.error('Error al adjuntar documento a expediente', { error: String(error) });
    res.status(400).json({ error: (error as Error).message || 'Ha ocurrido un error al adjuntar el documento.' });
  }
}
