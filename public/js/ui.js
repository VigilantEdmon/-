function applySessionControls() {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const username = localStorage.getItem('username') || (role === 'admin' ? 'admin' : 'user');
  const elLogin = document.getElementById('linkLogin');
  const elRegister = document.getElementById('linkRegister');
  const elAdmin = document.getElementById('linkAdmin');
  const elUserInfo = document.getElementById('userInfo');
  const elLogout = document.getElementById('logoutBtn');
  if (token) {
    if (elLogin) elLogin.style.display = 'none';
    if (elRegister) elRegister.style.display = 'none';
    if (elLogout) elLogout.style.display = 'inline-flex';
    if (elUserInfo) elUserInfo.textContent = `Привет, ${username}`;
    if (elAdmin) elAdmin.style.display = role === 'admin' ? 'inline-flex' : 'none';
  } else {
    if (elLogin) elLogin.style.display = 'inline-flex';
    if (elRegister) elRegister.style.display = 'inline-flex';
    if (elLogout) elLogout.style.display = 'none';
    if (elUserInfo) elUserInfo.textContent = '';
    if (elAdmin) elAdmin.style.display = 'none';
  }
  if (elLogout) {
    elLogout.onclick = () => { localStorage.clear(); window.location.reload(); };
  }
}

function startHeroSlideshow() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const images = ['/assets/luxe1.svg', '/assets/luxe2.svg', '/assets/luxe3.svg'];
  let idx = 0;
  setInterval(() => {
    idx = (idx + 1) % images.length;
    hero.style.backgroundImage = `url('${images[idx]}')`;
  }, 6000);
}

window.addEventListener('DOMContentLoaded', () => {
  applySessionControls();
  startHeroSlideshow();
});

