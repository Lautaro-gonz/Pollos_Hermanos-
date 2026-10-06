// Configuración pública del sitio (este archivo se publica en GitHub y en la web).
// La clave publicable (sb_publishable_… / anon) es pública por diseño: la seguridad
// la dan las políticas RLS de supabase/schema.sql.
// ⚠ NUNCA pongas aquí la clave secreta (sb_secret_… / service_role): saltea toda la seguridad.

// Supabase › Project Settings › API › Project URL (ej: https://abcdefgh.supabase.co)
export const SUPABASE_URL = 'https://fapggmtqkbsarzoimexx.supabase.co';
// Supabase › Project Settings › API Keys › Publishable key
export const SUPABASE_ANON_KEY = 'sb_publishable_5ld6M7mcz8kcTi8Kth_hLQ_bEbbwzJL';

export const STORAGE_BUCKET = 'product-images';

// +54 376 4678243 → formato wa.me: sin '+', con el '9' de celular argentino
export const WHATSAPP_NUMBER = '5493764678243';

// Horarios de retiro. Clave = día de la semana (0 domingo … 6 sábado).
// Cada día es una lista de franjas [apertura, cierre] en formato 24 h. Lista vacía = cerrado.
export const BUSINESS_HOURS = {
  0: [],                                        // domingo: cerrado
  1: [['09:00', '12:45'], ['18:00', '20:30']],  // lunes
  2: [['09:00', '12:45'], ['18:00', '20:30']],  // martes
  3: [['09:00', '12:45'], ['18:00', '20:30']],  // miércoles
  4: [['09:00', '12:45'], ['18:00', '20:30']],  // jueves
  5: [['09:00', '12:45'], ['18:00', '20:30']],  // viernes
  6: [['09:00', '13:00']],                      // sábado
};
