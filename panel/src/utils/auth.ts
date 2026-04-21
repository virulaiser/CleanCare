import { Usuario } from '../services/api';

export function getUsuario(): Usuario | null {
  const raw = localStorage.getItem('cleancare_usuario');
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function getToken(): string | null {
  return localStorage.getItem('cleancare_token');
}

export function logout() {
  localStorage.removeItem('cleancare_token');
  localStorage.removeItem('cleancare_usuario');
  window.location.href = '/';
}

export function esSuperAdmin(u: Usuario | null = getUsuario()) {
  return u?.rol === 'admin';
}

export function esAdminEdificio(u: Usuario | null = getUsuario()) {
  return u?.rol === 'admin_edificio';
}
