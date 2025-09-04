function fromRuToIso(ru) {
  if (!ru) return '';
  const [d, m, y] = ru.split('.');
  return `${y}-${m}-${d}`;
}

function toRu(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

async function loadRooms() {
  const params = new URLSearchParams(window.location.search);
  const category = document.getElementById('category');
  const dateStart = document.getElementById('dateStart');
  const dateEnd = document.getElementById('dateEnd');
  const persons = document.getElementById('persons');

  if (params.get('category')) category.value = params.get('category');
  if (params.get('start')) dateStart.value = fromRuToIso(params.get('start'));
  if (params.get('end')) dateEnd.value = fromRuToIso(params.get('end'));
  if (params.get('persons')) persons.value = params.get('persons');

  const qs = new URLSearchParams({
    category: category.value,
    start: params.get('start') || toRu(dateStart.value),
    end: params.get('end') || toRu(dateEnd.value),
    persons: persons.value
  }).toString();
  const res = await fetch(`/api/rooms?${qs}`);
  const rooms = await res.json();
  renderRooms(rooms, category.value, persons.value, dateStart.value, dateEnd.value);
}

function renderRooms(rooms, category, persons, startIso, endIso) {
  const list = document.getElementById('roomsList');
  list.innerHTML = '';
  const img = { standard: '/assets/luxe1.svg', comfort: '/assets/luxe2.svg', luxe: '/assets/luxe3.svg' };
  const title = { standard: 'Стандарт', comfort: 'Комфорт', luxe: 'Люкс' };
  rooms.forEach(r => {
    const el = document.createElement('div');
    el.className = 'card';
    const statusClass = r.available ? 'free' : 'busy';
    const statusText = r.available ? 'Свободно' : (r.until ? `Занято до ${r.until}` : 'Занято');
    el.innerHTML = `
      <img src="${img[r.category]}" alt="${title[r.category]}">
      <div class="card-body">
        <div class="badge">${title[r.category]} · Комнат: 1 · Кроватей: ${r.beds}</div>
        <div class="status ${statusClass}">${statusText}</div>
        <div>Номер: ${r.roomNumber}</div>
        <div class="price">${r.totalPrice.toLocaleString('ru-RU')}₽ за ${r.nights} ноч.</div>
        <button class="btn btn-primary" ${r.available ? '' : 'disabled'} data-room-id="${r.id}">Забронировать</button>
      </div>`;
    el.querySelector('button').addEventListener('click', () => openBookingModal(r, persons, startIso, endIso));
    list.appendChild(el);
  });
}

function openBookingModal(room, persons, startIso, endIso) {
  const modal = document.getElementById('bookingModal');
  modal.classList.remove('hidden');
  document.getElementById('bPersons').value = persons || '1';
  document.getElementById('bStart').value = startIso || '';
  document.getElementById('bEnd').value = endIso || '';
  modal.dataset.roomCategory = room.category;
}

function closeModal() {
  const modal = document.getElementById('bookingModal');
  modal.classList.add('hidden');
}

async function confirmBooking() {
  const fio = document.getElementById('fio').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const persons = document.getElementById('bPersons').value;
  const startIso = document.getElementById('bStart').value;
  const endIso = document.getElementById('bEnd').value;
  const category = document.getElementById('bookingModal').dataset.roomCategory;
  if (!fio || !phone || !email || !startIso || !endIso) return alert('Заполните все поля.');
  const payload = {
    fullName: fio,
    phone,
    email,
    category,
    persons,
    startDate: toRu(startIso),
    endDate: toRu(endIso)
  };
  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : ''
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error || 'Ошибка');
  alert(`Бронь оформлена. Номер: ${data.roomNumber}`);
  closeModal();
  loadRooms();
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('filterBtn')?.addEventListener('click', loadRooms);
  document.getElementById('cancelBooking')?.addEventListener('click', closeModal);
  document.getElementById('confirmBooking')?.addEventListener('click', confirmBooking);
  loadRooms();
});

