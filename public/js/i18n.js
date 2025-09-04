const dict = {
  ru: {
    register: 'Регистрация',
    login: 'Войти',
    description: 'Элегантная гостиница для вашего идеального отдыха.',
    category: 'Категория',
    standard: 'Стандарт',
    comfort: 'Комфорт',
    luxe: 'Люкс',
    checkin: 'Дата заезда',
    checkout: 'Дата выезда',
    persons: 'Персоны',
    findRooms: 'Найти номера',
    roomsTitle: 'Категории номеров',
    seeAll: 'Смотреть все номера',
    home: 'На главную',
    apply: 'Применить',
    booking: 'Бронирование',
    confirm: 'Подтвердить',
    cancel: 'Отмена',
    or: 'или',
    haveAccount: 'Уже есть аккаунт?'
  },
  en: {
    register: 'Register',
    login: 'Log in',
    description: 'An elegant hotel for your perfect stay.',
    category: 'Category',
    standard: 'Standard',
    comfort: 'Comfort',
    luxe: 'Suite',
    checkin: 'Check-in',
    checkout: 'Check-out',
    persons: 'Guests',
    findRooms: 'Find rooms',
    roomsTitle: 'Room categories',
    seeAll: 'See all rooms',
    home: 'Home',
    apply: 'Apply',
    booking: 'Booking',
    confirm: 'Confirm',
    cancel: 'Cancel',
    or: 'or',
    haveAccount: 'Already have an account?'
  }
};

function applyI18n(lang) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const str = dict[lang]?.[key];
    if (str) el.textContent = str;
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const lang = localStorage.getItem('lang') || 'ru';
  applyI18n(lang);
  const toggle = document.getElementById('langToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = (localStorage.getItem('lang') || 'ru') === 'ru' ? 'en' : 'ru';
      localStorage.setItem('lang', next);
      applyI18n(next);
    });
  }
});

