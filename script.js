/* ==========================================================
   SkyTasks — Hava durumuna duyarlı görev takibi
   Saf JavaScript (bağımlılık yok) · Veri: Open-Meteo (API anahtarı gerekmez)
   ========================================================== */
(() => {
  'use strict';

  /* ---------- Yardımcılar ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  const load = (k, fallback) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* özel mod vb. */ } };

  const KEYS = { tasks: 'skytasks.tasks.v1', place: 'skytasks.place.v1' };
  const DEFAULT_PLACE = { name: 'İstanbul', country: 'Türkiye', lat: 41.0138, lon: 28.9497 };
  const REFRESH_MS = 15 * 60 * 1000;

  const dayFmt = new Intl.DateTimeFormat('tr-TR', { weekday: 'short' });
  const longFmt = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const shortDate = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });

  /* ---------- Hava kodu (WMO) çözümleme ---------- */
  const LABELS = {
    0: 'Açık', 1: 'Çoğunlukla açık', 2: 'Parçalı bulutlu', 3: 'Kapalı',
    45: 'Sisli', 48: 'Kırağılı sis',
    51: 'Hafif çiseleme', 53: 'Çiseleme', 55: 'Yoğun çiseleme', 56: 'Dondurucu çiseleme', 57: 'Dondurucu çiseleme',
    61: 'Hafif yağmur', 63: 'Yağmur', 65: 'Şiddetli yağmur', 66: 'Dondurucu yağmur', 67: 'Dondurucu yağmur',
    71: 'Hafif kar', 73: 'Kar yağışı', 75: 'Yoğun kar', 77: 'Kar taneleri',
    80: 'Hafif sağanak', 81: 'Sağanak', 82: 'Şiddetli sağanak', 85: 'Kar sağanağı', 86: 'Yoğun kar sağanağı',
    95: 'Gök gürültülü fırtına', 96: 'Dolu ile fırtına', 99: 'Şiddetli dolu fırtınası',
  };

  function kindOf(code) {
    if (code === 0 || code === 1) return 'clear';
    if (code === 2) return 'partly';
    if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if (code >= 95) return 'storm';
    return 'cloud';
  }
  const fxGroup = (kind) => (kind === 'drizzle' ? 'rain' : kind);
  const WET = new Set(['drizzle', 'rain', 'snow', 'storm']);

  /* ---------- SVG hava ikonları ---------- */
  function icon(kind, day = true) {
    const rays = [0, 45, 90, 135, 180, 225, 270, 315]
      .map((a) => `<line x1="32" y1="13" x2="32" y2="19" transform="rotate(${a} 32 32)"/>`).join('');
    const sun = `<g stroke="#FDB813" stroke-width="3" stroke-linecap="round"><circle cx="32" cy="32" r="9" fill="#FDB813" stroke="none"/>${rays}</g>`;
    const moon = '<path d="M40 12a19 19 0 1 0 12 33A16 16 0 0 1 40 12z" fill="#E2E8F0"/>';
    const cloud = (col = '#E2E8F0', y = 0) =>
      `<g transform="translate(0 ${y})" fill="${col}"><circle cx="24" cy="38" r="9"/><circle cx="35" cy="31" r="12"/><circle cx="46" cy="39" r="8"/><rect x="20" y="38" width="31" height="9" rx="4.5"/></g>`;
    const rain = '<g stroke="#60A5FA" stroke-width="3" stroke-linecap="round"><line x1="26" y1="51" x2="23" y2="59"/><line x1="36" y1="51" x2="33" y2="59"/><line x1="46" y1="51" x2="43" y2="59"/></g>';
    const snow = '<g fill="#fff"><circle cx="25" cy="54" r="2.4"/><circle cx="36" cy="58" r="2.4"/><circle cx="46" cy="54" r="2.4"/></g>';
    const bolt = '<polygon points="37,44 28,57 34,57 31,66 43,50 37,50" fill="#FBBF24"/>';
    const fog = '<g stroke="#CBD5E1" stroke-width="3.5" stroke-linecap="round"><line x1="14" y1="26" x2="50" y2="26"/><line x1="10" y1="35" x2="54" y2="35"/><line x1="16" y1="44" x2="48" y2="44"/></g>';
    const small = (inner) => `<g transform="translate(-2 -4) scale(.78)">${inner}</g>`;

    let body;
    switch (kind) {
      case 'clear': body = day ? sun : moon; break;
      case 'partly': body = small(day ? sun : moon) + cloud('#E2E8F0', 6); break;
      case 'cloud': body = cloud('#CBD5E1'); break;
      case 'fog': body = fog; break;
      case 'drizzle':
      case 'rain': body = cloud('#CBD5E1', -4) + rain; break;
      case 'snow': body = cloud('#E2E8F0', -4) + snow; break;
      case 'storm': body = cloud('#94A3B8', -6) + bolt; break;
      default: body = cloud();
    }
    return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
  }

  /* ---------- Durum ---------- */
  const today0 = new Date();
  const seedTasks = () => [
    { id: uid(), title: 'Sabah koşusu — 5 km', category: 'outdoor', priority: 'medium', due: iso(today0), done: false },
    { id: uid(), title: 'Portföy sitesini GitHub\'a yükle', category: 'indoor', priority: 'high', due: iso(today0), done: false },
    { id: uid(), title: 'JavaScript algoritma pratiği', category: 'indoor', priority: 'medium', due: iso(addDays(today0, 1)), done: false },
    { id: uid(), title: 'Pazar alışverişi', category: 'outdoor', priority: 'low', due: iso(addDays(today0, 2)), done: false },
    { id: uid(), title: 'Hafta sonu bisiklet turu', category: 'outdoor', priority: 'low', due: iso(addDays(today0, 4)), done: false },
    { id: uid(), title: 'CV\'yi güncelle', category: 'indoor', priority: 'high', due: '', done: true },
  ];

  const state = {
    place: load(KEYS.place, DEFAULT_PLACE),
    wx: null,
    tasks: load(KEYS.tasks, null) || seedTasks(),
    filter: 'all',
    cat: 'all',
    query: '',
  };
  const persist = () => save(KEYS.tasks, state.tasks);
  persist();

  /* ---------- DOM ---------- */
  const el = {
    today: $('#today'), wxBody: $('#wxBody'),
    searchForm: $('#searchForm'), cityInput: $('#cityInput'), suggestions: $('#suggestions'), locateBtn: $('#locateBtn'),
    list: $('#taskList'), form: $('#taskForm'), title: $('#taskTitle'), prio: $('#taskPriority'), due: $('#taskDue'),
    taskSearch: $('#taskSearch'), clearDone: $('#clearDone'), footInfo: $('#footInfo'),
    progressText: $('#progressText'), ringFg: $('#ringFg'), ringPct: $('#ringPct'),
    cAll: $('#cAll'), cActive: $('#cActive'), cDone: $('#cDone'), toast: $('#toast'),
  };

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2400);
  }

  /* ==========================================================
     HAVA DURUMU
     ========================================================== */
  async function fetchWeather() {
    const { lat, lon } = state.place;
    const url =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${lat}&longitude=${lon}` +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day' +
      '&hourly=temperature_2m,weather_code,precipitation_probability' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
      '&timezone=auto&forecast_days=7&wind_speed_unit=kmh';

    renderWeatherSkeleton();
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      state.wx = await res.json();
      renderWeather();
      renderTasks();
    } catch (err) {
      console.error(err);
      state.wx = null;
      renderWeatherError();
      renderTasks();
    }
  }

  function renderWeatherSkeleton() {
    el.wxBody.innerHTML = '<div class="skeleton hero-skel"></div><div class="skeleton row-skel"></div><div class="skeleton row-skel"></div>';
  }

  function renderWeatherError() {
    el.wxBody.innerHTML =
      '<div class="error-box"><strong>Hava durumu alınamadı</strong>İnternet bağlantını kontrol edip tekrar dene.<br /><br /><button class="btn-ghost" id="retryBtn" type="button">Yeniden dene</button></div>';
    $('#retryBtn').addEventListener('click', fetchWeather);
  }

  const dayBad = (i) => {
    const d = state.wx.daily;
    return WET.has(kindOf(d.weather_code[i])) || (d.precipitation_probability_max[i] ?? 0) >= 60 ||
      d.temperature_2m_max[i] >= 36 || d.temperature_2m_min[i] <= -5;
  };

  function buildAdvice() {
    const c = state.wx.current;
    const kind = kindOf(c.weather_code);
    const outdoorOpen = state.tasks.filter((t) => t.category === 'outdoor' && !t.done).length;
    const todayStr = iso(new Date());
    const outdoorToday = state.tasks.filter((t) => t.category === 'outdoor' && !t.done && t.due && t.due <= todayStr).length;
    const suffix = outdoorToday
      ? ` Bugün için ${outdoorToday} dış mekan görevin var.`
      : outdoorOpen ? ` ${outdoorOpen} açık dış mekan görevin var.` : '';

    if (kind === 'storm') return { tone: 'bad', title: 'Fırtına uyarısı', text: 'Dışarı çıkmaktan kaçın, dış mekan görevlerini ertele.' + suffix };
    if (WET.has(kind)) return { tone: 'bad', title: 'Dış mekan için uygun değil', text: 'Yağış var; açık hava görevlerini ileri bir güne almayı düşün.' + suffix };
    if (c.wind_speed_10m >= 40) return { tone: 'warn', title: 'Rüzgâr kuvvetli', text: 'Dışarıdaki görevlerde dikkatli ol.' + suffix };
    if (c.temperature_2m >= 34) return { tone: 'warn', title: 'Çok sıcak', text: 'Dış mekan görevlerini sabah erken ya da akşama planla.' + suffix };
    if (c.temperature_2m <= 0) return { tone: 'warn', title: 'Dondurucu soğuk', text: 'Kalın giyin; mümkünse görevleri iç mekana kaydır.' + suffix };
    return { tone: 'ok', title: 'Dışarısı görev yapmaya uygun', text: 'Hava dış mekan görevleri için ideal görünüyor.' + suffix };
  }

  function renderWeather() {
    const w = state.wx;
    const c = w.current;
    const kind = kindOf(c.weather_code);
    const day = c.is_day === 1;

    document.body.dataset.sky = `${fxGroup(kind)}-${day ? 'day' : 'night'}`;
    document.body.dataset.kind = fxGroup(kind);

    // Saatlik: şu andan itibaren 12 saat
    const nowKey = c.time.slice(0, 13) + ':00';
    let start = w.hourly.time.findIndex((t) => t >= nowKey);
    if (start < 0) start = 0;
    const hours = [];
    for (let i = start; i < Math.min(start + 12, w.hourly.time.length); i++) {
      const hh = Number(w.hourly.time[i].slice(11, 13));
      const hDay = hh >= 6 && hh < 20;
      const p = w.hourly.precipitation_probability[i];
      hours.push(`
        <div class="hour">
          <small>${i === start ? 'Şimdi' : pad(hh) + ':00'}</small>
          ${icon(kindOf(w.hourly.weather_code[i]), hDay)}
          <b>${Math.round(w.hourly.temperature_2m[i])}°</b>
          <em>${p >= 20 ? '💧' + p + '%' : ''}</em>
        </div>`);
    }

    const days = w.daily.time.map((t, i) => {
      const d = parseISO(t);
      return `
        <div class="day${i === 0 ? ' is-today' : ''}">
          <small>${i === 0 ? 'Bugün' : esc(dayFmt.format(d))}</small>
          ${icon(kindOf(w.daily.weather_code[i]), true)}
          <b>${Math.round(w.daily.temperature_2m_max[i])}°</b>
          <span>${Math.round(w.daily.temperature_2m_min[i])}°</span>
        </div>`;
    });

    const adv = buildAdvice();
    const place = state.place;

    el.wxBody.innerHTML = `
      <div class="wx-hero">
        <div>
          <p class="wx-place">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/></svg>
            ${esc(place.name)}${place.country ? `<span style="color:var(--faint);font-weight:500">, ${esc(place.country)}</span>` : ''}
          </p>
          <div class="wx-temp">${Math.round(c.temperature_2m)}<sup>°C</sup></div>
          <p class="wx-desc">${esc(LABELS[c.weather_code] || 'Bilinmiyor')}</p>
        </div>
        <div class="wx-icon">${icon(kind, day)}</div>
      </div>

      <div class="metrics">
        <div class="metric"><span>Hissedilen</span><strong>${Math.round(c.apparent_temperature)}°</strong></div>
        <div class="metric"><span>Nem</span><strong>%${Math.round(c.relative_humidity_2m)}</strong></div>
        <div class="metric"><span>Rüzgâr</span><strong>${Math.round(c.wind_speed_10m)} km/s</strong></div>
      </div>

      <div class="advice" data-tone="${adv.tone}">
        <span class="dot"></span>
        <div><strong>${esc(adv.title)}</strong><p>${esc(adv.text)}</p></div>
      </div>

      <h3 class="block-title">Saatlik tahmin</h3>
      <div class="hourly">${hours.join('')}</div>

      <h3 class="block-title">7 günlük tahmin</h3>
      <div class="daily">${days.join('')}</div>`;
  }

  /* ---------- Şehir arama (Open-Meteo Geocoding) ---------- */
  let suggestItems = [];
  let activeSuggest = -1;

  const hideSuggest = () => { el.suggestions.hidden = true; el.suggestions.innerHTML = ''; suggestItems = []; activeSuggest = -1; };

  function showSuggest(items) {
    suggestItems = items;
    activeSuggest = -1;
    if (!items.length) { hideSuggest(); return; }
    el.suggestions.innerHTML = items.map((p, i) =>
      `<li role="option" data-i="${i}"><span>${esc(p.name)}</span><small>${esc([p.admin1, p.country].filter(Boolean).join(', '))}</small></li>`).join('');
    el.suggestions.hidden = false;
  }

  const searchCities = debounce(async (q) => {
    if (q.length < 2) { hideSuggest(); return; }
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=tr&format=json`);
      const data = await res.json();
      showSuggest(data.results || []);
    } catch { hideSuggest(); }
  }, 300);

  function selectPlace(p) {
    state.place = { name: p.name, country: p.country || '', lat: p.latitude ?? p.lat, lon: p.longitude ?? p.lon };
    save(KEYS.place, state.place);
    el.cityInput.value = '';
    hideSuggest();
    fetchWeather();
  }

  el.cityInput.addEventListener('input', (e) => searchCities(e.target.value.trim()));
  el.cityInput.addEventListener('keydown', (e) => {
    if (el.suggestions.hidden) return;
    const items = $$('li', el.suggestions);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      activeSuggest = (activeSuggest + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.setAttribute('aria-selected', String(i === activeSuggest)));
    } else if (e.key === 'Escape') hideSuggest();
  });
  el.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pick = suggestItems[activeSuggest >= 0 ? activeSuggest : 0];
    if (pick) selectPlace(pick);
  });
  el.suggestions.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (li) selectPlace(suggestItems[Number(li.dataset.i)]);
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search-field')) hideSuggest(); });

  el.locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Tarayıcın konum özelliğini desteklemiyor'); return; }
    toast('Konum alınıyor…');
    navigator.geolocation.getCurrentPosition(
      (pos) => selectPlace({ name: 'Konumum', country: '', lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => toast('Konum izni verilmedi'),
      { timeout: 10000 }
    );
  });

  /* ==========================================================
     GÖREVLER
     ========================================================== */
  const PRIO = { high: 3, medium: 2, low: 1 };
  const PRIO_LABEL = { high: 'Yüksek', medium: 'Orta', low: 'Düşük' };

  function visibleTasks() {
    const q = state.query.toLowerCase();
    return state.tasks
      .filter((t) => (state.filter === 'all' ? true : state.filter === 'done' ? t.done : !t.done))
      .filter((t) => (state.cat === 'all' ? true : t.category === state.cat))
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .sort((a, b) =>
        Number(a.done) - Number(b.done) ||
        (a.due || '9999') .localeCompare(b.due || '9999') ||
        PRIO[b.priority] - PRIO[a.priority]);
  }

  function weatherChip(t) {
    if (!state.wx || !t.due || t.done) return '';
    const idx = state.wx.daily.time.indexOf(t.due);
    if (idx < 0) return '';
    const d = state.wx.daily;
    const k = kindOf(d.weather_code[idx]);
    const temp = `${Math.round(d.temperature_2m_max[idx])}°/${Math.round(d.temperature_2m_min[idx])}°`;
    const bad = dayBad(idx);
    if (t.category === 'outdoor') {
      return bad
        ? `<span class="tag bad" title="O gün hava dış mekan için uygun değil">${icon(k, true)} ${temp} · Uygun değil</span>`
        : `<span class="tag ok" title="O gün hava dış mekan için uygun">${icon(k, true)} ${temp} · Uygun</span>`;
    }
    return `<span class="tag">${icon(k, true)} ${temp}</span>`;
  }

  function dueChip(t) {
    if (!t.due) return '';
    const todayStr = iso(new Date());
    let cls = '', label;
    if (t.due === todayStr) { label = 'Bugün'; cls = 'warn'; }
    else if (t.due === iso(addDays(new Date(), 1))) label = 'Yarın';
    else label = shortDate.format(parseISO(t.due));
    if (t.due < todayStr && !t.done) { label = 'Gecikmiş · ' + shortDate.format(parseISO(t.due)); cls = 'bad'; }
    return `<span class="tag ${cls}">📅 ${esc(label)}</span>`;
  }

  function taskHTML(t) {
    return `
      <li class="task${t.done ? ' is-done' : ''}" data-id="${t.id}" data-priority="${t.priority}">
        <button class="check" data-act="toggle" aria-label="${t.done ? 'Tamamlandı işaretini kaldır' : 'Tamamlandı olarak işaretle'}" aria-pressed="${t.done}">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/></svg>
        </button>
        <div class="task-main">
          <div class="task-title" data-act="edit" title="Düzenlemek için çift tıkla">${esc(t.title)}</div>
          <div class="meta">
            <span class="tag">${t.category === 'outdoor' ? '🌳 Dış mekan' : '🏠 İç mekan'}</span>
            <span class="tag">${PRIO_LABEL[t.priority]} öncelik</span>
            ${dueChip(t)}
            ${weatherChip(t)}
          </div>
        </div>
        <div class="row-actions">
          <button class="mini" data-act="edit" aria-label="Düzenle" title="Düzenle">
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/></svg>
          </button>
          <button class="mini del" data-act="delete" aria-label="Sil" title="Sil">
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>
          </button>
        </div>
      </li>`;
  }

  function renderStats() {
    const total = state.tasks.length;
    const done = state.tasks.filter((t) => t.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    el.cAll.textContent = total;
    el.cDone.textContent = done;
    el.cActive.textContent = total - done;
    el.progressText.textContent = `${done} / ${total} tamamlandı`;
    el.ringPct.textContent = pct + '%';
    el.ringFg.style.strokeDashoffset = String(163.36 * (1 - pct / 100));
    el.clearDone.disabled = done === 0;
  }

  function renderTasks() {
    const items = visibleTasks();
    if (!items.length) {
      const hasAny = state.tasks.length > 0;
      el.list.innerHTML = `
        <li class="empty">
          <span class="emoji">${hasAny ? '🔍' : '🌤️'}</span>
          <strong>${hasAny ? 'Eşleşen görev yok' : 'Henüz görev yok'}</strong>
          ${hasAny ? 'Filtreleri veya aramayı değiştirmeyi dene.' : 'Yukarıdan ilk görevini ekle.'}
        </li>`;
    } else {
      el.list.innerHTML = items.map(taskHTML).join('');
    }
    el.footInfo.textContent = `${items.length} görev gösteriliyor`;
    renderStats();
    if (state.wx) updateAdviceOnly();
  }

  // Görev değişince hava kartındaki öneri metnini (sayılar) güncelle
  function updateAdviceOnly() {
    const box = $('.advice', el.wxBody);
    if (!box) return;
    const adv = buildAdvice();
    box.dataset.tone = adv.tone;
    $('strong', box).textContent = adv.title;
    $('p', box).textContent = adv.text;
  }

  /* ---------- Görev işlemleri ---------- */
  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = el.title.value.trim();
    if (!title) return;
    const cat = new FormData(el.form).get('cat');
    state.tasks.unshift({ id: uid(), title, category: cat, priority: el.prio.value, due: el.due.value, done: false });
    persist();
    el.title.value = '';
    el.due.value = '';
    renderTasks();
    toast('Görev eklendi');

    // Dış mekan görevi için o günün havası uygun değilse uyar
    if (cat === 'outdoor' && state.wx && state.tasks[0].due) {
      const idx = state.wx.daily.time.indexOf(state.tasks[0].due);
      if (idx >= 0 && dayBad(idx)) setTimeout(() => toast('⚠️ O gün hava dış mekan için uygun görünmüyor'), 2600);
    }
  });

  el.list.addEventListener('click', (e) => {
    const target = e.target.closest('[data-act]');
    const li = e.target.closest('.task');
    if (!target || !li) return;
    const id = li.dataset.id;
    const act = target.dataset.act;

    if (act === 'toggle') {
      const t = state.tasks.find((x) => x.id === id);
      t.done = !t.done;
      persist(); renderTasks();
    } else if (act === 'delete') {
      li.classList.add('is-removing');
      setTimeout(() => {
        state.tasks = state.tasks.filter((x) => x.id !== id);
        persist(); renderTasks(); toast('Görev silindi');
      }, 220);
    } else if (act === 'edit' && target.classList.contains('mini')) {
      startEdit(li);
    }
  });
  el.list.addEventListener('dblclick', (e) => {
    const li = e.target.closest('.task');
    if (li && e.target.closest('.task-title')) startEdit(li);
  });

  function startEdit(li) {
    const id = li.dataset.id;
    const t = state.tasks.find((x) => x.id === id);
    const titleEl = $('.task-title', li);
    if (!t || !titleEl || $('.edit-input', li)) return;

    const input = document.createElement('input');
    input.className = 'edit-input';
    input.type = 'text';
    input.maxLength = 90;
    input.value = t.title;
    input.setAttribute('aria-label', 'Görev başlığını düzenle');
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    let finished = false;
    const finish = (commit) => {
      if (finished) return;
      finished = true;
      const v = input.value.trim();
      if (commit && v && v !== t.title) { t.title = v; persist(); toast('Görev güncellendi'); }
      renderTasks();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
  }

  /* ---------- Filtreler ---------- */
  $$('.tab').forEach((btn) => btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    $$('.tab').forEach((b) => { const on = b === btn; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', String(on)); });
    renderTasks();
  }));
  $$('.chip').forEach((btn) => btn.addEventListener('click', () => {
    state.cat = btn.dataset.cat;
    $$('.chip').forEach((b) => b.classList.toggle('is-active', b === btn));
    renderTasks();
  }));
  el.taskSearch.addEventListener('input', debounce((e) => { state.query = e.target.value.trim(); renderTasks(); }, 120));

  el.clearDone.addEventListener('click', () => {
    const n = state.tasks.filter((t) => t.done).length;
    if (!n) return;
    state.tasks = state.tasks.filter((t) => !t.done);
    persist(); renderTasks();
    toast(`${n} tamamlanan görev temizlendi`);
  });

  /* ---------- Başlat ---------- */
  function init() {
    el.today.textContent = longFmt.format(new Date());
    el.today.dateTime = iso(new Date());
    el.due.min = iso(new Date());
    renderTasks();
    fetchWeather();
    setInterval(fetchWeather, REFRESH_MS);
  }
  init();
})();
