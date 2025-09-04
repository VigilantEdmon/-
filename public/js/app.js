async function fetchRoomsPreview() {
  const res = await fetch('/api/rooms?persons=1');
  const rooms = await res.json();
  const sampleByCat = {};
  for (const r of rooms) {
    if (!sampleByCat[r.category]) sampleByCat[r.category] = r;
  }
  const cards = document.getElementById('cards');
  if (!cards) return;
  cards.innerHTML = '';
  const images = { standard: '/assets/luxe1.svg', comfort: '/assets/luxe2.svg', luxe: '/assets/luxe3.svg' };
  const title = { standard: 'Стандарт', comfort: 'Комфорт', luxe: 'Люкс' };
  Object.keys(sampleByCat).forEach(cat => {
    const r = sampleByCat[cat];
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <img src="${images[cat]}" alt="${title[cat]}">
      <div class="card-body">
        <div class="badge">${title[cat]}</div>
        <div class="status ${r.available ? 'free' : 'busy'}">${r.available ? 'Свободно' : 'Занято'}</div>
        <div class="price">от ${r.totalPrice.toLocaleString('ru-RU')}₽ / ночь</div>
        <a href="/rooms.html" class="btn btn-primary">Забронировать</a>
      </div>`;
    cards.appendChild(el);
  });
}

function setupSearch() {
  const category = document.getElementById('category');
  const dateStart = document.getElementById('dateStart');
  const dateEnd = document.getElementById('dateEnd');
  const persons = document.getElementById('persons');
  const btn = document.getElementById('searchBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const qs = new URLSearchParams({
      category: category.value,
      start: toRu(dateStart.value),
      end: toRu(dateEnd.value),
      persons: persons.value
    }).toString();
    window.location.href = `/rooms.html?${qs}`;
  });
}

function toRu(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

window.addEventListener('DOMContentLoaded', () => {
  fetchRoomsPreview();
  setupSearch();
  loadSummary();
});

async function loadSummary() {
  try {
    const res = await fetch('/api/summary');
    const data = await res.json();
    const stats = document.getElementById('stats');
    if (!stats || !data.categories) return;
    const fmt = (cat, label) => {
      const c = data.categories[cat];
      return `<div class="badge">${label}: свободно ${c.free} из ${c.total}</div>`;
    };
    stats.innerHTML = [
      fmt('standard', 'Стандарт'),
      fmt('comfort', 'Комфорт'),
      fmt('luxe', 'Люкс')
    ].join(' ');
  } catch (e) {}
}

