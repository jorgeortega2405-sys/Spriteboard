# Cuenta Oficial de Spriteboard (Credenciales del Sistema)

Este archivo contiene la información de referencia de la cuenta oficial corporativa de **Spriteboard**, inicializada a través de `db_identity.sql`.

> **Nota de Seguridad**: Este documento es de uso interno exclusivo para el administrador del proyecto y no debe ser expuesto ni consumido por el frontend.

---

## Credenciales de Acceso

- **ID de Usuario en BD**: `1`
- **UUID**: `00000000-0000-0000-0000-000000000001`
- **Nombre de Usuario**: `spriteboard`
- **Correo Corporativo**: `official@spriteboard.com`
- **Contraseña en Texto Plano**: `!V65)v$uRP5s)V8TJ2d8s@%A`
- **Algoritmo de Hasheo**: `bcryptjs` (10 salt rounds)
- **Hash Almacenado**: `$2a$10$eCEkNhM7K3Okfk3rwi/jGukfeOJ47OFO.qJM71jxge/sLWPRIWIGy`

---

## Privilegios y Roles Asignados

1. **Rol Principal (`users.role`)**:
   - `SUPER_ADMIN`
2. **Roles Asociados (`user_roles`)**:
   - `SUPER_ADMIN`: Control y auditoría total del ecosistema y panel administrativo.
   - `PLATFORM_ADMIN`: Gestión operativa y de configuración de la plataforma.
   - `DESIGNER`: Habilitación indispensable para la creación, edición y publicación directa de plantillas oficiales del sistema (`is_official = TRUE`).
3. **Nivel de Suscripción (`subscription_tier`)**:
   - `business` (estado `active`, vigencia `2099-12-31`).

---

## Inicialización

Las credenciales y datos anteriores se aplican automáticamente en cada inicio en limpio de la base de datos MySQL mediante `db_identity.sql`.
