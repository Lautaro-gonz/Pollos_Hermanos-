// Helpers de sesión para el panel. La protección real la dan las políticas RLS
// (supabase/schema.sql): aunque alguien saltee estas redirecciones, sin ser
// admin no puede leer productos ocultos ni modificar nada.

import { supabase } from '../supabase.js';

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}

/** Consulta al servidor si el usuario logueado está en la tabla `admins`. */
export async function checkIsAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) {
    console.error('is_admin:', error);
    return false;
  }
  return data === true;
}

export async function signOut() {
  await supabase.auth.signOut();
}
