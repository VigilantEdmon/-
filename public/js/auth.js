async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const res = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Ошибка входа');
  localStorage.setItem('token', data.token);
  localStorage.setItem('role', data.role);
  localStorage.setItem('username', data.username);
  if (data.role === 'admin') window.location.href = '/admin.html';
  else window.location.href = '/';
}

async function registerUser() {
  const phone = document.getElementById('phone').value.trim();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const res = await fetch('/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, username, password })
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Ошибка регистрации');
  localStorage.setItem('token', data.token);
  localStorage.setItem('role', data.role);
  localStorage.setItem('username', data.username);
  window.location.href = '/';
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn')?.addEventListener('click', login);
  document.getElementById('registerBtn')?.addEventListener('click', registerUser);
});

