import { supabase, isSupabaseConfigured } from '../supabase.js';
import { getSession, checkIsAdmin, signOut } from './session.js';

const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');
const submitBtn = document.getElementById('login-submit');
const passwordInput = document.getElementById('password');
const toggle = document.getElementById('password-toggle');

const goToDashboard = () => window.location.replace('dashboard.html');

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

function setLoading(loading) {
  submitBtn.classList.toggle('is-loading', loading);
  submitBtn.disabled = loading;
  submitBtn.innerHTML = loading ? '<span class="spinner" aria-hidden="true"></span> Ingresando…' : 'Ingresar';
}

function friendlyAuthError(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (msg.includes('email not confirmed')) return 'Este email todavía no fue confirmado. Confirmalo desde Supabase › Authentication › Users.';
  if (msg.includes('rate limit') || error?.status === 429) return 'Demasiados intentos. Esperá un minuto y probá de nuevo.';
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'No pudimos conectar con el servidor. Revisá tu conexión.';
  return 'No pudimos iniciar sesión. Probá de nuevo.';
}

toggle.addEventListener('click', () => {
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  toggle.setAttribute('aria-pressed', String(show));
  toggle.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  passwordInput.focus();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');

  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) {
    showError('Completá tu email y contraseña.');
    (email ? form.password : form.email).focus();
    return;
  }

  setLoading(true);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setLoading(false);
    showError(friendlyAuthError(error));
    return;
  }

  if (!(await checkIsAdmin())) {
    await signOut();
    setLoading(false);
    showError('Tu usuario no tiene permisos de administrador. Agregalo a la tabla "admins" (paso 6 de supabase/schema.sql).');
    return;
  }

  goToDashboard();
});

// Si ya hay una sesión de admin abierta, ir directo al panel
if (!isSupabaseConfigured) {
  document.getElementById('login-config').hidden = false;
  form.querySelectorAll('input, button').forEach((n) => { n.disabled = true; });
} else {
  const session = await getSession();
  if (session && (await checkIsAdmin())) goToDashboard();
}
