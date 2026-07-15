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
  adminProfiles: [],
  adminSummary: null,
  adminFilter: "all",
  adminPurposeFilter: "all",
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

const carPurposeLabels = {
  avtozvuk: "Автозвук",
  drift: "Дрифт",
  retro: "Ретро",
  milliy: "Миллий",
  tuning: "Тюнинг",
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
    await markProfileSeen();
    await loadApplications();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    state.profile = null;
    state.applications = [];
  }
}

async function markProfileSeen() {
  if (!state.profile?.id) return;
  try {
    state.profile = await api(`/profiles/${state.profile.id}/seen/`, { method: "POST" });
  } catch (error) {
    console.warn("Profile activity heartbeat failed", error);
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
        <small>${[car.year, car.engine, carPurposeLabels[car.purpose]].filter(Boolean).join(" · ")}</small>
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
      ${item.image ? `
        <button class="news-image-button" type="button" data-image-open="${item.image}" data-image-title="${escapeText(item.title)}">
          <img src="${item.image}" alt="${escapeText(item.title)}">
        </button>
      ` : ""}
      <h3>${escapeText(item.title)}</h3>
      <p>${escapeText(item.text)}</p>
    </article>
  `).join("");
}

function handleNewsClick(event) {
  const imageButton = event.target.closest("[data-image-open]");
  if (!imageButton) return;
  openImageViewer(imageButton.dataset.imageOpen, imageButton.dataset.imageTitle || "Новость фестиваля");
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
  renderProfileApply();
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
  const purpose = carPurposeLabels[car.purpose] || "";
  return `
    <article class="garage-card">
      <img src="${image}" alt="${car.make} ${car.model}">
      <div class="garage-card-body">
        <h3>${car.make} ${car.model}</h3>
        <p>${[car.year, car.engine, purpose].filter(Boolean).join(" · ")}</p>
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

function carHasFestivalApplication(carId, festivalId) {
  return state.applications.some((application) =>
    Number(application.festival) === Number(festivalId) &&
    (application.cars_detail || []).some((car) => Number(car.id) === Number(carId))
  );
}

function renderProfileApply() {
  const content = $("#profileApplyContent");
  if (!content) return;
  const cars = state.profile?.cars || [];
  const festivals = state.festivals || [];
  if (!cars.length) {
    content.innerHTML = `
      <div class="empty-card profile-apply-empty">
        <p>Сначала добавь автомобиль в гараж, потом здесь появится быстрая подача заявки.</p>
      </div>
    `;
    return;
  }
  if (!festivals.length) {
    content.innerHTML = `
      <div class="empty-card profile-apply-empty">
        <p>Фестивали пока не загружены. Попробуй обновить страницу чуть позже.</p>
      </div>
    `;
    return;
  }

  const currentSelect = $("#profileFestivalSelect");
  const selectedFestivalId = Number(currentSelect?.value || festivals[0].id);
  content.innerHTML = `
    <label>
      Фестиваль
      <select id="profileFestivalSelect" name="festival" required>
        ${festivals.map((festival) => `
          <option value="${festival.id}" ${Number(festival.id) === selectedFestivalId ? "selected" : ""}>
            ${escapeText(festival.title || `Фестиваль #${festival.id}`)}
          </option>
        `).join("")}
      </select>
    </label>
    <div class="profile-apply-cars">
      ${cars.map((car) => {
        const used = carHasFestivalApplication(car.id, selectedFestivalId);
        return `
          <label class="selectable-car profile-apply-car ${used ? "is-disabled" : ""}">
            <input type="checkbox" name="cars" value="${car.id}" ${used ? "disabled" : ""}>
            <span class="car-check"></span>
            <span>
              <strong>${escapeText(`${car.make} ${car.model}`.trim())}</strong>
              <small>${used ? "Уже есть заявка на этот фестиваль" : escapeText([car.year, car.engine, carPurposeLabels[car.purpose]].filter(Boolean).join(" · "))}</small>
            </span>
          </label>
        `;
      }).join("")}
    </div>
    <button class="primary-button" type="submit">
      <span class="icon" data-icon="send"></span>
      <span>Отправить заявку</span>
    </button>
  `;
  $("#profileFestivalSelect")?.addEventListener("change", () => {
    $("#profileApplyMessage").textContent = "";
    renderProfileApply();
  });
  hydrateIcons(content);
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
  list.innerHTML = state.applications.map((application) => {
    const moderatorNote = moderatorNoteText(application.moderator_note);
    return `
      <article class="application-item application-${application.status}">
        <div class="application-item-head">
          <strong><span class="status-dot"></span>${labels[application.status] || escapeText(application.status)}</strong>
          <span class="application-code">${ticketApplicationId(application)}</span>
        </div>
        <p>${application.cars_detail?.map((car) => `${escapeText(car.make)} ${escapeText(car.model)}`).join(", ") || "Авто не указано"}</p>
        ${moderatorNote ? `<small>${escapeText(moderatorNote)}</small>` : ""}
        ${application.status === "approved" ? `
          <div class="application-actions">
            <button class="primary-button ticket-open-button" type="button" data-ticket-id="${application.id}">
              <span class="icon" data-icon="ticket"></span>
              <span>Открыть билет</span>
            </button>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");
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

function formatLastSeen(value) {
  if (!value) return "Еще не заходил";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "сейчас онлайн";
  if (minutes < 60) return `${minutes} мин. назад`;
  return formatAdminDate(value);
}

function applicationPhoto(application) {
  const appPhoto = application.photos?.[0]?.image;
  const car = application.cars_detail?.[0];
  const carPhoto = car?.main_photo || car?.photos?.[0]?.image;
  return mediaUrl(appPhoto || carPhoto) || fallbackImage();
}

function applicationGallery(application) {
  const photos = [];
  const addPhoto = (src, title = "Фото автомобиля") => {
    const url = mediaUrl(src);
    if (url && !photos.some((photo) => photo.src === url)) photos.push({ src: url, title });
  };
  (application.photos || []).forEach((photo) => addPhoto(photo.image, photo.caption || "Фото заявки"));
  (application.cars_detail || []).forEach((car) => {
    const carName = `${car.make || ""} ${car.model || ""}`.trim() || "Автомобиль";
    addPhoto(car.main_photo, carName);
    (car.photos || []).forEach((photo) => addPhoto(photo.image, carName));
  });
  if (!photos.length) addPhoto(applicationPhoto(application), "Фото автомобиля");
  return photos;
}

function openImageViewer(src, title = "Фото автомобиля") {
  const modal = $("#imageViewerModal");
  const image = $("#imageViewerImage");
  const caption = $("#imageViewerCaption");
  if (!modal || !image) return;
  image.src = src;
  image.alt = title;
  if (caption) caption.textContent = title;
  modal.hidden = false;
}

function closeImageViewer() {
  const modal = $("#imageViewerModal");
  const image = $("#imageViewerImage");
  if (modal) modal.hidden = true;
  if (image) image.removeAttribute("src");
}

function ticketApplicationId(application) {
  return `SF-${String(application?.id || 0).padStart(5, "0")}`;
}

function applicationFestival(application) {
  return state.festivals.find((festival) => Number(festival.id) === Number(application?.festival)) || state.selectedFestival || state.festivals[0] || {};
}

function applicationCarsText(application) {
  return application?.cars_detail?.length
    ? application.cars_detail.map((car) => {
        const name = `${car.make || ""} ${car.model || ""}`.trim();
        const purpose = carPurposeLabels[car.purpose] || "";
        return [name, purpose].filter(Boolean).join(" - ");
      }).join(", ")
    : [
        `${application?.car_make || ""} ${application?.car_model || ""}`.trim(),
        carPurposeLabels[application?.purpose] || "",
      ].filter(Boolean).join(" - ") || "Автомобиль не указан";
}

function applicationLastSeen(application) {
  return formatLastSeen(application?.participant_detail?.last_seen_at || application?.last_seen_at);
}

function moderatorNoteText(note = "") {
  if (!note) return "";
  if (note.includes("Р") && note.includes("Р°")) return "Заявка добавлена администратором.";
  return note;
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

function applicationOwnerName(application) {
  return application?.participant_name || state.profile?.full_name || application?.phone || state.profile?.phone || "Участник фестиваля";
}

function ticketSecuritySeed(application) {
  const cars = applicationCarsText(application);
  return [
    ticketApplicationId(application),
    application?.participant || "",
    application?.festival || "",
    application?.created_at || "",
    application?.phone || "",
    cars,
  ].join("|");
}

function ticketHash(value) {
  let hash = 2166136261;
  String(value).split("").forEach((char) => {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });
  return hash >>> 0;
}

function ticketSecureCode(application) {
  const hash = ticketHash(ticketSecuritySeed(application)).toString(36).toUpperCase().padStart(7, "0");
  return `${ticketApplicationId(application)}-${hash.slice(0, 3)}-${hash.slice(3, 7)}`;
}

function ticketBarcode(application) {
  const secureCode = ticketSecureCode(application);
  const bits = Array.from(secureCode).map((char) => char.charCodeAt(0).toString(2).padStart(8, "0")).join("");
  let x = 8;
  const bars = [];
  bits.split("").forEach((bit, index) => {
    const width = bit === "1" ? 3 : 1;
    const height = index % 5 === 0 ? 58 : index % 3 === 0 ? 48 : 40;
    bars.push(`<rect x="${x}" y="${62 - height}" width="${width}" height="${height}" rx="0.4"></rect>`);
    x += width + 2;
  });
  return `
    <svg class="ticket-barcode" viewBox="0 0 ${x + 6} 68" role="img" aria-label="Штрих код билета">
      ${bars.join("")}
    </svg>
  `;
}

function gfMultiply(x, y) {
  let result = 0;
  while (y) {
    if (y & 1) result ^= x;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
    y >>= 1;
  }
  return result;
}

function qrGeneratorPolynomial(degree) {
  let poly = [1];
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    const next = Array(poly.length + 1).fill(0);
    poly.forEach((coef, index) => {
      next[index] ^= gfMultiply(coef, root);
      next[index + 1] ^= coef;
    });
    poly = next;
    root = gfMultiply(root, 2);
  }
  return poly;
}

function qrErrorCorrection(data, degree) {
  const generator = qrGeneratorPolynomial(degree);
  const message = data.concat(Array(degree).fill(0));
  data.forEach((_, index) => {
    const factor = message[index];
    if (!factor) return;
    generator.forEach((coef, offset) => {
      message[index + offset] ^= gfMultiply(coef, factor);
    });
  });
  return message.slice(data.length);
}

function qrAppendBits(bits, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
}

function qrCodewords(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const dataLength = 108;
  const bits = [];
  qrAppendBits(bits, 0x4, 4);
  qrAppendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => qrAppendBits(bits, byte, 8));
  qrAppendBits(bits, 0, Math.min(4, dataLength * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }
  for (let pad = 0; codewords.length < dataLength; pad += 1) codewords.push(pad % 2 ? 0x11 : 0xec);
  return codewords.concat(qrErrorCorrection(codewords, 26));
}

function qrFormatBits() {
  let data = (1 << 3) | 0;
  let bits = data << 10;
  const generator = 0x537;
  for (let i = 14; i >= 10; i -= 1) {
    if ((bits >>> i) & 1) bits ^= generator << (i - 10);
  }
  return (((data << 10) | bits) ^ 0x5412) & 0x7fff;
}

function makeQrSvg(text) {
  const version = 5;
  const size = 4 * version + 17;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  const setModule = (x, y, dark, isReserved = true) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
    if (isReserved) reserved[y][x] = true;
  };
  const drawFinder = (x, y) => {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const xx = x + dx;
        const yy = y + dy;
        const dark = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        setModule(xx, yy, dark);
      }
    }
  };
  const drawAlignment = (cx, cy) => {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        setModule(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);
  drawAlignment(30, 30);
  for (let i = 8; i < size - 8; i += 1) {
    setModule(i, 6, i % 2 === 0);
    setModule(6, i, i % 2 === 0);
  }
  setModule(8, size - 8, true);
  for (let i = 0; i < 9; i += 1) {
    if (i !== 6) {
      setModule(8, i, false);
      setModule(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i += 1) {
    setModule(size - 1 - i, 8, false);
    setModule(8, size - 1 - i, false);
  }

  const bits = qrCodewords(text).flatMap((codeword) => Array.from({ length: 8 }, (_, index) => (codeword >>> (7 - index)) & 1));
  let bitIndex = 0;
  let upward = true;
  for (let x = size - 1; x > 0; x -= 2) {
    if (x === 6) x -= 1;
    for (let step = 0; step < size; step += 1) {
      const y = upward ? size - 1 - step : step;
      [x, x - 1].forEach((xx) => {
        if (reserved[y][xx]) return;
        const raw = Boolean(bits[bitIndex]);
        const masked = raw !== ((xx + y) % 2 === 0);
        setModule(xx, y, masked, false);
        bitIndex += 1;
      });
    }
    upward = !upward;
  }

  const format = qrFormatBits();
  const formatBit = (index) => Boolean((format >>> index) & 1);
  for (let i = 0; i <= 5; i += 1) setModule(8, i, formatBit(i));
  setModule(8, 7, formatBit(6));
  setModule(8, 8, formatBit(7));
  setModule(7, 8, formatBit(8));
  for (let i = 9; i < 15; i += 1) setModule(14 - i, 8, formatBit(i));
  for (let i = 0; i < 8; i += 1) setModule(size - 1 - i, 8, formatBit(i));
  for (let i = 8; i < 15; i += 1) setModule(8, size - 15 + i, formatBit(i));

  const quiet = 4;
  const rects = [];
  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) rects.push(`<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"></rect>`);
    });
  });
  return `
    <svg class="ticket-qr-code" viewBox="0 0 ${size + quiet * 2} ${size + quiet * 2}" role="img" aria-label="QR код проверки билета">
      <rect width="${size + quiet * 2}" height="${size + quiet * 2}" fill="#fff"></rect>
      <g fill="#111317">${rects.join("")}</g>
    </svg>
  `;
}

function ticketVerifyUrl(application) {
  const url = new URL("/web/verify.html", window.location.origin);
  url.searchParams.set("i", application?.id || "");
  url.searchParams.set("c", ticketSecureCode(application));
  return url.toString();
}

function ticketQrMarkup(application) {
  const verifyUrl = ticketVerifyUrl(application);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=16&data=${encodeURIComponent(verifyUrl)}`;
  return `<img class="ticket-qr-code" src="${qrUrl}" alt="QR код проверки билета" loading="eager" referrerpolicy="no-referrer" />`;
}

function ticketMarkup(application) {
  const festival = applicationFestival(application);
  const place = festival.location || festival.city || "Samarkand Touristic Centre";
  const date = "18-19 июля";
  const code = ticketApplicationId(application);
  const secureCode = ticketSecureCode(application);
  const status = ticketStatusLabel(application);
  const owner = applicationOwnerName(application);
  const phone = application?.phone || "Телефон не указан";
  const cars = applicationCarsText(application);
  return `
    <article class="festival-ticket">
      <div class="ticket-watermark">SAMARKAND FEST</div>
      <div class="ticket-security-pattern" aria-hidden="true"></div>
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
          <p>Заявка одобрена администратором. При входе билет сверяется по ID, контрольному коду и данным автомобиля.</p>
        </div>
        <div class="ticket-code-box">
          <small>ID заявки</small>
          <strong>${escapeText(code)}</strong>
          <span>${escapeText(secureCode)}</span>
        </div>
      </section>

      <section class="ticket-security-row">
        <div class="ticket-barcode-box">
          ${ticketBarcode(application)}
          <small>${escapeText(secureCode)}</small>
        </div>
        <div class="ticket-verify-box">
          ${ticketQrMarkup(application)}
          <div>
            <small>QR проверка</small>
            <strong>${escapeText(secureCode.split("-").slice(-2).join("-"))}</strong>
            <span>Открывается только с admin-доступом</span>
          </div>
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
          <strong>${escapeText(secureCode)}</strong>
        </div>
      </section>

      <div class="ticket-microtext" aria-hidden="true">
        ${Array.from({ length: 8 }, () => `SAMARKAND FEST • ${secureCode} • VALID ONLY WITH APPROVED APPLICATION`).join(" • ")}
      </div>

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
          .festival-ticket { position: relative; overflow: hidden; display: grid; gap: 22px; width: min(980px, 100%); margin: 0 auto; padding: 30px; border: 1px solid #e4e6eb; border-radius: 14px; background: linear-gradient(135deg, rgba(230, 0, 35, .045), transparent 26%), repeating-linear-gradient(45deg, rgba(16, 17, 20, .025) 0 1px, transparent 1px 9px), #fff; box-shadow: 0 18px 50px rgba(15, 18, 25, .12); }
          .festival-ticket::before, .festival-ticket::after { position: absolute; top: 50%; z-index: 2; width: 28px; height: 28px; border: 1px solid #e4e6eb; border-radius: 50%; background: #f3f4f6; content: ""; }
          .festival-ticket::before { left: -15px; } .festival-ticket::after { right: -15px; }
          .ticket-watermark { position: absolute; right: -30px; bottom: 18px; color: rgba(230, 0, 35, .06); font-size: 68px; font-weight: 900; letter-spacing: 3px; transform: rotate(-8deg); }
          .ticket-security-pattern { position: absolute; inset: 12px; border: 1px solid rgba(230, 0, 35, .12); border-radius: 10px; background: repeating-linear-gradient(90deg, transparent 0 18px, rgba(230, 0, 35, .045) 18px 19px), repeating-linear-gradient(0deg, transparent 0 18px, rgba(5, 6, 8, .035) 18px 19px); }
          .ticket-header, .ticket-main, .ticket-security-row, .ticket-grid, .ticket-footer, .ticket-microtext { position: relative; z-index: 1; }
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
          .ticket-code-box span { display: block; margin-top: 8px; color: rgba(255, 255, 255, .72); font-size: 11px; font-weight: 900; letter-spacing: .08em; }
          .ticket-security-row { display: grid; grid-template-columns: minmax(0, .8fr) minmax(480px, 1fr); gap: 12px; }
          .ticket-barcode-box, .ticket-verify-box { min-width: 0; border: 1px dashed #cfd3dc; border-radius: 10px; background: rgba(255, 255, 255, .86); }
          .ticket-barcode-box { display: grid; gap: 8px; padding: 13px; }
          .ticket-barcode { width: 100%; height: 66px; fill: #111317; }
          .ticket-barcode-box small, .ticket-verify-box small, .ticket-verify-box span { color: #6b7280; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
          .ticket-verify-box { display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center; padding: 14px; }
          .ticket-qr-code { width: 220px; height: 220px; border: 1px solid #111317; border-radius: 8px; background: #fff; object-fit: contain; shape-rendering: crispEdges; }
          .ticket-verify-box strong { display: block; margin: 5px 0; color: #111317; font-size: 20px; letter-spacing: .06em; }
          .ticket-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .ticket-field { padding: 16px; border: 1px solid #e4e6eb; border-radius: 10px; background: #fff; }
          .ticket-field-wide { grid-column: span 2; }
          .ticket-field strong { display: block; margin-top: 7px; font-size: 18px; }
          .ticket-microtext { overflow: hidden; white-space: nowrap; border-top: 1px solid rgba(230, 0, 35, .16); border-bottom: 1px solid rgba(230, 0, 35, .16); color: rgba(230, 0, 35, .52); font-size: 8px; font-weight: 950; letter-spacing: .14em; line-height: 18px; }
          .ticket-footer { margin-top: 22px; padding-top: 14px; border-top: 1px dashed #cfd3dc; }
          @media print { body { padding: 0; background: #fff; } .festival-ticket { width: 100%; box-shadow: none; border-radius: 0; } }
          @media (max-width: 680px) { body { padding: 12px; } .ticket-header, .ticket-main, .ticket-footer { align-items: flex-start; flex-direction: column; } .ticket-security-row, .ticket-grid { grid-template-columns: 1fr; } .ticket-field-wide { grid-column: auto; } }
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

function openAdminCredentials(credentials = {}) {
  const modal = $("#adminCredentialsModal");
  if (!modal) return;
  $("#adminCredentialLogin").textContent = credentials.login || "";
  $("#adminCredentialPassword").textContent = credentials.password || "";
  modal.hidden = false;
}

function closeAdminCredentials() {
  const modal = $("#adminCredentialsModal");
  if (modal) modal.hidden = true;
}

async function copyText(value) {
  if (!value) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

async function handleCredentialsCopy(event) {
  const copyAllButton = event.target.closest("#adminCredentialsCopyAll");
  if (!copyAllButton) return;
  const login = $("#adminCredentialLogin")?.textContent || "";
  const password = $("#adminCredentialPassword")?.textContent || "";
  try {
    await copyText(`Логин: ${login}\nПароль: ${password}`);
    toast("Скопировано");
  } catch {
    toast("Не удалось скопировать");
  }
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
  setTimeout(() => popup.print(), 1200);
}

async function loadAdminApplications() {
  const params = new URLSearchParams();
  if (state.adminSearch.trim()) params.set("search", state.adminSearch.trim());
  if (state.adminFilter !== "all") {
    params.set("status", state.adminFilter === "approved" ? "approved" : state.adminFilter === "rejected" ? "rejected" : "pending");
  }
  if (state.adminPurposeFilter !== "all") params.set("purpose", state.adminPurposeFilter);
  const query = params.toString() ? `?${params}` : "";
  const payload = await adminApi(`/admin/applications/${query}`);
  state.adminApplications = Array.isArray(payload) ? payload : payload.results || [];
}

async function loadAdminProfiles() {
  const params = new URLSearchParams();
  if (state.adminSearch.trim()) params.set("search", state.adminSearch.trim());
  const query = params.toString() ? `?${params}` : "";
  const payload = await adminApi(`/admin/profiles/${query}`);
  state.adminProfiles = Array.isArray(payload) ? payload : payload.results || [];
}

async function loadAdminSummary() {
  state.adminSummary = await adminApi("/admin/summary/");
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
  const online = $("#adminOnline");
  if (online) online.textContent = state.adminSummary?.profiles_online ?? 0;
}

function filteredAdminApplications() {
  const query = state.adminSearch.trim().toLowerCase();
  return state.adminApplications.filter((application) => {
    const group = applicationStatus(application).group;
    const matchesFilter = state.adminFilter === "all" || group === state.adminFilter;
    const purposes = (application.cars_detail || []).map((car) => car.purpose);
    if (application.purpose) purposes.push(application.purpose);
    const matchesPurpose = state.adminPurposeFilter === "all" || purposes.includes(state.adminPurposeFilter);
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
    return matchesFilter && matchesPurpose && (!query || text.includes(query));
  });
}

function renderAdminProfiles() {
  const list = $("#adminProfiles");
  if (!list) return;
  const profiles = state.adminProfiles;
  if (!profiles.length) {
    list.innerHTML = `
      <article class="empty-card">
        <span class="icon-badge" data-icon="user"></span>
        <p>Пользователи не найдены.</p>
      </article>
    `;
    hydrateIcons(list);
    return;
  }
  list.innerHTML = profiles.map((profile) => {
    const photo = mediaUrl(profile.photo);
    const cars = profile.cars?.length
      ? profile.cars.map((car) => {
        const name = `${car.make || ""} ${car.model || ""} ${car.year || ""}`.trim();
        const purpose = carPurposeLabels[car.purpose] || "";
        return [name, purpose].filter(Boolean).join(" - ");
      }).join(", ")
      : "Авто не добавлено";
    const applicationsCount = Number(profile.applications_count || 0);
    return `
      <article class="admin-profile-card">
        <div class="admin-profile-card-head">
          ${photo ? `<img src="${photo}" alt="${escapeText(profile.full_name || "Пользователь")}" />` : `<span class="profile-avatar-fallback">${getInitial(profile.full_name || profile.phone)}</span>`}
          <div>
            <strong>${escapeText(profile.full_name || "Без имени")}</strong>
            <span>${escapeText(profile.phone || "Телефон не указан")}</span>
          </div>
          <small class="${applicationsCount ? "admin-profile-has-app" : "admin-profile-no-app"}">${applicationsCount ? `${applicationsCount} заявок` : "Без заявки"}</small>
        </div>
        <div class="admin-profile-meta">
          <span><b>Telegram</b>${escapeText(profile.telegram || "Не указан")}</span>
          <span><b>Город</b>${escapeText(profile.city || "Не указан")}</span>
          <span><b>Последний раз</b>${applicationLastSeen(profile)}</span>
          <span><b>Авто</b>${escapeText(cars)}</span>
        </div>
        <form class="admin-password-form admin-profile-password-form" data-profile-id="${profile.id}">
          <input name="password" type="password" placeholder="Новый пароль" minlength="6" required />
          <button class="glass-button" type="submit">Сменить пароль</button>
          <p class="form-message"></p>
        </form>
      </article>
    `;
  }).join("");
  hydrateIcons(list);
}

function renderAdminCreateForm() {
  const select = $("#adminCreateFestival");
  if (!select) return;
  const festivals = state.festivals || [];
  if (!festivals.length) {
    select.innerHTML = `<option value="">Фестиваль не найден</option>`;
    return;
  }
  select.innerHTML = `
    <option value="">Выберите фестиваль</option>
    ${festivals.map((festival) => `
      <option value="${festival.id}">${escapeText(festival.title || "Samarkand Fest")}</option>
    `).join("")}
  `;
  if (festivals.length === 1) select.value = String(festivals[0].id);
}

function renderAdminCreatePhotosPreview(input) {
  const preview = $("#adminCreatePhotosPreview");
  if (!preview) return;
  const files = Array.from(input?.files || []);
  if (!files.length) {
    preview.innerHTML = `<p>Фото пока не выбраны.</p>`;
    preview.classList.remove("has-files");
    return;
  }
  const visibleFiles = files.slice(0, 5);
  preview.classList.add("has-files");
  preview.innerHTML = `
    <p>Выбрано фото: ${visibleFiles.length}${files.length > 5 ? " из 5, лишние не будут загружены" : ""}</p>
    <div class="admin-photos-preview-grid">
      ${visibleFiles.map((file, index) => `
        <figure>
          <img src="${URL.createObjectURL(file)}" alt="${escapeText(file.name)}" />
          <figcaption>${index === 0 ? "Главное фото" : escapeText(file.name)}</figcaption>
        </figure>
      `).join("")}
    </div>
  `;
  preview.querySelectorAll("img").forEach((img) => {
    img.addEventListener("load", () => URL.revokeObjectURL(img.src), { once: true });
  });
}

function adminStatusActions(application) {
  if (application.status === "approved") {
    return `
      <button class="primary-button" type="button" data-admin-ticket="${application.id}">
        <span class="icon" data-icon="ticket"></span>
        <span>Скачать билет</span>
      </button>
      <button class="glass-button danger-button" type="button" data-admin-status="reviewing" data-admin-cancel="true" data-application-id="${application.id}">Отменить</button>
    `;
  }
  return `
    <button class="primary-button" type="button" data-admin-status="approved" data-application-id="${application.id}">Принять</button>
    <button class="glass-button danger-button" type="button" data-admin-status="rejected" data-application-id="${application.id}">Отказать</button>
    <button class="glass-button" type="button" data-admin-status="reviewing" data-application-id="${application.id}">В ожидание</button>
  `;
}

function syncAdminStatusActions(container, application) {
  const actions = container.querySelector(".admin-card-actions");
  if (!actions) return;
  actions.querySelectorAll("[data-admin-status], [data-admin-ticket]").forEach((button) => button.remove());
  actions.insertAdjacentHTML("beforeend", adminStatusActions(application));
  hydrateIcons(actions);
}

function syncAdminActivity(container, application) {
  const meta = container.querySelector(".admin-meta-grid, .admin-meta-list");
  if (!meta || meta.querySelector("[data-admin-last-seen]")) return;
  meta.insertAdjacentHTML("beforeend", `<span data-admin-last-seen><b>Последний раз</b>${applicationLastSeen(application)}</span>`);
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
      ? application.cars_detail.map((car) => {
        const carName = `${car.make || ""} ${car.model || ""} ${car.year || ""}`.trim();
        const purpose = carPurposeLabels[car.purpose] || "";
        return [carName, purpose].filter(Boolean).join(" - ");
      }).join(", ")
      : `${application.car_make} ${application.car_model} ${application.car_year || ""}`.trim();
    const carPurposes = application.cars_detail?.length
      ? [...new Set(application.cars_detail.map((car) => carPurposeLabels[car.purpose]).filter(Boolean))].join(", ")
      : (carPurposeLabels[application.purpose] || "");
    const moderatorNote = moderatorNoteText(application.moderator_note);
    return `
      <article class="admin-application application-${application.status}" data-application-id="${application.id}">
        <button class="admin-application-photo" type="button" data-image-open="${applicationPhoto(application)}" data-image-title="${escapeText(cars || application.car_make || "Авто")}">
          <img src="${applicationPhoto(application)}" alt="${application.car_make || "Авто"}" />
        </button>
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
            ${application.created_by_username ? `<span><b>Добавил администратор</b>${escapeText(application.created_by_username)}</span>` : ""}
          </div>
          <div class="admin-car-details">
            ${carPurposes ? `<p><b>Категория:</b> ${escapeText(carPurposes)}</p>` : ""}
            <p><b>Двигатель:</b> ${application.engine || "Не указан"}</p>
            <p><b>Состояние:</b> ${application.condition || "Не указано"}</p>
            ${application.tuning_details ? `<p><b>Тюнинг:</b> ${application.tuning_details}</p>` : ""}
            ${moderatorNote ? `<p><b>Комментарий модератора:</b> ${escapeText(moderatorNote)}</p>` : ""}
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
  list.querySelectorAll(".admin-application").forEach((card) => {
    const application = state.adminApplications.find((item) => Number(item.id) === Number(card.dataset.applicationId));
    if (application) {
      syncAdminStatusActions(card, application);
      syncAdminActivity(card, application);
    }
  });
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

function renderAdminGallery(application) {
  const photos = applicationGallery(application);
  if (!photos.length) return "";
  return `
    <div class="admin-photo-gallery">
      ${photos.map((photo, index) => `
        <button type="button" data-image-open="${photo.src}" data-image-title="${escapeText(photo.title)} #${index + 1}">
          <img src="${photo.src}" alt="${escapeText(photo.title)}" />
        </button>
      `).join("")}
    </div>
  `;
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
            <small>${[car.engine, carPurposeLabels[car.purpose]].filter(Boolean).join(" · ") || "Мотор не указан"}</small>
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
        <button class="admin-detail-photo-button" type="button" data-image-open="${applicationPhoto(application)}" data-image-title="${escapeText(`${application.car_make || "Авто"} ${application.car_model || ""}`.trim())}">
          <img class="admin-detail-photo" src="${applicationPhoto(application)}" alt="${application.car_make || "Авто"}" />
        </button>
        ${renderAdminGallery(application)}
        <div class="admin-card-actions admin-detail-actions">
          ${adminStatusActions(application)}
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
              ${application.created_by_username ? `<span><b>Добавил администратор</b>${escapeText(application.created_by_username)}</span>` : ""}
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
  syncAdminStatusActions(content, application);
  syncAdminActivity(content, application);
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
  const imageButton = event.target.closest("[data-image-open]");
  const detailButton = event.target.closest("[data-admin-detail]");
  const ticketButton = event.target.closest("[data-admin-ticket]");
  const statusButton = event.target.closest("[data-admin-status]");
  if (imageButton) {
    openImageViewer(imageButton.dataset.imageOpen, imageButton.dataset.imageTitle || "Фото автомобиля");
    return;
  }
  if (detailButton) {
    await openAdminDetail(detailButton.dataset.adminDetail);
    return;
  }
  if (ticketButton) {
    const ticketId = Number(ticketButton.dataset.adminTicket);
    const application = state.adminApplications.find((item) => Number(item.id) === Number(ticketButton.dataset.adminTicket))
      || (Number(state.selectedAdminApplication?.id) === ticketId ? state.selectedAdminApplication : null);
    if (application?.status !== "approved") {
      toast("Билет доступен только после принятия заявки");
      return;
    }
    openTicket(application);
    return;
  }
  if (statusButton) {
    if (statusButton.dataset.adminCancel === "true" && !window.confirm("Вы действительно хотите отменить заявку?")) {
      return;
    }
    await updateAdminApplicationStatus(statusButton.dataset.applicationId, statusButton.dataset.adminStatus);
  }
}

async function handleAdminPasswordChange(event) {
  const form = event.target.closest(".admin-password-form");
  if (!form) return;
  event.preventDefault();
  const profileId = form.dataset.profileId;
  const message = form.querySelector(".form-message") || $("#adminPasswordMessage");
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

async function handleAdminCreateApplication(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#adminCreateMessage");
  const button = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const photosInput = form.querySelector('[name="photos"]');
  const photos = Array.from(photosInput?.files || []).slice(0, 5);
  data.delete("photos");
  photos.forEach((file) => data.append("photos", file, file.name));
  const phoneDigits = String(data.get("phone") || "").replace(/\D/g, "");
  if (phoneDigits) data.set("phone", `+${phoneDigits}`);
  if (button) button.disabled = true;
  if (message) message.textContent = "";
  closeAdminCredentials();
  try {
    const application = await adminApi("/admin/applications/create/", {
      method: "POST",
      body: data,
    });
    form.reset();
    renderAdminCreateForm();
    renderAdminCreatePhotosPreview(photosInput);
    await loadAdminSummary();
    await loadAdminApplications();
    await loadAdminProfiles();
    renderAdminApplications();
    renderAdminProfiles();
    openTicket(application);
    if (application.admin_credentials) openAdminCredentials(application.admin_credentials);
    if (message) message.textContent = "Участник добавлен, заявка принята. Билет открыт.";
    toast("Заявка создана, билет готов");
  } catch (error) {
    if (message) message.textContent = error.message;
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function renderAdminPage() {
  $("#adminLoginForm")?.toggleAttribute("hidden", Boolean(state.adminToken));
  $("#adminPanel")?.toggleAttribute("hidden", !state.adminToken);
  if (!state.adminToken) return;
  try {
    try {
      await loadFestivals();
    } catch (error) {
      console.warn("Festival data is unavailable for admin tickets", error);
    }
    renderAdminCreateForm();
    await loadAdminSummary();
    await loadAdminApplications();
    await loadAdminProfiles();
    renderAdminApplications();
    renderAdminProfiles();
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

function renderVerifyResult(stateName, payload = {}) {
  const result = $("#verifyResult");
  if (!result) return;
  if (stateName === "loading") {
    result.className = "verify-card reveal";
    result.innerHTML = `
      <span class="icon-badge" data-icon="ticket"></span>
      <div>
        <h2>Проверяем билет</h2>
        <p class="muted">Подождите несколько секунд.</p>
      </div>
    `;
  } else if (stateName === "login") {
    result.className = "verify-card reveal";
    result.innerHTML = `
      <span class="icon-badge" data-icon="shield"></span>
      <div>
        <h2>Нужен вход администратора</h2>
        <p class="muted">После входа билет проверится автоматически.</p>
      </div>
    `;
  } else if (stateName === "valid") {
    const application = payload.application || {};
    const cars = applicationCarsText(application);
    result.className = "verify-card verify-valid reveal";
    result.innerHTML = `
      <span class="icon-badge" data-icon="shield"></span>
      <div>
        <p class="eyebrow">Билет действителен</p>
        <h2>${escapeText(application.participant_name || "Участник")}</h2>
        <div class="verify-fields">
          <span><b>ID</b>${escapeText(ticketApplicationId(application))}</span>
          <span><b>Код</b>${escapeText(payload.secure_code || "")}</span>
          <span><b>Телефон</b>${escapeText(application.phone || "Не указан")}</span>
          <span><b>Авто / категория</b>${escapeText(cars)}</span>
          <span><b>Статус</b>${escapeText(ticketStatusLabel(application))}</span>
        </div>
      </div>
    `;
  } else {
    result.className = "verify-card verify-invalid reveal";
    result.innerHTML = `
      <span class="icon-badge" data-icon="shield"></span>
      <div>
        <p class="eyebrow">Билет не прошел проверку</p>
        <h2>Проверка отклонена</h2>
        <p class="muted">${escapeText(payload.detail || "QR-код поврежден, подделан или заявка не одобрена.")}</p>
      </div>
    `;
  }
  hydrateIcons(result);
}

async function verifyTicketFromQr() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("i") || params.get("id");
  const code = params.get("c") || params.get("code");
  if (!id || !code) {
    renderVerifyResult("invalid", { detail: "В QR-коде нет данных билета." });
    return;
  }
  renderVerifyResult("loading");
  try {
    const payload = await api(`/admin/tickets/${id}/verify/?code=${encodeURIComponent(code)}`);
    renderVerifyResult(payload.valid ? "valid" : "invalid", payload);
  } catch (error) {
    renderVerifyResult("invalid", { detail: error.message });
  }
}

async function handleVerifyLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("#verifyLoginMessage");
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
    await verifyTicketFromQr();
  } catch (error) {
    if (message) message.textContent = error.message;
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
  const purposeSelect = form.querySelector('[name="purpose"]');
  const purpose = purposeSelect?.value?.trim() || "";
  if (!purpose) {
    $("#carMessage").textContent = "Выберите, для чего машина.";
    purposeSelect?.focus();
    return;
  }
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
  body.append("purpose", purpose);
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

async function handleProfileApply(event) {
  event.preventDefault();
  const message = $("#profileApplyMessage");
  if (!state.profile) return;
  const form = event.currentTarget;
  const festivalId = Number(form.festival?.value);
  const selected = Array.from(form.querySelectorAll('input[name="cars"]:checked')).map((input) => Number(input.value));
  if (!festivalId) {
    if (message) message.textContent = "Выбери фестиваль.";
    form.festival?.focus();
    return;
  }
  if (!selected.length) {
    if (message) message.textContent = "Выбери хотя бы одно авто для заявки.";
    return;
  }

  const firstCar = state.profile.cars.find((car) => Number(car.id) === selected[0]);
  if (!firstCar) {
    if (message) message.textContent = "Выбранное авто не найдено. Обнови страницу и попробуй еще раз.";
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    await api("/applications/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        festival: festivalId,
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
      }),
    });
    await loadApplications();
    renderProfile();
    $("#profileApplyMessage").textContent = "Заявка отправлена. Статус появится ниже в списке.";
    toast("Заявка отправлена на модерацию");
  } catch (error) {
    if (message) message.textContent = error.message;
  } finally {
    if (button) button.disabled = false;
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
  $("#profileApplyForm")?.addEventListener("submit", handleProfileApply);
  $("#garagePreview")?.addEventListener("click", handleCarDelete);
  $("#applicationsList")?.addEventListener("click", handleTicketClick);
  $("#applyForm")?.addEventListener("submit", handleApply);
  $("#commentForm")?.addEventListener("submit", handleCommentCreate);
  $("#commentsBox")?.addEventListener("click", handleCommentDelete);
  $("#newsGrid")?.addEventListener("click", handleNewsClick);
  $("#logoutButton")?.addEventListener("click", logout);
  $("#adminLoginForm")?.addEventListener("submit", handleAdminLogin);
  $("#adminCreateApplicationForm")?.addEventListener("submit", handleAdminCreateApplication);
  $("#adminCreateApplicationForm [name='photos']")?.addEventListener("change", (event) => {
    renderAdminCreatePhotosPreview(event.currentTarget);
  });
  $("#verifyLoginForm")?.addEventListener("submit", handleVerifyLogin);
  $("#adminSearch")?.addEventListener("input", (event) => {
    state.adminSearch = event.target.value;
    renderAdminApplications();
    renderAdminProfiles();
  });
  $("#adminFilters")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-admin-filter]");
    if (!button) return;
    state.adminFilter = button.dataset.adminFilter;
    $$("#adminFilters button").forEach((node) => node.classList.toggle("active", node === button));
    renderAdminApplications();
  });
  $("#adminApplications")?.addEventListener("click", handleAdminApplicationClick);
  $("#adminPurposeFilter")?.addEventListener("change", async (event) => {
    state.adminPurposeFilter = event.target.value;
    await loadAdminApplications();
    renderAdminApplications();
  });
  $("#adminProfiles")?.addEventListener("submit", handleAdminPasswordChange);
  $("#adminDetailContent")?.addEventListener("click", handleAdminApplicationClick);
  $("#adminDetailContent")?.addEventListener("submit", handleAdminPasswordChange);
  $("#adminDetailClose")?.addEventListener("click", closeAdminDetail);
  $("#imageViewerClose")?.addEventListener("click", closeImageViewer);
  $("#imageViewerModal")?.addEventListener("click", (event) => {
    if (event.target.id === "imageViewerModal") closeImageViewer();
  });
  $("#avatarEditButton")?.addEventListener("click", openAvatarModal);
  $("#avatarModalClose")?.addEventListener("click", closeAvatarModal);
  $("#ticketModalClose")?.addEventListener("click", closeTicketModal);
  $("#ticketPrintButton")?.addEventListener("click", printTicket);
  $("#adminCredentialsClose")?.addEventListener("click", closeAdminCredentials);
  $("#adminCredentialsModal")?.addEventListener("click", (event) => {
    if (event.target.id === "adminCredentialsModal") closeAdminCredentials();
    handleCredentialsCopy(event);
  });
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
    if (state.profile) setInterval(markProfileSeen, 60000);
  }
  if (page === "admin") renderAdminPage();
  if (page === "verify") verifyTicketFromQr();
}

boot();
