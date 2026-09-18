import { DocTemplatePreset } from './doc.types.js';

export const DOC_TEMPLATES: DocTemplatePreset[] = [
  {
    badge: 'Popular',
    description: 'Documento limpio con márgenes estándar listo para redactar texto libre.',
    icon: 'article',
    id: 'blank',
    initialPages: [
      {
        contentHtml: '<p><br></p>',
        id: 'page_1',
      },
    ],
    name: 'Documento en blanco',
    settings: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 11,
      lineHeight: 1.5,
      margins: { bottom: 96, left: 96, right: 96, top: 96 },
      orientation: 'portrait',
      paperSize: 'letter',
      showPageNumbers: true,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
  {
    badge: 'Empresarial',
    description: 'Estructura formal con portada, resumen ejecutivo, tabla de indicadores y recomendaciones.',
    icon: 'summarize',
    id: 'business_report',
    initialPages: [
      {
        contentHtml: `
          <div style="text-align: center; padding: 40px 0 30px 0; border-bottom: 2px solid #e2e8f0; margin-bottom: 30px;">
            <div style="display: inline-block; padding: 6px 16px; background: #e0e7ff; color: #4338ca; border-radius: 9999px; font-weight: 700; font-size: 11pt; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 16px;">Informe Corporativo</div>
            <h1 style="font-size: 26pt; font-weight: 800; margin: 0 0 12px 0; color: #0f172a; line-height: 1.2;">Reporte Estratégico y Desempeño Trimestral</h1>
            <p style="font-size: 13pt; color: #64748b; margin: 0 0 20px 0;">Análisis detallado de metas, proyectos clave y perspectivas</p>
            <div style="font-size: 10pt; color: #94a3b8;">Fecha: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })} • Preparado por: Dirección General</div>
          </div>

          <div class="doc-callout doc-callout--info" style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #1d4ed8; margin-bottom: 4px;">
              <span class="material-symbols-rounded" style="font-size: 18px;">info</span> Resumen Ejecutivo
            </div>
            <p style="margin: 0; color: #1e3a8a; font-size: 10.5pt; line-height: 1.5;">El presente informe consolida los resultados operativos del último período, destacando un crecimiento del 24% en adopción de producto y una eficiencia óptima en tiempos de entrega.</p>
          </div>

          <h2 style="font-size: 16pt; font-weight: 700; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px;">1. Objetivos Cumplidos</h2>
          <p>Durante este ciclo se alcanzaron los principales hitos establecidos en la planificación estratégica:</p>
          <ul style="margin: 10px 0; padding-left: 24px; line-height: 1.6;">
            <li><strong>Lanzamiento de plataforma:</strong> Despliegue exitoso de módulos colaborativos en tiempo real.</li>
            <li><strong>Optimización de infraestructura:</strong> Reducción de latencia en un 38% mediante caché distribuida.</li>
            <li><strong>Satisfacción de clientes:</strong> Índice NPS incrementado a +72 puntos.</li>
          </ul>

          <h2 style="font-size: 16pt; font-weight: 700; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 28px;">2. Métricas y Desempeño</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 10pt;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; font-weight: 700; color: #334155;">Indicador (KPI)</th>
                <th style="border: 1px solid #cbd5e1; padding: 10px 14px; text-align: center; font-weight: 700; color: #334155;">Meta</th>
                <th style="border: 1px solid #cbd5e1; padding: 10px 14px; text-align: center; font-weight: 700; color: #334155;">Alcanzado</th>
                <th style="border: 1px solid #cbd5e1; padding: 10px 14px; text-align: center; font-weight: 700; color: #334155;">Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; color: #1e293b;">Usuarios Activos Mensuales</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; text-align: center; color: #64748b;">50,000</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; text-align: center; font-weight: 600; color: #0f172a;">62,400</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; text-align: center; color: #16a34a; font-weight: 600;">+24.8%</td>
              </tr>
              <tr style="background: #fcfcfc;">
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; color: #1e293b;">Disponibilidad del Sistema (SLA)</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; text-align: center; color: #64748b;">99.9%</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; text-align: center; font-weight: 600; color: #0f172a;">99.98%</td>
                <td style="border: 1px solid #e2e8f0; padding: 9px 14px; text-align: center; color: #16a34a; font-weight: 600;">Cumplido</td>
              </tr>
            </tbody>
          </table>
        `,
        id: 'page_1',
      },
    ],
    name: 'Informe Ejecutivo',
    settings: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 11,
      headerText: 'Reporte Estratégico Corporativo',
      lineHeight: 1.5,
      margins: { bottom: 96, left: 96, right: 96, top: 96 },
      orientation: 'portrait',
      paperSize: 'letter',
      showPageNumbers: true,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
  {
    description: 'Membrete formal con fecha, destinatario, asunto, cuerpo estructurado y firma.',
    icon: 'mail',
    id: 'formal_letter',
    initialPages: [
      {
        contentHtml: `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 18px; margin-bottom: 28px;">
            <div>
              <div style="font-size: 18pt; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">SPRITEBOARD INC.</div>
              <div style="font-size: 9.5pt; color: #64748b; line-height: 1.4;">Innovación en Colaboración Digital & Canvas Visual</div>
            </div>
            <div style="text-align: right; font-size: 9pt; color: #64748b; line-height: 1.4;">
              <div>Av. Tecnológica 1234, Piso 10</div>
              <div>contacto@spriteboard.com</div>
              <div>www.spriteboard.com</div>
            </div>
          </div>

          <div style="margin-bottom: 24px; font-size: 10.5pt;">
            <p style="margin: 0 0 16px 0; color: #475569;">Fecha: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p style="margin: 0; font-weight: 700; color: #0f172a;">A quien corresponda:</p>
            <p style="margin: 2px 0 0 0; color: #475569;">Presente.-</p>
          </div>

          <p style="font-size: 11pt; font-weight: 700; color: #0f172a; margin-bottom: 20px;">ASUNTO: Comunicación oficial sobre nueva suite de lienzos visuales.</p>

          <p style="line-height: 1.6; margin-bottom: 16px;">Por medio de la presente comunicación, nos complace compartir el despliegue del nuevo conjunto de plantillas profesionales integradas de forma nativa en la plataforma.</p>

          <p style="line-height: 1.6; margin-bottom: 16px;">Esta actualización garantiza que todas las áreas de trabajo mantengan una estética limpia, fondo blanco de alta fidelidad y máxima legibilidad editorial para todos los equipos.</p>

          <p style="line-height: 1.6; margin-bottom: 28px;">Agradecemos su confianza continua y quedamos a su disposición para cualquier duda o colaboración adicional.</p>

          <div style="margin-top: 48px;">
            <p style="margin: 0 0 40px 0; color: #475569;">Atentamente,</p>
            <div style="width: 220px; border-top: 1px solid #0f172a; padding-top: 8px;">
              <p style="margin: 0; font-weight: 700; color: #0f172a;">Lic. Jorge Ortega</p>
              <p style="margin: 2px 0 0 0; font-size: 9.5pt; color: #64748b;">Director de Tecnología & Producto</p>
            </div>
          </div>
        `,
        id: 'page_1',
      },
    ],
    name: 'Carta Formal',
    settings: {
      fontFamily: 'Georgia, serif',
      fontSize: 11,
      lineHeight: 1.6,
      margins: { bottom: 96, left: 96, right: 96, top: 96 },
      orientation: 'portrait',
      paperSize: 'letter',
      showPageNumbers: false,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
  {
    description: 'Plantilla para registrar asistentes, objetivos, temas tratados, acuerdos y tareas.',
    icon: 'groups',
    id: 'meeting_minutes',
    initialPages: [
      {
        contentHtml: `
          <h1 style="font-size: 22pt; font-weight: 800; color: #0f172a; margin-bottom: 6px;">Minuta de Reunión</h1>
          <p style="font-size: 11pt; color: #64748b; margin-top: 0; margin-bottom: 20px;">Sesión de Coordinación y Planificación</p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 10pt;">
            <tbody>
              <tr style="background: #f8fafc;">
                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-weight: 700; width: 140px; color: #334155;">Fecha:</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #1e293b;">${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-weight: 700; color: #334155;">Modalidad:</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #1e293b;">Sala Virtual Spriteboard</td>
              </tr>
              <tr style="background: #f8fafc;">
                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-weight: 700; color: #334155;">Participantes:</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #1e293b;">Dirección de Proyecto, Equipo Técnico, Diseño UX</td>
              </tr>
            </tbody>
          </table>

          <h2 style="font-size: 14pt; font-weight: 700; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 20px;">1. Acuerdos y Decisiones</h2>
          <div class="doc-callout doc-callout--success" style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; border-radius: 6px; margin: 14px 0;">
            <p style="margin: 0; color: #14532d; font-size: 10.5pt; line-height: 1.5;"><strong>Acuerdo Principal:</strong> Implementación de interfaz unificada con fondos de trabajo blancos y puntos sutiles para pizarrón y diagramas.</p>
          </div>
        `,
        id: 'page_1',
      },
    ],
    name: 'Minuta de Reunión',
    settings: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 10.5,
      headerText: 'Minuta de Reunión • Spriteboard',
      lineHeight: 1.5,
      margins: { bottom: 72, left: 72, right: 72, top: 72 },
      orientation: 'portrait',
      paperSize: 'letter',
      showPageNumbers: true,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
  {
    description: 'Estructura elegante con resumen profesional, experiencia laboral, habilidades y educación.',
    icon: 'badge',
    id: 'resume_cv',
    initialPages: [
      {
        contentHtml: `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px;">
            <div>
              <h1 style="font-size: 24pt; font-weight: 800; margin: 0; color: #0f172a; letter-spacing: -0.5px;">ALEX MORALES</h1>
              <p style="font-size: 12pt; font-weight: 600; color: #4f46e5; margin: 4px 0 0 0;">Ingeniero de Software Senior & Arquitecto Frontend</p>
            </div>
            <div style="text-align: right; font-size: 9.5pt; color: #64748b; line-height: 1.5;">
              <div>alex.morales@ejemplo.com</div>
              <div>+52 55 1234 5678</div>
            </div>
          </div>

          <h2 style="font-size: 13pt; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 16px;">Perfil Profesional</h2>
          <p style="line-height: 1.6; margin: 8px 0 16px 0; color: #334155;">Especialista en desarrollo web de alto rendimiento, sistemas distribuidos y diseño de interfaces reactivas modernas.</p>
        `,
        id: 'page_1',
      },
    ],
    name: 'Currículum Vitae (CV)',
    settings: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 10.5,
      lineHeight: 1.5,
      margins: { bottom: 72, left: 72, right: 72, top: 72 },
      orientation: 'portrait',
      paperSize: 'letter',
      showPageNumbers: false,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
  {
    badge: 'Comercial',
    description: 'Propuesta de servicios profesionales con alcance, cronograma y desglose de inversión.',
    icon: 'request_quote',
    id: 'project_proposal',
    initialPages: [
      {
        contentHtml: `
          <div style="text-align: center; padding: 30px 0; border-bottom: 2px solid #6366f1; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 4px 14px; background: #e0e7ff; color: #4338ca; border-radius: 9999px; font-weight: 700; font-size: 10pt; text-transform: uppercase; margin-bottom: 12px;">Propuesta Comercial</div>
            <h1 style="font-size: 24pt; font-weight: 800; color: #0f172a; margin: 0 0 8px 0;">Solución de Transformación Digital</h1>
            <p style="font-size: 12pt; color: #64748b; margin: 0;">Preparado para: Cliente Corporativo • Vigencia: 30 días</p>
          </div>

          <h2 style="font-size: 14pt; font-weight: 700; color: #1e293b; margin-top: 20px;">1. Alcance del Proyecto</h2>
          <p style="line-height: 1.6; color: #334155;">Desarrollo e integración de un entorno colaborativo en la nube que permite a los equipos crear pizarras, diagramas y documentos en un solo lugar.</p>

          <h2 style="font-size: 14pt; font-weight: 700; color: #1e293b; margin-top: 24px;">2. Desglose de Inversión</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 10pt;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left;">Fase / Módulo</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; width: 100px;">Duración</th>
                <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: right; width: 120px;">Inversión (USD)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px;">Arquitectura & Configuración Base</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: center;">2 semanas</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: right;">$3,500</td>
              </tr>
              <tr style="background: #fcfcfc;">
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px;">Implementación de Módulos Visuales</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: center;">4 semanas</td>
                <td style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: right;">$6,800</td>
              </tr>
              <tr style="font-weight: 700; background: #eff6ff;">
                <td style="border: 1px solid #bfdbfe; padding: 8px 12px;" colspan="2">Total Estimado</td>
                <td style="border: 1px solid #bfdbfe; padding: 8px 12px; text-align: right; color: #1d4ed8;">$10,300</td>
              </tr>
            </tbody>
          </table>
        `,
        id: 'page_1',
      },
    ],
    name: 'Propuesta Comercial',
    settings: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 11,
      headerText: 'Propuesta Comercial Confidencial',
      lineHeight: 1.5,
      margins: { bottom: 96, left: 96, right: 96, top: 96 },
      orientation: 'portrait',
      paperSize: 'letter',
      showPageNumbers: true,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
  {
    description: 'Documento técnico con casos de uso, requisitos funcionales y especificaciones de arquitectura.',
    icon: 'terminal',
    id: 'software_spec',
    initialPages: [
      {
        contentHtml: `
          <div style="border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px;">
            <div style="font-size: 10pt; color: #0284c7; font-weight: 700; text-transform: uppercase;">Especificación Técnica</div>
            <h1 style="font-size: 22pt; font-weight: 800; color: #0f172a; margin: 4px 0 8px 0;">Requerimientos de Software (SRS)</h1>
            <p style="font-size: 10.5pt; color: #64748b; margin: 0;">Módulo: Motor de Renderizado de Lienzos Multi-Herramienta</p>
          </div>

          <h2 style="font-size: 13pt; font-weight: 700; color: #1e293b; margin-top: 18px;">1. Descripción General</h2>
          <p style="line-height: 1.6; color: #334155;">El sistema provee una superficie de trabajo infinita con soporte para trazado libre, manipulación de formas vectoriales, notas adhesivas y exportación en alta resolución.</p>

          <h2 style="font-size: 13pt; font-weight: 700; color: #1e293b; margin-top: 20px;">2. Requerimientos Funcionales</h2>
          <ul style="margin: 8px 0; padding-left: 20px; line-height: 1.6; color: #334155;">
            <li><strong>RF-01:</strong> El fondo del pizarrón y diagramas debe ser blanco puro (#ffffff) con patrón de puntos (#cbd5e1).</li>
            <li><strong>RF-02:</strong> Los documentos deben presentar área de trabajo en hoja blanca aislada del contenedor visual exterior.</li>
            <li><strong>RF-03:</strong> Sincronización en tiempo real mediante WebSockets con persistencia incremental.</li>
          </ul>
        `,
        id: 'page_1',
      },
    ],
    name: 'Especificación de Software (SRS)',
    settings: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 10.5,
      headerText: 'SRS • Spriteboard System',
      lineHeight: 1.5,
      margins: { bottom: 72, left: 72, right: 72, top: 72 },
      orientation: 'portrait',
      paperSize: 'letter',
      showPageNumbers: true,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
  {
    description: 'Guía oficial de normativas, código de conducta y lineamientos operativos internos.',
    icon: 'gavel',
    id: 'company_policy',
    initialPages: [
      {
        contentHtml: `
          <div style="border-left: 4px solid #d97706; padding-left: 16px; margin-bottom: 24px;">
            <div style="font-size: 9.5pt; color: #d97706; font-weight: 700; text-transform: uppercase;">Manual Corporativo</div>
            <h1 style="font-size: 22pt; font-weight: 800; color: #0f172a; margin: 4px 0;">Políticas y Lineamientos de Seguridad</h1>
            <p style="font-size: 10.5pt; color: #64748b; margin: 0;">Versión 2.0 • Aplicable a todos los colaboradores y contratistas</p>
          </div>

          <h2 style="font-size: 13pt; font-weight: 700; color: #1e293b; margin-top: 18px;">1. Confidencialidad de la Información</h2>
          <p style="line-height: 1.6; color: #334155;">Queda estrictamente prohibida la divulgación de credenciales, claves maestras o información sensible en canales públicos o en respuestas hacia clientes externos.</p>

          <h2 style="font-size: 13pt; font-weight: 700; color: #1e293b; margin-top: 18px;">2. Uso Adecuado de Recursos</h2>
          <p style="line-height: 1.6; color: #334155;">Los repositorios, bases de datos y entornos de ejecución deben utilizarse exclusivamente para los fines asignados y bajo auditoría regular.</p>
        `,
        id: 'page_1',
      },
    ],
    name: 'Manual de Políticas',
    settings: {
      fontFamily: 'Georgia, serif',
      fontSize: 11,
      headerText: 'Manual de Políticas Corporativas',
      lineHeight: 1.6,
      margins: { bottom: 96, left: 96, right: 96, top: 96 },
      orientation: 'portrait',
      paperSize: 'letter',
      showPageNumbers: true,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
  {
    description: 'Acuerdo legal estándar entre proveedor y cliente con términos, entregables y cláusulas.',
    icon: 'description',
    id: 'service_contract',
    initialPages: [
      {
        contentHtml: `
          <h1 style="font-size: 20pt; font-weight: 800; text-align: center; color: #0f172a; margin-bottom: 24px;">CONTRATO DE PRESTACIÓN DE SERVICIOS</h1>
          <p style="line-height: 1.6; color: #334155;">Conste por el presente documento el Contrato de Prestación de Servicios que celebran, de una parte, el <strong>PROVEEDOR</strong>, y de otra parte, el <strong>CLIENTE</strong>, bajo las cláusulas siguientes:</p>
          
          <h2 style="font-size: 12pt; font-weight: 700; color: #0f172a; margin-top: 16px;">PRIMERA: OBJETO DEL CONTRATO</h2>
          <p style="line-height: 1.6; color: #334155;">El PROVEEDOR se compromete a brindar servicios profesionales de diseño, desarrollo e integración tecnológica conforme a los estándares acordados.</p>

          <h2 style="font-size: 12pt; font-weight: 700; color: #0f172a; margin-top: 16px;">SEGUNDA: CONTRAPRESTACIÓN Y PAGO</h2>
          <p style="line-height: 1.6; color: #334155;">El CLIENTE abonará la retribución acordada mediante transferencia bancaria en los plazos estipulados en el anexo de facturación.</p>
        `,
        id: 'page_1',
      },
    ],
    name: 'Contrato de Servicios',
    settings: {
      fontFamily: 'Georgia, serif',
      fontSize: 10.5,
      headerText: 'Contrato de Prestación de Servicios',
      lineHeight: 1.6,
      margins: { bottom: 96, left: 96, right: 96, top: 96 },
      orientation: 'portrait',
      paperSize: 'legal',
      showPageNumbers: true,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
  {
    description: 'Publicación editorial periódica con noticias, anuncios destacados y logros de la organización.',
    icon: 'newspaper',
    id: 'internal_newsletter',
    initialPages: [
      {
        contentHtml: `
          <div style="background: #10b981; color: #ffffff; padding: 24px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
            <div style="font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Edición Mensual</div>
            <h1 style="font-size: 24pt; font-weight: 800; margin: 4px 0 6px 0;">Boletín de Innovación & Comunidad</h1>
            <p style="font-size: 11pt; margin: 0; opacity: 0.9;">Novedades, lanzamientos y reconocimientos del mes</p>
          </div>

          <h2 style="font-size: 15pt; font-weight: 700; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">🌟 Logro Destacado</h2>
          <p style="line-height: 1.6; color: #334155;">Celebramos el lanzamiento de nuestra nueva suite de 60 plantillas con fondo blanco uniforme para todos los tipos de lienzos en Spriteboard.</p>
        `,
        id: 'page_1',
      },
    ],
    name: 'Boletín Informativo',
    settings: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 11,
      headerText: 'Boletín Mensual Spriteboard',
      lineHeight: 1.5,
      margins: { bottom: 72, left: 72, right: 72, top: 72 },
      orientation: 'portrait',
      paperSize: 'letter',
      showPageNumbers: true,
      viewMode: 'paginated',
      zoom: 1,
    },
  },
];

export function getDocTemplateById(templateId?: string | null): DocTemplatePreset {
  if (!templateId) return DOC_TEMPLATES[0];
  const found = DOC_TEMPLATES.find((t) => t.id === templateId);
  return found || DOC_TEMPLATES[0];
}
