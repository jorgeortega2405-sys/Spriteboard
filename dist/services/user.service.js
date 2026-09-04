/**
 * Servicio de Acceso a Datos y Operaciones de Usuarios en MySQL
 */
import { pool } from '../config/database.js';
/**
 * Busca un usuario por su correo electrónico
 */
export async function findUserByEmail(email) {
    const [rows] = await pool.query('SELECT id, username, email, password_hash, avatar_url, google_id FROM users WHERE email = ? LIMIT 1', [email.toLowerCase().trim()]);
    return rows.length > 0 ? rows[0] : null;
}
/**
 * Busca un usuario por su nombre de usuario
 */
export async function findUserByUsername(username) {
    const [rows] = await pool.query('SELECT id, username, email, password_hash, avatar_url, google_id FROM users WHERE username = ? LIMIT 1', [username.trim()]);
    return rows.length > 0 ? rows[0] : null;
}
/**
 * Busca coincidencias por email o username (para detección rápida de duplicados)
 */
export async function findUserDuplicates(email, username) {
    const [rows] = await pool.query('SELECT id, username, email FROM users WHERE email = ? OR username = ? LIMIT 2', [email.toLowerCase().trim(), username.trim()]);
    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.toLowerCase().trim();
    let emailExists = false;
    let usernameExists = false;
    for (const user of rows) {
        if (user.email.toLowerCase() === cleanEmail)
            emailExists = true;
        if (user.username.toLowerCase() === cleanUsername)
            usernameExists = true;
    }
    return { emailExists, usernameExists };
}
/**
 * Busca un usuario por su ID
 */
export async function findUserById(id) {
    const [rows] = await pool.query('SELECT id, username, email, avatar_url, google_id FROM users WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0 ? rows[0] : null;
}
/**
 * Crea un nuevo usuario en la base de datos
 */
export async function createUser(data) {
    const [result] = await pool.query('INSERT INTO users (username, email, password_hash, avatar_url) VALUES (?, ?, ?, ?)', [
        data.username.trim(),
        data.email.toLowerCase().trim(),
        data.passwordHash,
        data.avatarUrl || null,
    ]);
    return {
        id: result.insertId,
        username: data.username.trim(),
        email: data.email.toLowerCase().trim(),
        ...(data.avatarUrl ? { avatar_url: data.avatarUrl } : {}),
    };
}
/**
 * Actualiza la contraseña hasheada de un usuario
 */
export async function updateUserPassword(userId, passwordHash) {
    const [result] = await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    return result.affectedRows > 0;
}
