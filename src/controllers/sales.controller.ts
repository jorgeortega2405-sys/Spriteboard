import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { createSalesInquiry } from '../services/sales.service.js';
import { sendBadRequest, sendCreated, sendInternalError } from '../utils/http.util.js';
import { validateEmail } from '../utils/validators.util.js';
import { Request, Response } from 'express';

export async function submitSalesInquiryHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const {
      company_email,
      company_name,
      company_size,
      contact_reason,
      country_or_region,
      department,
      first_name,
      how_can_we_help,
      last_name,
      phone_number,
      role_level,
    } = req.body;

    if (!first_name || typeof first_name !== 'string' || first_name.trim().length < 2) {
      sendBadRequest(res, 'Debes ingresar tu nombre (mínimo 2 caracteres).');
      return;
    }

    if (!last_name || typeof last_name !== 'string' || last_name.trim().length < 2) {
      sendBadRequest(res, 'Debes ingresar tu apellido (mínimo 2 caracteres).');
      return;
    }

    const emailCheck = validateEmail(company_email, { enforceAllowedDomains: false });
    if (!emailCheck.valid) {
      sendBadRequest(res, 'Debes ingresar un correo electrónico corporativo válido.');
      return;
    }

    if (!contact_reason || typeof contact_reason !== 'string' || contact_reason.trim().length === 0) {
      sendBadRequest(res, 'Debes seleccionar el motivo de contacto.');
      return;
    }

    if (!company_name || typeof company_name !== 'string' || company_name.trim().length < 2) {
      sendBadRequest(res, 'Debes ingresar el nombre de la empresa u organización.');
      return;
    }

    if (!company_size || typeof company_size !== 'string' || company_size.trim().length === 0) {
      sendBadRequest(res, 'Debes seleccionar el tamaño de la empresa.');
      return;
    }

    if (!country_or_region || typeof country_or_region !== 'string' || country_or_region.trim().length === 0) {
      sendBadRequest(res, 'Debes seleccionar tu país o región.');
      return;
    }

    if (!role_level || typeof role_level !== 'string' || role_level.trim().length === 0) {
      sendBadRequest(res, 'Debes seleccionar tu nivel de rol o cargo.');
      return;
    }

    if (!department || typeof department !== 'string' || department.trim().length === 0) {
      sendBadRequest(res, 'Debes seleccionar o ingresar tu departamento.');
      return;
    }

    if (!phone_number || typeof phone_number !== 'string' || phone_number.trim().length < 5) {
      sendBadRequest(res, 'Debes ingresar un número de teléfono de contacto válido.');
      return;
    }

    if (!how_can_we_help || typeof how_can_we_help !== 'string' || how_can_we_help.trim().length < 5) {
      sendBadRequest(res, 'Por favor cuéntanos cómo podemos ayudarte (mínimo 5 caracteres).');
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || '';

    const inquiry = await createSalesInquiry({
      company_email: company_email.trim(),
      company_name: company_name.trim(),
      company_size: company_size.trim(),
      contact_reason: contact_reason.trim(),
      country_or_region: country_or_region.trim(),
      department: department.trim(),
      first_name: first_name.trim(),
      how_can_we_help: how_can_we_help.trim(),
      ip_address: ip,
      last_name: last_name.trim(),
      phone_number: phone_number.trim(),
      role_level: role_level.trim(),
      user_id: user?.id || null,
    });

    sendCreated(res, {
      inquiry: {
        company_name: inquiry.company_name,
        created_at: inquiry.created_at,
        first_name: inquiry.first_name,
        last_name: inquiry.last_name,
        uuid: inquiry.uuid,
      },
      message: 'Tu solicitud ha sido recibida exitosamente. Nuestro equipo de ventas se comunicará contigo a la brevedad.',
    });
  } catch (err) {
    sendInternalError(res, 'Error al procesar la solicitud de contacto comercial.', err);
  }
}
