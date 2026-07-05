const API_BASE_URL = "https://major-motors-sam.uz/api";
const SERVER_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");
const STORAGE_KEY = "major_fest_web_profile_id";
const ADMIN_STORAGE_KEY = "major_fest_admin_token";

const state = {
  settings: null,
  festivals: [],
  profile: null,
  applications: [],
  selectedFestival: null,
  selectedCars: new Set(),
  adminApplications: [],
  adminFilter: "all",
  adminSearch: "",
  adminToken: localStorage.getItem(ADMIN_STORAGE_KEY) || "",
  selectedAdminApplication: null,
  selectedTicketApplication: null,
  heroImages: [],
  heroSlide: 0,
  touchStartX: 0,
  authMode: "login",
  avatar: {
    file: null,
    url: "",
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    imageWidth: 0,
    imageHeight: 0,
  },
};

const page = document.body.dataset.page || "home";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const applicationStatusMeta = {
  new: { label: "В ожидании", group: "pending" },
  reviewing: { label: "В ожидании", group: "pending" },
  approved: { label: "Принята", group: "approved" },
  rejected: { label: "Не принята", group: "rejected" },
};

const icons = {
  user: '<svg viewBox="0 0 24 24"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
  car: '<svg viewBox="0 0 24 24"><path d="M19 17h2l-2-7a3 3 0 0 0-3-2H8a3 3 0 0 0-3 2l-2 7h2"/><path d="M7 17h10"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
  garage: '<svg viewBox="0 0 24 24"><path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M8 21v-7h8v7"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
  message: '<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/></svg>',
  ticket: '<svg viewBox="0 0 24 24"><path d="M2 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 0 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v14"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  logout: '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>',
  "chevron-left": '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  "chevron-right": '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
};

function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icons[node.dataset.icon] || "";
  });
}

function mediaUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${SERVER_BASE_URL}${url}`;
}

function fallbackImage() {
  return "/web/assets/logo_2.png";
}

function getInitial(name = "") {
  return name.trim().charAt(0).toUpperCase() || "U";
}

function escapeText(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(value) {
  if (!value) return "Дата уточняется";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
  }).format(new Date(value));
}

function formatMoney(value) {
  if (!value) return "Не указан";
  return `${Number(value).toLocaleString("ru-RU")} сум`;
}

function getCountdown(festival) {
  const diff = new Date(festival?.start_date || 0).getTime() - Date.now();
  if (!festival || diff <= 0) return ["00", "00", "00", "00"];
  const seconds = Math.floor(diff / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const leftSeconds = seconds % 60;
  return [days, hours, minutes, leftSeconds].map((part) => String(part).padStart(2, "0"));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function festivalImages(festival) {
  const adminSlides = unique((festival?.cover_slides || []).map((slide) => mediaUrl(slide.image)));
  return adminSlides;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) throw new Error(await readApiError(response));
  if (response.status === 204) return null;
  return response.json();
}

async function adminApi(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.adminToken) headers.set("Authorization", `Bearer ${state.adminToken}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const error = new Error(await readApiError(response));
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

async function readApiError(response) {
  const text = await response.text();
  if (!text) return `HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed)) return parsed.join("\n");
    return Object.values(parsed).flat().join("\n");
  } catch {
    return text;
  }
}

function toast(message) {
  const node = $("#toast");
  if (!node) return;
  node.textContent = message;
  node.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => node.classList.remove("show"), 3200);
}

async function loadSettings() {
  try {
    state.settings = await api("/app-settings/");
  } catch {
    state.settings = null;
  }
  renderSettings();
}

async function loadFestivals() {
  const payload = await api("/festivals/");
  state.festivals = Array.isArray(payload) ? payload : payload.results || [];
}

async function loadProfileFromStorage() {
  const storedId = localStorage.getItem(STORAGE_KEY);
  if (!storedId) return;
  try {
    state.profile = await api(`/profiles/${storedId}/`);
    await loadApplications();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    state.profile = null;
    state.applications = [];
  }
}

async function loadApplications() {
  if (!state.profile) return;
  const payload = await api(`/applications/?participant=${state.profile.id}`);
  state.applications = Array.isArray(payload) ? payload : payload.results || [];
}

function renderSettings() {
  document.title = document.title.replace("Major Fest", "Samarkand Fest");
}

function renderSessionNav() {
  const authButton = $("#authOpenButton");
  if (!authButton) return;
  authButton.href = state.profile ? "/web/profile.html" : "/web/auth.html";
  authButton.querySelector("span:last-child").textContent = state.profile ? "Профиль" : "Войти";
}

function renderFestivalDetail() {
  const festival = state.festivals[0];
  if (!festival) {
    const pageNode = $("#festivalDetailPage");
    if (pageNode) {
      pageNode.innerHTML = `<section class="empty-page"><h1>Samarkand Fest</h1><p class="muted">Пока нет открытого фестиваля.</p></section>`;
    }
    return;
  }

  state.selectedFestival = festival;
  state.selectedCars.clear();
  state.heroImages = festivalImages(festival);
  state.heroSlide = 0;

  const title = festival.title || state.settings?.title || "Samarkand Fest";
  const place = [festival.city, festival.address].filter(Boolean).join(", ");

  $("#heroTitle").textContent = title;
  $("#heroDescription").textContent = festival.description || "Фестиваль автомобилей, драйва и лучших проектов города. Выбирай авто из профиля и отправляй заявку за пару кликов.";

  renderHeroCarousel();
  renderFestivalStats(festival, place);
  renderSelectableCars();
  renderNews(festival, place);
  renderComments(festival);
  updateDetailCountdown();
  hydrateIcons();
}

function renderHeroCarousel() {
  const image = $("#heroImage");
  const dots = $("#carouselDots");
  const loader = $("#heroLoader");
  if (!image) return;
  if (!state.heroImages.length) {
    image.removeAttribute("src");
    image.style.opacity = "0";
    loader?.classList.remove("is-hidden");
    if (dots) dots.innerHTML = "";
    return;
  }
  image.style.opacity = "0";
  loader?.classList.remove("is-hidden");
  window.setTimeout(() => {
    image.onload = () => {
      image.style.opacity = "1";
      loader?.classList.add("is-hidden");
    };
    image.src = state.heroImages[state.heroSlide];
  }, 120);
  if (dots) {
    dots.innerHTML = state.heroImages.map((_, index) => `
      <button class="${index === state.heroSlide ? "active" : ""}" type="button" data-slide="${index}" aria-label="Фото ${index + 1}"></button>
    `).join("");
    $$("#carouselDots button").forEach((button) => {
      button.addEventListener("click", () => {
        state.heroSlide = Number(button.dataset.slide);
        renderHeroCarousel();
      });
    });
  }
}

function moveHeroSlide(direction) {
  if (!state.heroImages.length) return;
  state.heroSlide = (state.heroSlide + direction + state.heroImages.length) % state.heroImages.length;
  renderHeroCarousel();
}

function renderFestivalStats(festival, place) {
  const stats = $("#festivalStats");
  if (!stats) return;
  stats.innerHTML = [
    ["Площадка", "Samarkand Touristic Centre", "garage"],
    ["Старт", formatDate(festival.start_date), "ticket"],
    ["Призовой фонд", festival.prize_fund ? formatMoney(festival.prize_fund) : "Фонд предусмотрен", "spark"],
  ].map(([label, value, icon]) => `
    <article class="stat-card reveal">
      <span class="icon-badge" data-icon="${icon}"></span>
      <small>${label}</small>
      <strong>${value}</strong>
    </article>
  `).join("");
}

function updateDetailCountdown() {
  const countdown = $("#detailCountdown");
  if (!countdown || !state.selectedFestival) return;
  countdown.innerHTML = getCountdown(state.selectedFestival).map((part) => `<b>${part}</b>`).join("");
}

function renderSelectableCars() {
  const box = $("#selectableCars");
  if (!box) return;
  const cars = state.profile?.cars || [];
  if (!state.profile) {
    box.innerHTML = `<div class="empty-card"><p>Войди в профиль, чтобы выбрать авто для заявки.</p><a class="glass-button" href="/web/auth.html"><span class="icon" data-icon="user"></span><span>Войти</span></a></div>`;
    hydrateIcons(box);
    return;
  }
  if (!cars.length) {
    box.innerHTML = `<div class="empty-card"><p>Сначала добавь автомобиль в гараж.</p><a class="glass-button" href="/web/profile.html"><span class="icon" data-icon="garage"></span><span>Открыть профиль</span></a></div>`;
    hydrateIcons(box);
    return;
  }
  box.innerHTML = cars.map((car) => `
    <label class="selectable-car">
      <input type="checkbox" value="${car.id}">
      <span class="car-check"></span>
      <span>
        <strong>${car.make} ${car.model}</strong>
        <small>${car.year} · ${car.engine}</small>
      </span>
    </label>
  `).join("");
  $$("#selectableCars input").forEach((input) => {
    input.addEventListener("change", () => {
      const id = Number(input.value);
      if (input.checked) state.selectedCars.add(id);
      else state.selectedCars.delete(id);
    });
  });
}

function renderNews(festival, place) {
  const news = $("#newsGrid");
  if (!news) return;
  const adminNews = (festival.media_items || [])
    .filter((item) => item.title || item.description)
    .map((item) => ({
      icon: item.media_type === "video" ? "message" : "spark",
      title: item.title || "Новость фестиваля",
      text: item.description || "Подробности скоро появятся.",
      image: item.media_type === "image" ? mediaUrl(item.file) : "",
    }));
  const items = adminNews.length ? adminNews : [
    {
      icon: "ticket",
      title: festival.status === "closed" ? "Прием заявок закрыт" : "Прием заявок открыт",
      text: festival.status === "closed" ? "Следи за статусом своей заявки в профиле." : "Выбери авто из гаража и отправь заявку на участие.",
    },
    {
      icon: "garage",
      title: place || "Локация уточняется",
      text: festival.address ? `Фестиваль пройдет по адресу: ${festival.address}.` : "Точная площадка появится в карточке фестиваля.",
    },
    {
      icon: "spark",
      title: "Призовой фонд",
      text: `${formatMoney(festival.prize_fund)} и ${festival.prize_places || "несколько"} призовых мест для лучших проектов.`,
    },
  ];
  news.innerHTML = items.map((item) => `
    <article class="news-card">
      ${item.image ? `<img src="${item.image}" alt="${item.title}">` : ""}
      <h3>${item.title}</h3>
      <p>${item.text}</p>
    </article>
  `).join("");
}

function renderComments(festival) {
  const box = $("#commentsBox");
  if (!box) return;
  const comments = festival.comments || [];
  box.innerHTML = comments.length
    ? comments.map((comment) => {
        const name = comment.participant_name || "Участник";
        const photo = mediaUrl(comment.participant_photo);
        const ownComment = state.profile && Number(comment.participant) === Number(state.profile.id);
        const avatar = photo
          ? `<img class="comment-avatar" src="${photo}" alt="${name}">`
          : `<span class="comment-avatar comment-avatar-fallback">${getInitial(name)}</span>`;
        return `
          <article class="comment-card">
            ${avatar}
            <div class="comment-body">
              <strong>${name}</strong>
              <p>${comment.text}</p>
            </div>
            ${ownComment ? `
              <button class="comment-delete-button" type="button" data-comment-id="${comment.id}" aria-label="Удалить комментарий" title="Удалить комментарий">
                <span class="icon" data-icon="trash"></span>
              </button>
            ` : ""}
          </article>
        `;
      }).join("")
    : `<p class="muted">Комментариев пока нет.</p>`;
  hydrateIcons(box);

  const form = $("#commentForm");
  if (!form) return;
  if (!state.profile) {
    form.innerHTML = `<p class="muted">Войди в профиль, чтобы оставить комментарий.</p><a class="glass-button" href="/web/auth.html"><span class="icon" data-icon="user"></span><span>Войти</span></a>`;
    hydrateIcons(form);
  }
}

async function handleCommentDelete(event) {
  const button = event.target.closest(".comment-delete-button");
  if (!button || !state.profile) return;
  if (!window.confirm("Удалить свой комментарий?")) return;
  try {
    await api(`/comments/${button.dataset.commentId}/?participant=${state.profile.id}`, { method: "DELETE" });
    toast("Комментарий удален");
    await loadFestivals();
    renderFestivalDetail();
  } catch (error) {
    toast(error.message);
  }
}

async function handleCommentCreate(event) {
  event.preventDefault();
  if (!state.profile) return;
  if (!state.selectedFestival) return;
  const form = event.currentTarget;
  const text = form.text.value.trim();
  if (!text) return;

  try {
    await api("/comments/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        festival: state.selectedFestival.id,
        participant: state.profile.id,
        text,
      }),
    });
    form.reset();
    $("#commentMessage").textContent = "Комментарий добавлен.";
    await loadFestivals();
    renderFestivalDetail();
  } catch (error) {
    $("#commentMessage").textContent = error.message;
  }
}

function setAuthMode(mode) {
  state.authMode = mode;
  $$("[data-auth-mode]").forEach((button) => button.classList.toggle("active", button.dataset.authMode === mode));
  $$("[data-register-only]").forEach((node) => {
    node.hidden = mode !== "register";
  });
  $$("[data-login-only]").forEach((node) => {
    node.hidden = mode !== "login";
  });
  const submit = $("#authSubmit");
  const message = $("#authMessage");
  if (submit) submit.querySelector("span:last-child").textContent = mode === "register" ? "Создать профиль" : "Войти";
  if (message) message.textContent = "";
}

function getSelectedPhoneRule(form) {
  const option = form.country_code?.selectedOptions?.[0];
  return {
    length: Number(option?.dataset.phoneLength || 15),
    placeholder: option?.dataset.placeholder || "90 123 45 67",
  };
}

function sanitizeLocalPhone(value, length) {
  return value.replace(/\D/g, "").replace(/^0+/, "").slice(0, length);
}

function updatePhoneInputRules() {
  const form = $("#authForm");
  const input = form?.phone_number;
  if (!form || !input) return;
  const rule = getSelectedPhoneRule(form);
  input.placeholder = rule.placeholder;
  input.maxLength = rule.length;
  input.value = sanitizeLocalPhone(input.value, rule.length);
}

function buildPhone(form) {
  const rawNumber = (form.phone_number?.value || form.phone?.value || "").trim();
  const rule = getSelectedPhoneRule(form);
  const compact = sanitizeLocalPhone(rawNumber, rule.length);
  return `${form.country_code?.value || "+998"}${compact}`;
}

async function handleAuth(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const rule = getSelectedPhoneRule(form);
  const phoneNumber = sanitizeLocalPhone(form.phone_number?.value || "", rule.length);
  if (form.phone_number && phoneNumber.length !== rule.length) {
    $("#authMessage").textContent = `Введите ${rule.length} цифр номера.`;
    form.phone_number.focus();
    return;
  }
  const payload = {
    phone: buildPhone(form),
    password: form.password.value,
  };
  if (state.authMode === "register") {
    payload.full_name = form.full_name.value.trim();
    payload.password_confirm = form.password_confirm.value;
  }

  try {
    state.profile = await api(state.authMode === "register" ? "/auth/register/" : "/auth/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    localStorage.setItem(STORAGE_KEY, state.profile.id);
    window.location.href = "/web/profile.html";
  } catch (error) {
    $("#authMessage").textContent = error.message;
  }
}

function renderProfile() {
  const logged = Boolean(state.profile);
  const locked = $("#profileLocked");
  const content = $("#profileContent");
  const loginButton = $("#profileLoginButton");
  const logoutButton = $("#logoutButton");
  if (locked) locked.hidden = logged;
  if (content) content.hidden = !logged;
  if (loginButton) loginButton.hidden = logged;
  if (logoutButton) logoutButton.hidden = !logged;
  if (!logged) return;

  $("#profileName").textContent = state.profile.full_name || "Участник Samarkand Fest";
  $("#profilePhone").textContent = state.profile.phone || "";
  const profilePhoto = $("#profilePhoto");
  const profileFallback = $("#profileAvatarFallback");
  const photo = mediaUrl(state.profile.photo);
  if (profilePhoto) {
    profilePhoto.hidden = !photo;
    if (photo) profilePhoto.src = photo;
    else profilePhoto.removeAttribute("src");
  }
  if (profileFallback) {
    profileFallback.hidden = Boolean(photo);
    profileFallback.textContent = getInitial(state.profile.full_name);
  }
  const profileMeta = $("#profileMeta");
  if (profileMeta) {
    const details = [state.profile.city, state.profile.telegram].filter(Boolean);
    profileMeta.textContent = details.join(" · ");
    profileMeta.hidden = !details.length;
  }

  const profileForm = $("#profileEditForm");
  if (profileForm) {
    setProfileEditVisible(false);
    profileForm.full_name.value = state.profile.full_name || "";
    profileForm.phone.value = state.profile.phone || "";
    profileForm.telegram.value = state.profile.telegram || "";
    profileForm.city.value = state.profile.city || "";
  }
  renderGarage();
  renderApplications();
}

function setProfileEditVisible(visible) {
  const form = $("#profileEditForm");
  const text = $("#profileEditToggleText");
  if (form) form.hidden = !visible;
  if (text) text.textContent = visible ? "Скрыть поля" : "Изменить данные";
}

function toggleProfileEdit() {
  const form = $("#profileEditForm");
  setProfileEditVisible(Boolean(form?.hidden));
}

function renderGarage() {
  const box = $("#garagePreview");
  if (!box) return;
  const cars = state.profile?.cars || [];
  if (!cars.length) {
    box.innerHTML = `<div class="empty-card"><p>Гараж пуст. Добавь первое авто для участия.</p></div>`;
    return;
  }
  box.innerHTML = cars.map((car) => carCard(car)).join("");
  hydrateIcons(box);
}

function carCard(car) {
  const image = mediaUrl(car.main_photo || car.photos?.[0]?.image) || fallbackImage();
  const used = carHasApplications(car.id);
  return `
    <article class="garage-card">
      <img src="${image}" alt="${car.make} ${car.model}">
      <div class="garage-card-body">
        <h3>${car.make} ${car.model}</h3>
        <p>${car.year} · ${car.engine}</p>
        <small>${car.tuning_details || car.condition || "Готов к фестивалю"}</small>
        <button class="icon-delete-button car-delete-button" type="button" data-car-id="${car.id}" data-car-used="${used ? "true" : "false"}" aria-label="Удалить авто" title="Удалить авто">
          <span class="icon" data-icon="trash"></span>
        </button>
      </div>
    </article>
  `;
}

function carHasApplications(carId) {
  return state.applications.some((application) =>
    (application.cars_detail || []).some((car) => Number(car.id) === Number(carId))
  );
}

function renderApplications() {
  const list = $("#applicationsList");
  if (!list) return;
  if (!state.applications.length) {
    list.innerHTML = `<p class="muted">Заявок пока нет.</p>`;
    return;
  }
  const labels = {
    new: "В ожидании",
    reviewing: "На рассмотрении",
    approved: "Одобрена",
    rejected: "Отказ",
  };
  list.innerHTML = state.applications.map((application) => `
    <article class="application-item application-${application.status}">
      <div class="application-item-head">
        <strong><span class="status-dot"></span>${labels[application.status] || escapeText(application.status)}</strong>
        <span class="application-code">${ticketApplicationId(application)}</span>
      </div>
      <p>${application.cars_detail?.map((car) => `${escapeText(car.make)} ${escapeText(car.model)}`).join(", ") || "Авто не указано"}</p>
      ${application.moderator_note ? `<small>${escapeText(application.moderator_note)}</small>` : ""}
      ${application.status === "approved" ? `
        <div class="application-actions">
          <button class="primary-button ticket-open-button" type="button" data-ticket-id="${application.id}">
            <span class="icon" data-icon="ticket"></span>
            <span>Открыть билет</span>
          </button>
        </div>
      ` : ""}
    </article>
  `).join("");
  hydrateIcons(list);
}

function applicationStatus(application) {
  return applicationStatusMeta[application.status] || { label: application.status || "В ожидании", group: "pending" };
}

function formatAdminDate(value) {
  if (!value) return "Дата не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function applicationPhoto(application) {
  const appPhoto = application.photos?.[0]?.image;
  const car = application.cars_detail?.[0];
  const carPhoto = car?.main_photo || car?.photos?.[0]?.image;
  return mediaUrl(appPhoto || carPhoto) || fallbackImage();
}

function ticketApplicationId(application) {
  return `SF-${String(application?.id || 0).padStart(5, "0")}`;
}

function applicationFestival(application) {
  return state.festivals.find((festival) => Number(festival.id) === Number(application?.festival)) || state.selectedFestival || state.festivals[0] || {};
}

function applicationCarsText(application) {
  return application?.cars_detail?.length
    ? application.cars_detail.map((car) => `${car.make || ""} ${car.model || ""}`.trim()).join(", ")
    : "Автомобиль не указан";
}

function ticketStatusLabel(application) {
  const labels = {
    new: "В ожидании",
    reviewing: "На рассмотрении",
    approved: "Одобрена",
    rejected: "Отказ",
  };
  return labels[application?.status] || application?.status || "В ожидании";
}

function applicationOwnerName() {
  return state.profile?.full_name || state.profile?.phone || "Участник фестиваля";
}

function ticketMarkup(application) {
  const festival = applicationFestival(application);
  const place = festival.location || festival.city || "Samarkand Touristic Centre";
  const date = festival.start_date ? formatDate(festival.start_date) : "Дата уточняется";
  const code = ticketApplicationId(application);
  const status = ticketStatusLabel(application);
  const owner = applicationOwnerName();
  const phone = state.profile?.phone || "Телефон не указан";
  const cars = applicationCarsText(application);
  return `
    <article class="festival-ticket">
      <div class="ticket-watermark">SAMARKAND FEST</div>
      <header class="ticket-header">
        <div class="ticket-brand">
          <img src="/web/assets/logo_2.png" alt="" />
          <div>
            <strong>Samarkand Fest</strong>
            <span>Automotive Festival</span>
          </div>
        </div>
        <div class="ticket-status">
          <span class="status-dot"></span>
          <strong>${escapeText(status)}</strong>
        </div>
      </header>

      <section class="ticket-main">
        <div>
          <span class="ticket-label">Билет участника</span>
          <h2>${escapeText(festival.title || "Samarkand Fest")}</h2>
          <p>Заявка одобрена администратором. Этот билет можно сохранить в PDF и показать при регистрации на площадке.</p>
        </div>
        <div class="ticket-code-box">
          <small>ID заявки</small>
          <strong>${escapeText(code)}</strong>
        </div>
      </section>

      <section class="ticket-grid">
        <div class="ticket-field">
          <small>Участник</small>
          <strong>${escapeText(owner)}</strong>
        </div>
        <div class="ticket-field">
          <small>Телефон</small>
          <strong>${escapeText(phone)}</strong>
        </div>
        <div class="ticket-field">
          <small>Автомобиль</small>
          <strong>${escapeText(cars)}</strong>
        </div>
        <div class="ticket-field">
          <small>Дата</small>
          <strong>${escapeText(date)}</strong>
        </div>
        <div class="ticket-field ticket-field-wide">
          <small>Площадка</small>
          <strong>${escapeText(place)}</strong>
        </div>
        <div class="ticket-field">
          <small>Контрольный код</small>
          <strong>${escapeText(code)}-${String(application?.participant || state.profile?.id || 0).padStart(4, "0")}</strong>
        </div>
      </section>

      <footer class="ticket-footer">
        <span>Действителен только для указанной заявки и автомобиля.</span>
        <span>${escapeText(new Date().toLocaleDateString("ru-RU"))}</span>
      </footer>
    </article>
  `;
}

function ticketPrintDocument(application) {
  const title = `${ticketApplicationId(application)} - Samarkand Fest`;
  return `<!doctype html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeText(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 28px; background: #f3f4f6; color: #111317; font-family: Arial, sans-serif; }
          .festival-ticket { position: relative; overflow: hidden; width: min(980px, 100%); margin: 0 auto; padding: 30px; border: 1px solid #e4e6eb; border-radius: 14px; background: #fff; box-shadow: 0 18px 50px rgba(15, 18, 25, .12); }
          .ticket-watermark { position: absolute; right: -30px; bottom: 18px; color: rgba(230, 0, 35, .06); font-size: 68px; font-weight: 900; letter-spacing: 3px; transform: rotate(-8deg); }
          .ticket-header, .ticket-main, .ticket-grid, .ticket-footer { position: relative; z-index: 1; }
          .ticket-header, .ticket-main, .ticket-footer, .ticket-brand, .ticket-status { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
          .ticket-brand img { width: 78px; height: 78px; object-fit: contain; }
          .ticket-brand strong { display: block; font-size: 25px; }
          .ticket-brand span, .ticket-label, .ticket-field small, .ticket-code-box small, .ticket-footer { color: #6b7280; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; }
          .ticket-status { padding: 10px 12px; border-radius: 999px; background: #ecfdf3; color: #15803d; }
          .status-dot { width: 11px; height: 11px; border-radius: 50%; background: #16a34a; box-shadow: 0 0 0 4px rgba(22, 163, 74, .15); }
          .ticket-main { margin: 28px 0; padding: 24px; border: 1px solid #f0c8ce; border-radius: 12px; background: linear-gradient(135deg, #fff5f6, #fff); }
          .ticket-main h2 { margin: 8px 0 10px; font-size: 36px; }
          .ticket-main p { max-width: 580px; margin: 0; color: #464c57; line-height: 1.55; }
          .ticket-code-box { min-width: 190px; padding: 18px; border-radius: 12px; background: #111317; color: #fff; text-align: center; }
          .ticket-code-box strong { display: block; margin-top: 6px; font-size: 28px; letter-spacing: .08em; }
          .ticket-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .ticket-field { padding: 16px; border: 1px solid #e4e6eb; border-radius: 10px; background: #fff; }
          .ticket-field-wide { grid-column: span 2; }
          .ticket-field strong { display: block; margin-top: 7px; font-size: 18px; }
          .ticket-footer { margin-top: 22px; padding-top: 14px; border-top: 1px dashed #cfd3dc; }
          @media print { body { padding: 0; background: #fff; } .festival-ticket { width: 100%; box-shadow: none; border-radius: 0; } }
          @media (max-width: 680px) { body { padding: 12px; } .ticket-header, .ticket-main, .ticket-footer { align-items: flex-start; flex-direction: column; } .ticket-grid { grid-template-columns: 1fr; } .ticket-field-wide { grid-column: auto; } }
        </style>
      </head>
      <body>${ticketMarkup(application)}</body>
    </html>`;
}

function openTicket(application) {
  state.selectedTicketApplication = application;
  const preview = $("#ticketPreview");
  const modal = $("#ticketModal");
  if (!preview || !modal) return;
  preview.innerHTML = ticketMarkup(application);
  modal.hidden = false;
  hydrateIcons(preview);
}

function closeTicketModal() {
  const modal = $("#ticketModal");
  if (modal) modal.hidden = true;
}

function handleTicketClick(event) {
  const button = event.target.closest("[data-ticket-id]");
  if (!button) return;
  const application = state.applications.find((item) => Number(item.id) === Number(button.dataset.ticketId));
  if (!application) return;
  openTicket(application);
}

function printTicket() {
  const application = state.selectedTicketApplication;
  if (!application) return;
  const popup = window.open("", "_blank", "width=1100,height=900");
  if (!popup) {
    toast("Разреши всплывающее окно, чтобы скачать билет в PDF.");
    return;
  }
  popup.document.open();
  popup.document.write(ticketPrintDocument(application));
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 350);
}

async function loadAdminApplications() {
  const params = new URLSearchParams();
  if (state.adminSearch.trim()) params.set("search", state.adminSearch.trim());
  if (state.adminFilter !== "all") {
    params.set("status", state.adminFilter === "approved" ? "approved" : state.adminFilter === "rejected" ? "rejected" : "pending");
  }
  const query = params.toString() ? `?${params}` : "";
  const payload = await adminApi(`/admin/applications/${query}`);
  state.adminApplications = Array.isArray(payload) ? payload : payload.results || [];
}

function renderAdminSummary() {
  const applications = state.adminApplications;
  const counts = applications.reduce((acc, application) => {
    const group = applicationStatus(application).group;
    acc.total += 1;
    acc[group] += 1;
    return acc;
  }, { total: 0, pending: 0, approved: 0, rejected: 0 });
  $("#adminTotal").textContent = counts.total;
  $("#adminPending").textContent = counts.pending;
  $("#adminApproved").textContent = counts.approved;
  $("#adminRejected").textContent = counts.rejected;
}

function filteredAdminApplications() {
  const query = state.adminSearch.trim().toLowerCase();
  return state.adminApplications.filter((application) => {
    const group = applicationStatus(application).group;
    const matchesFilter = state.adminFilter === "all" || group === state.adminFilter;
    const text = [
      application.participant_name,
      application.phone,
      application.telegram,
      application.city,
      application.car_make,
      application.car_model,
      application.car_year,
      application.engine,
    ].filter(Boolean).join(" ").toLowerCase();
    return matchesFilter && (!query || text.includes(query));
  });
}

function renderAdminApplications() {
  const list = $("#adminApplications");
  if (!list) return;
  renderAdminSummary();
  const applications = filteredAdminApplications();
  if (!applications.length) {
    list.innerHTML = `
      <article class="empty-card">
        <span class="icon-badge" data-icon="ticket"></span>
        <p>По выбранному фильтру заявок нет.</p>
      </article>
    `;
    hydrateIcons(list);
    return;
  }
  list.innerHTML = applications.map((application) => {
    const status = applicationStatus(application);
    const cars = application.cars_detail?.length
      ? application.cars_detail.map((car) => `${car.make} ${car.model} ${car.year}`).join(", ")
      : `${application.car_make} ${application.car_model} ${application.car_year || ""}`.trim();
    return `
      <article class="admin-application application-${application.status}" data-application-id="${application.id}">
        <img src="${applicationPhoto(application)}" alt="${application.car_make || "Авто"}" />
        <div class="admin-application-body">
          <div class="admin-card-head">
            <div>
              <span class="admin-status status-${status.group}"><span class="status-dot"></span>${status.label}</span>
              <h3>${application.participant_name || "Без имени"}</h3>
            </div>
            <small>${formatAdminDate(application.created_at)}</small>
          </div>
          <div class="admin-meta-grid">
            <span><b>Телефон</b>${application.phone || "Не указан"}</span>
            <span><b>Telegram</b>${application.telegram || "Не указан"}</span>
            <span><b>Город</b>${application.city || "Не указан"}</span>
            <span><b>Авто</b>${cars || "Не указано"}</span>
          </div>
          <div class="admin-car-details">
            <p><b>Двигатель:</b> ${application.engine || "Не указан"}</p>
            <p><b>Состояние:</b> ${application.condition || "Не указано"}</p>
            ${application.tuning_details ? `<p><b>Тюнинг:</b> ${application.tuning_details}</p>` : ""}
            ${application.moderator_note ? `<p><b>Комментарий модератора:</b> ${application.moderator_note}</p>` : ""}
          </div>
          <div class="admin-card-actions">
            <button class="glass-button" type="button" data-admin-detail="${application.id}">Детально</button>
            <button class="primary-button" type="button" data-admin-status="approved" data-application-id="${application.id}">Принять</button>
            <button class="glass-button danger-button" type="button" data-admin-status="rejected" data-application-id="${application.id}">Отказать</button>
            <button class="glass-button" type="button" data-admin-status="reviewing" data-application-id="${application.id}">В ожидание</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
  hydrateIcons(list);
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#adminLoginMessage");
  const payload = Object.fromEntries(new FormData(form).entries());
  if (message) message.textContent = "";
  try {
    const data = await api("/admin/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.adminToken = data.token;
    localStorage.setItem(ADMIN_STORAGE_KEY, data.token);
    toast("Вход администратора выполнен");
    await renderAdminPage();
  } catch (error) {
    if (message) message.textContent = error.message;
  }
}

async function updateAdminApplicationStatus(applicationId, statusValue) {
  const application = await adminApi(`/admin/applications/${applicationId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: statusValue }),
  });
  const index = state.adminApplications.findIndex((item) => Number(item.id) === Number(applicationId));
  if (index >= 0) state.adminApplications[index] = application;
  renderAdminApplications();
  if (state.selectedAdminApplication?.id === application.id) {
    state.selectedAdminApplication = application;
    renderAdminDetail(application);
  }
  toast("Статус заявки обновлен");
}

function profileCars(application) {
  return application.participant_detail?.cars || [];
}

function carImage(car) {
  return mediaUrl(car.main_photo || car.photos?.[0]?.image) || fallbackImage();
}

function renderProfileCars(cars, selectedCars = []) {
  const selectedIds = new Set(selectedCars.map((car) => Number(car.id)));
  if (!cars.length) return `<p class="muted">В профиле пока нет добавленных машин.</p>`;
  return `
    <div class="admin-profile-cars">
      ${cars.map((car) => {
        const isSelected = selectedIds.has(Number(car.id));
        return `
        <article class="${isSelected ? "is-application-car" : ""}">
          <img src="${carImage(car)}" alt="${car.make || "Авто"}" />
          <div>
            <strong>${isSelected ? `<span class="application-car-dot" title="РњР°С€РёРЅР° СѓС‡Р°СЃС‚РІСѓРµС‚ РІ СЌС‚РѕР№ Р·Р°СЏРІРєРµ"></span>` : ""}${car.make} ${car.model} ${car.year || ""}</strong>
            <small>${car.engine || "Мотор не указан"}</small>
            <p>${car.condition || "Состояние не указано"}</p>
            ${car.tuning_details ? `<p>${car.tuning_details}</p>` : ""}
          </div>
        </article>
      `;
      }).join("")}
    </div>
  `;
}

function renderAdminDetail(application) {
  const modal = $("#adminDetailModal");
  const content = $("#adminDetailContent");
  if (!modal || !content) return;
  const status = applicationStatus(application);
  const profile = application.participant_detail;
  $("#adminDetailTitle").textContent = application.participant_name || "Заявка";
  $("#adminDetailSubtitle").textContent = `${application.car_make} ${application.car_model} ${application.car_year || ""} • ${status.label}`;
  content.innerHTML = `
    <div class="admin-detail-shell">
      <aside class="admin-detail-media">
        <img class="admin-detail-photo" src="${applicationPhoto(application)}" alt="${application.car_make || "Авто"}" />
        <div class="admin-card-actions admin-detail-actions">
          <button class="primary-button" type="button" data-admin-status="approved" data-application-id="${application.id}">Принять</button>
          <button class="glass-button danger-button" type="button" data-admin-status="rejected" data-application-id="${application.id}">Отказать</button>
          <button class="glass-button" type="button" data-admin-status="reviewing" data-application-id="${application.id}">В ожидание</button>
        </div>
      </aside>
      <section class="admin-detail-main">
        <div class="admin-detail-summary">
          <span class="admin-status status-${status.group}"><span class="status-dot"></span>${status.label}</span>
          <h2>${application.car_make} ${application.car_model}</h2>
          <p>${application.participant_name || "Без имени"} • ${formatAdminDate(application.created_at)}</p>
        </div>
        <div class="admin-detail-columns">
          <section class="admin-detail-block">
            <h3>Участник</h3>
            <div class="admin-meta-list">
              <span><b>Имя</b>${application.participant_name || "Не указано"}</span>
              <span><b>Телефон</b>${application.phone || "Не указан"}</span>
              <span><b>Telegram</b>${application.telegram || "Не указан"}</span>
              <span><b>Город</b>${application.city || "Не указан"}</span>
            </div>
          </section>
          <section class="admin-detail-block">
            <h3>Авто из заявки</h3>
            <div class="admin-meta-list">
              <span><b>Машина</b>${application.car_make} ${application.car_model} ${application.car_year || ""}</span>
              <span><b>Двигатель</b>${application.engine || "Не указан"}</span>
              <span><b>Состояние</b>${application.condition || "Не указано"}</span>
              ${application.tuning_details ? `<span><b>Тюнинг</b>${application.tuning_details}</span>` : ""}
            </div>
          </section>
        </div>
        <section class="admin-detail-block">
          <h3>Все машины в профиле</h3>
          ${renderProfileCars(profileCars(application), application.cars_detail || [])}
        </section>
        <form class="admin-password-form" id="adminPasswordForm" data-profile-id="${profile?.id || ""}">
          <h3>Сменить пароль пользователя</h3>
          <div class="form-grid">
            <input name="password" type="password" placeholder="Новый пароль" minlength="6" required />
            <button class="glass-button" type="submit">Сохранить пароль</button>
          </div>
          <p class="form-message" id="adminPasswordMessage"></p>
        </form>
      </div>
    </div>
  `;
  modal.hidden = false;
  hydrateIcons(content);
}

async function openAdminDetail(applicationId) {
  try {
    const application = await adminApi(`/admin/applications/${applicationId}/`);
    state.selectedAdminApplication = application;
    renderAdminDetail(application);
  } catch (error) {
    toast(error.message);
  }
}

function closeAdminDetail() {
  $("#adminDetailModal").hidden = true;
  state.selectedAdminApplication = null;
}

async function handleAdminApplicationClick(event) {
  const detailButton = event.target.closest("[data-admin-detail]");
  const statusButton = event.target.closest("[data-admin-status]");
  if (detailButton) {
    await openAdminDetail(detailButton.dataset.adminDetail);
    return;
  }
  if (statusButton) {
    await updateAdminApplicationStatus(statusButton.dataset.applicationId, statusButton.dataset.adminStatus);
  }
}

async function handleAdminPasswordChange(event) {
  const form = event.target.closest("#adminPasswordForm");
  if (!form) return;
  event.preventDefault();
  const profileId = form.dataset.profileId;
  const message = $("#adminPasswordMessage");
  if (!profileId) {
    if (message) message.textContent = "Профиль пользователя не найден.";
    return;
  }
  const password = new FormData(form).get("password");
  try {
    await adminApi(`/admin/profiles/${profileId}/password/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    form.reset();
    if (message) message.textContent = "Пароль изменен.";
    toast("Пароль пользователя изменен");
  } catch (error) {
    if (message) message.textContent = error.message;
  }
}

async function renderAdminPage() {
  $("#adminLoginForm")?.toggleAttribute("hidden", Boolean(state.adminToken));
  $("#adminPanel")?.toggleAttribute("hidden", !state.adminToken);
  if (!state.adminToken) return;
  try {
    await loadAdminApplications();
    renderAdminApplications();
  } catch (error) {
    const needsLogin = error.status === 401 || error.status === 403 || /Нужен вход|администратор|admin/i.test(error.message);
    if (needsLogin) {
      state.adminToken = "";
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      $("#adminLoginForm")?.removeAttribute("hidden");
      $("#adminPanel")?.setAttribute("hidden", "");
      const message = $("#adminLoginMessage");
      if (message) message.textContent = "Нужен вход администратора. Введите логин и пароль.";
      toast("Нужен вход администратора");
      return;
    }
    const list = $("#adminApplications");
    if (list) {
      list.innerHTML = `
        <article class="empty-card">
          <span class="icon-badge" data-icon="shield"></span>
          <p>Не удалось загрузить заявки: ${error.message}</p>
        </article>
      `;
      hydrateIcons(list);
    }
  }
}

async function handleProfileEdit(event) {
  event.preventDefault();
  if (!state.profile) return;
  const form = event.currentTarget;
  try {
    state.profile = await api(`/profiles/${state.profile.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: form.full_name.value.trim(),
        phone: form.phone.value.trim(),
        telegram: form.telegram.value.trim(),
        city: form.city.value.trim(),
      }),
    });
    renderProfile();
    setProfileEditVisible(false);
    toast("Профиль сохранен");
  } catch (error) {
    toast(error.message);
  }
}

async function handleCarDelete(event) {
  const button = event.target.closest(".car-delete-button");
  if (!button || !state.profile) return;
  const carId = Number(button.dataset.carId);
  const used = button.dataset.carUsed === "true";
  const message = used
    ? "Этот автомобиль уже участвует в заявке. При удалении автомобиля заявка тоже удалится, и тебе нужно будет заполнить ее заново. Удалить?"
    : "Удалить этот автомобиль из гаража?";
  if (!window.confirm(message)) return;

  try {
    await api(`/cars/${carId}/`, { method: "DELETE" });
    state.profile = await api(`/profiles/${state.profile.id}/`);
    await loadApplications();
    renderProfile();
    toast(used ? "Авто и связанные заявки удалены" : "Авто удалено");
  } catch (error) {
    toast(error.message);
  }
}

function openAvatarModal() {
  if (!state.profile) return;
  if (state.avatar.url?.startsWith("blob:")) URL.revokeObjectURL(state.avatar.url);
  state.avatar.file = null;
  $("#avatarModal").hidden = false;
  const current = mediaUrl(state.profile.photo);
  if (current) setAvatarSource(current);
  else clearAvatarSource();
}

function closeAvatarModal() {
  $("#avatarModal").hidden = true;
}

function clearAvatarSource() {
  const image = $("#avatarCropImage");
  state.avatar.url = "";
  state.avatar.scale = 1;
  state.avatar.offsetX = 0;
  state.avatar.offsetY = 0;
  state.avatar.imageWidth = 0;
  state.avatar.imageHeight = 0;
  $("#avatarZoom").value = "1";
  if (image) {
    image.removeAttribute("src");
    image.removeAttribute("style");
  }
}

function setAvatarSource(url) {
  const image = $("#avatarCropImage");
  state.avatar.url = url;
  state.avatar.scale = 1;
  state.avatar.offsetX = 0;
  state.avatar.offsetY = 0;
  state.avatar.imageWidth = 0;
  state.avatar.imageHeight = 0;
  $("#avatarZoom").value = "1";
  image.onload = fitAvatarImage;
  image.src = url;
  if (image.complete) fitAvatarImage();
}

function fitAvatarImage() {
  const cropper = $("#avatarCropper");
  const image = $("#avatarCropImage");
  if (!cropper || !image?.naturalWidth || !image.naturalHeight) return;
  const rect = cropper.getBoundingClientRect();
  const imgRatio = image.naturalWidth / image.naturalHeight;
  const boxRatio = rect.width / rect.height;
  if (imgRatio > boxRatio) {
    state.avatar.imageWidth = rect.width;
    state.avatar.imageHeight = rect.width / imgRatio;
  } else {
    state.avatar.imageHeight = rect.height;
    state.avatar.imageWidth = rect.height * imgRatio;
  }
  image.style.width = `${state.avatar.imageWidth}px`;
  image.style.height = `${state.avatar.imageHeight}px`;
  updateAvatarTransform();
}

function updateAvatarTransform() {
  const image = $("#avatarCropImage");
  if (!image) return;
  image.style.transform = `translate(calc(-50% + ${state.avatar.offsetX}px), calc(-50% + ${state.avatar.offsetY}px)) scale(${state.avatar.scale})`;
}

function handleAvatarFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (state.avatar.url?.startsWith("blob:")) URL.revokeObjectURL(state.avatar.url);
  state.avatar.file = file;
  setAvatarSource(URL.createObjectURL(file));
}

function startAvatarDrag(event) {
  if (!$("#avatarCropImage")?.src) return;
  state.avatar.dragging = true;
  const point = getPointerPoint(event);
  state.avatar.startX = point.x;
  state.avatar.startY = point.y;
  state.avatar.baseX = state.avatar.offsetX;
  state.avatar.baseY = state.avatar.offsetY;
  event.preventDefault();
}

function moveAvatarDrag(event) {
  if (!state.avatar.dragging) return;
  const point = getPointerPoint(event);
  state.avatar.offsetX = state.avatar.baseX + point.x - state.avatar.startX;
  state.avatar.offsetY = state.avatar.baseY + point.y - state.avatar.startY;
  updateAvatarTransform();
}

function endAvatarDrag() {
  state.avatar.dragging = false;
}

function getPointerPoint(event) {
  const touch = event.touches?.[0] || event.changedTouches?.[0];
  return {
    x: touch ? touch.clientX : event.clientX,
    y: touch ? touch.clientY : event.clientY,
  };
}

async function saveAvatar() {
  if (!state.profile) return;
  if (!state.avatar.file) {
    toast("Выбери новое фото для аватарки");
    return;
  }
  const cropper = $("#avatarCropper");
  const image = $("#avatarCropImage");
  if (!cropper || !image?.complete) return;

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const rect = cropper.getBoundingClientRect();
  if (!state.avatar.imageWidth || !state.avatar.imageHeight) fitAvatarImage();
  const baseWidth = state.avatar.imageWidth;
  const baseHeight = state.avatar.imageHeight;
  const drawWidth = baseWidth * state.avatar.scale;
  const drawHeight = baseHeight * state.avatar.scale;
  const drawX = (rect.width - drawWidth) / 2 + state.avatar.offsetX;
  const drawY = (rect.height - drawHeight) / 2 + state.avatar.offsetY;
  const factor = size / rect.width;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, drawX * factor, drawY * factor, drawWidth * factor, drawHeight * factor);

  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const body = new FormData();
    body.append("photo", blob, "avatar.jpg");
    try {
      state.profile = await api(`/profiles/${state.profile.id}/`, { method: "PATCH", body });
      renderProfile();
      closeAvatarModal();
      toast("Фото профиля обновлено");
    } catch (error) {
      toast(error.message);
    }
  }, "image/jpeg", 0.92);
}

async function removeAvatar() {
  if (!state.profile || !window.confirm("Удалить фото профиля?")) return;
  const body = new FormData();
  body.append("remove_photo", "true");
  try {
    state.profile = await api(`/profiles/${state.profile.id}/`, { method: "PATCH", body });
    renderProfile();
    closeAvatarModal();
    toast("Фото профиля удалено");
  } catch (error) {
    toast(error.message);
  }
}

async function handleCarCreate(event) {
  event.preventDefault();
  if (!state.profile) return;
  const form = event.currentTarget;
  const files = Array.from(form.uploaded_photos.files || []);
  if (!files.length) {
    $("#carMessage").textContent = "Добавьте хотя бы одно фото автомобиля.";
    form.uploaded_photos.focus();
    return;
  }
  const body = new FormData();
  body.append("owner", state.profile.id);
  ["make", "model", "year", "engine", "condition", "tuning_details"].forEach((name) => {
    body.append(name, form[name].value);
  });
  files.slice(0, 5).forEach((file) => {
    body.append("uploaded_photos", file, file.name);
  });

  try {
    await api("/cars/", { method: "POST", body });
    state.profile = await api(`/profiles/${state.profile.id}/`);
    form.reset();
    renderProfile();
    $("#carMessage").textContent = "Авто добавлено.";
  } catch (error) {
    $("#carMessage").textContent = error.message;
  }
}

async function handleApply(event) {
  event.preventDefault();
  if (!state.profile) {
    $("#applyMessage").textContent = "Сначала войди в профиль.";
    return;
  }
  if (!state.selectedFestival) return;
  const selected = [...state.selectedCars];
  if (!selected.length) {
    $("#applyMessage").textContent = "Выбери хотя бы одно авто.";
    return;
  }

  const firstCar = state.profile.cars.find((car) => car.id === selected[0]);
  const payload = {
    festival: state.selectedFestival.id,
    participant: state.profile.id,
    cars: selected,
    participant_name: state.profile.full_name,
    phone: state.profile.phone,
    telegram: state.profile.telegram || "",
    city: state.profile.city || "",
    car_make: firstCar.make,
    car_model: firstCar.model,
    car_year: firstCar.year,
    engine: firstCar.engine,
    condition: firstCar.condition,
    tuning_details: firstCar.tuning_details || "",
  };

  try {
    await api("/applications/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadApplications();
    $("#applyMessage").textContent = "Заявка отправлена.";
    toast("Заявка отправлена на модерацию");
  } catch (error) {
    $("#applyMessage").textContent = error.message;
  }
}

function logout() {
  state.profile = null;
  state.applications = [];
  localStorage.removeItem(STORAGE_KEY);
  renderProfile();
  toast("Ты вышел из профиля");
}

function bindEvents() {
  $("#festival .hero-carousel")?.addEventListener("touchstart", (event) => {
    state.touchStartX = event.touches[0]?.clientX || 0;
  }, { passive: true });
  $("#festival .hero-carousel")?.addEventListener("touchend", (event) => {
    const endX = event.changedTouches[0]?.clientX || 0;
    const diff = endX - state.touchStartX;
    if (Math.abs(diff) > 42) moveHeroSlide(diff > 0 ? -1 : 1);
  }, { passive: true });
  $("#authForm")?.addEventListener("submit", handleAuth);
  $("#authForm [name='country_code']")?.addEventListener("change", updatePhoneInputRules);
  $("#authForm [name='phone_number']")?.addEventListener("input", updatePhoneInputRules);
  $("#profileEditToggle")?.addEventListener("click", toggleProfileEdit);
  $("#profileEditForm")?.addEventListener("submit", handleProfileEdit);
  $("#carForm")?.addEventListener("submit", handleCarCreate);
  $("#garagePreview")?.addEventListener("click", handleCarDelete);
  $("#applicationsList")?.addEventListener("click", handleTicketClick);
  $("#applyForm")?.addEventListener("submit", handleApply);
  $("#commentForm")?.addEventListener("submit", handleCommentCreate);
  $("#commentsBox")?.addEventListener("click", handleCommentDelete);
  $("#logoutButton")?.addEventListener("click", logout);
  $("#adminLoginForm")?.addEventListener("submit", handleAdminLogin);
  $("#adminSearch")?.addEventListener("input", (event) => {
    state.adminSearch = event.target.value;
    renderAdminApplications();
  });
  $("#adminFilters")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-admin-filter]");
    if (!button) return;
    state.adminFilter = button.dataset.adminFilter;
    $$("#adminFilters button").forEach((node) => node.classList.toggle("active", node === button));
    renderAdminApplications();
  });
  $("#adminApplications")?.addEventListener("click", handleAdminApplicationClick);
  $("#adminDetailContent")?.addEventListener("click", handleAdminApplicationClick);
  $("#adminDetailContent")?.addEventListener("submit", handleAdminPasswordChange);
  $("#adminDetailClose")?.addEventListener("click", closeAdminDetail);
  $("#avatarEditButton")?.addEventListener("click", openAvatarModal);
  $("#avatarModalClose")?.addEventListener("click", closeAvatarModal);
  $("#ticketModalClose")?.addEventListener("click", closeTicketModal);
  $("#ticketPrintButton")?.addEventListener("click", printTicket);
  $("#avatarPickButton")?.addEventListener("click", () => $("#avatarFileInput")?.click());
  $("#avatarFileInput")?.addEventListener("change", handleAvatarFile);
  $("#avatarZoom")?.addEventListener("input", (event) => {
    state.avatar.scale = Number(event.target.value);
    updateAvatarTransform();
  });
  $("#avatarCropper")?.addEventListener("mousedown", startAvatarDrag);
  $("#avatarCropper")?.addEventListener("mousemove", moveAvatarDrag);
  window.addEventListener("mouseup", endAvatarDrag);
  $("#avatarCropper")?.addEventListener("touchstart", startAvatarDrag, { passive: false });
  $("#avatarCropper")?.addEventListener("touchmove", moveAvatarDrag, { passive: false });
  window.addEventListener("touchend", endAvatarDrag);
  window.addEventListener("resize", () => {
    if (!$("#avatarModal")?.hidden) fitAvatarImage();
  });
  $("#avatarSaveButton")?.addEventListener("click", saveAvatar);
  $("#avatarRemoveButton")?.addEventListener("click", removeAvatar);
  $$("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
  });

  document.addEventListener("pointermove", (event) => {
    $$(".magnetic").forEach((node) => {
      const rect = node.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      const distance = Math.hypot(x, y);
      node.style.transform = distance < 140 ? `translate(${x * 0.05}px, ${y * 0.05}px)` : "";
    });
  });
}

async function boot() {
  hydrateIcons();
  bindEvents();
  setAuthMode("login");
  await loadSettings();
  await loadProfileFromStorage();
  renderSessionNav();

  if (page === "home") {
    try {
      await loadFestivals();
      renderFestivalDetail();
      setInterval(updateDetailCountdown, 1000);
      setInterval(() => moveHeroSlide(1), 5500);
    } catch (error) {
      toast(`Не удалось загрузить фестивали: ${error.message}`);
    }
  }

  if (page === "profile") {
    try {
      await loadFestivals();
    } catch (error) {
      console.warn("Festival data is unavailable for tickets", error);
    }
    renderProfile();
  }
  if (page === "admin") renderAdminPage();
}

boot();
