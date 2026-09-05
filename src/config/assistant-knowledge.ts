/**
 * Base de Conocimiento Oficial de Spriteboard para el Asistente de IA
 * Contiene toda la información estructural, funcional, de navegación y diseño de la web.
 */

export const ASSISTANT_KNOWLEDGE = `
### ¿QUÉ ES SPRITEBOARD?
Spriteboard es una plataforma web moderna, rápida y colaborativa diseñada para la gestión de proyectos, tableros visuales, notas y organización de ideas. Está construida con una arquitectura SPA (Single Page Application) modular, nativa, sin dependencias pesadas en frontend y con un diseño enterprise altamente refinado.

### SECCIONES Y RUTAS DE LA PLATAFORMA:
1. PÁGINA PRINCIPAL ('/'):
   - Es el centro de trabajo principal del usuario.
   - Cuenta con una barra superior (TopBar) fija e interactiva que incluye:
     - Botón de menú lateral izquierdo (icono de hamburguesa) para navegar a Inicio y Papelera.
     - Barra de búsqueda global para localizar tableros, proyectos o configuraciones.
     - Botón de ayuda/asistencia (icono de 'help') que despliega este chat a la derecha.
     - Menú de perfil o botón de 'Acceder' si es invitado.

2. PAPELERA DE RECICLAJE ('/trash'):
   - Almacena proyectos, notas o elementos eliminados recientemente.
   - Permite recuperar elementos a su ubicación original o eliminarlos de manera permanente.

3. SISTEMA DE AUTENTICACIÓN Y REGISTRO:
   - Inicio de Sesión ('/login'):
     - Ingreso con correo electrónico y contraseña.
     - Opción de inicio de sesión social rápido con Google ("Continuar con Google").
     - Enlace para recuperar contraseña olvidada.
   - Registro en 3 Etapas Seguras:
     - Etapa 1 ('/register'): Correo electrónico y contraseña (incluye sugerencia y medidor de seguridad).
     - Etapa 2 ('/register/aditional-data'): Nombre de usuario único y fecha de nacimiento.
     - Etapa 3 ('/register/verification-account'): Validación mediante código numérico de 6 dígitos enviado al correo electrónico.
   - Recuperación de Contraseña ('/forgot-password' y '/reset-password'):
     - Envío seguro de código o enlace para restaurar el acceso.

4. SECCIÓN DE CONFIGURACIÓN ('/settings'):
   - Si el usuario ha iniciado sesión, es dirigido a su cuenta ('/settings/your-account').
   - Si es usuario invitado sin sesión, es dirigido a la configuración de invitado ('/settings/guest').
   - Subsecciones disponibles:
     - Tu Cuenta ('/settings/your-account'):
       - Actualización de foto de perfil / avatar (soporta PNG, JPEG, WEBP con recorte circular).
       - Edición de nombre de usuario, correo electrónico, nombre personal y datos de contacto.
     - Inicio de Sesión y Seguridad ('/settings/security'):
       - Cambio de contraseña actual por una nueva.
       - Monitoreo y cierre de sesiones activas en otros dispositivos.
     - Accesibilidad y Apariencia ('/settings/accessibility'):
       - Selección de Tema Visual: Modo Claro (Light Mode), Modo Oscuro (Dark Mode OLED/Charcoal) y Modo Sistema (Automático).
       - Modo Alto Contraste: Para mejorar la legibilidad en condiciones de luz difíciles o para personas con visión reducida.
       - Reducción de Movimiento: Desactiva animaciones y transiciones para evitar fatiga visual.
       - Idioma: Soporte en Español Latinoamericano ('es-419').
     - Configuración de Invitado ('/settings/guest'):
       - Permite a usuarios que navegan sin registrarse ajustar tema, contraste y preferencias locales.

5. SISTEMA MULTICUENTA (ACCOUNT SWITCHER):
   - Integrado en el avatar del TopBar.
   - Permite agregar y vincular múltiples cuentas en el mismo navegador.
   - Conmutación instantánea entre cuentas sin tener que cerrar sesión ni volver a ingresar contraseñas.
   - Opción para cerrar sesión en la cuenta activa o "Cerrar todas las sesiones" de forma masiva.

6. SISTEMA DE DISEÑO Y ATAJOS:
   - Paleta cromática HSL normalizada con modo claro puro (#ffffff) y modo oscuro OLED (#09090b).
   - Animación de carga antiflicker (shimmer gris azulado bajo).
   - Atajos de teclado:
     - Tecla 'Escape': Cierra modales, menús flotantes, el sidebar izquierdo y el chat de ayuda.
     - Tecla 'Enter' en el chat: Envía el mensaje al asistente inmediatamente.
`.trim();

export default ASSISTANT_KNOWLEDGE;
