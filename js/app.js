/* DevQuiz — logique de l'application */
(() => {
'use strict';

/* ───────── Utilitaires ───────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem('dq_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('dq_' + k, JSON.stringify(v)); } catch { /* stockage indisponible */ } }
};
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ───────── Notions et packs de questions ───────── */
const TH = Object.fromEntries(THEMES.map(t => [t.id, t]));
const GROUPS = [...new Set(THEMES.map(t => t.category))];
const ready = id => !!(typeof PACKS !== 'undefined' && PACKS[id]);
const packSize = (id, open) => ready(id) ? PACKS[id].m + (open ? PACKS[id].o : 0) : 0;
const bank = {};
const loading = {};

function loadPack(id) {
  if (bank[id]) return Promise.resolve(true);
  if (loading[id]) return loading[id];
  loading[id] = new Promise(resolve => {
    const before = Q.length, s = document.createElement('script');
    s.src = `js/questions/${id}.js`;
    s.onload = () => {
      const b = { m: [], o: [] };
      for (let i = before; i < Q.length; i++) { const q = Q[i]; q.id = hash(id + '|' + q.q); (q.t === 'm' ? b.m : b.o).push(q); }
      bank[id] = b; resolve(true);
    };
    s.onerror = () => { delete loading[id]; resolve(false); };
    document.head.appendChild(s);
  });
  return loading[id];
}

/* ───────── Réglages ───────── */
const defCfg = { cats: ['html', 'css', 'javascript', 'php'], n: 20, open: true, timer: true, music: true, musicVol: 0.5, sfx: true, sfxVol: 0.8, vibrate: true };
const savedCfg = store.get('cfg', {});
let cfg = Object.assign({}, defCfg, savedCfg);
if (savedCfg.sound === false && savedCfg.sfx === undefined) { cfg.sfx = false; cfg.vibrate = false; }
cfg.musicVol = Math.min(1, Math.max(0, +cfg.musicVol || 0)); cfg.sfxVol = Math.min(1, Math.max(0, +cfg.sfxVol || 0));
cfg.cats = (cfg.cats || []).filter(k => TH[k] && ready(k));
if (!cfg.cats.length && !store.get('cfgTouched', false)) cfg.cats = defCfg.cats.filter(ready);
if (![10, 20, 30, 50, 100].includes(cfg.n)) cfg.n = 20;
const saveCfg = () => { store.set('cfg', cfg); store.set('cfgTouched', true); };

/* ───────── Écrans, toast ───────── */
function show(id) {
  if (id !== 'quiz') musicStop();
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  scrollTo({ top: 0, behavior: 'auto' });
  if (id === 'home') observeReveal();
}
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3400);
}

/* ───────── Sons, musique et vibrations ───────── */
let ac = null, musicBus = null, sfxBus = null;
function audio() {
  if (!ac) {
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      musicBus = ac.createGain(); sfxBus = ac.createGain();
      musicBus.connect(ac.destination); sfxBus.connect(ac.destination);
      applyVolumes();
    } catch { ac = null; }
  }
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}
const musicLevel = () => (cfg.music ? cfg.musicVol * 0.35 : 0);
function applyVolumes() {
  if (!ac) return;
  musicBus.gain.setTargetAtTime(mus.on ? musicLevel() : 0, ac.currentTime, .05);
  sfxBus.gain.setTargetAtTime(cfg.sfx ? cfg.sfxVol : 0, ac.currentTime, .02);
}
function note(f, t, d, vol, type, bus) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + d + .05);
}
function tone(list) {
  if (!cfg.sfx || !audio()) return;
  const t0 = ac.currentTime;
  list.forEach(([f, t, d]) => note(f, t0 + t, d, .35, 'sine', sfxBus));
}
const buzz = p => { if (cfg.vibrate && navigator.vibrate) navigator.vibrate(p); };
function duck(ms) {
  if (!ac || !mus.on) return;
  const g = musicBus.gain, now = ac.currentTime;
  g.cancelScheduledValues(now); g.setTargetAtTime(musicLevel() * .25, now, .03); g.setTargetAtTime(musicLevel(), now + ms / 1000, .3);
}
function wah(t, f, d, bend = 1, vib = false) {
  const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t);
  if (bend !== 1) o.frequency.exponentialRampToValueAtTime(f * bend, t + d);
  lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.setValueAtTime(500, t);
  lp.frequency.linearRampToValueAtTime(1300, t + d * .35); lp.frequency.linearRampToValueAtTime(600, t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.32, t + .03);
  g.gain.setValueAtTime(.32, t + d * .8); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.5; lg.gain.value = f * .012; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d + .05); }
  o.connect(lp); lp.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + d + .05);
}
function defeatShort() {
  if (!cfg.sfx || !audio()) return;
  const t = ac.currentTime; duck(1500);
  wah(t, 311, .2); wah(t + .22, 293.7, .2); wah(t + .44, 277.2, .65, .93, true);
}
function defeatLong() {
  if (!cfg.sfx || !audio()) return;
  const t = ac.currentTime + .15; duck(2800);
  wah(t, 392, .34); wah(t + .37, 370, .34); wah(t + .74, 349, .34); wah(t + 1.11, 330, 1.2, .9, true);
  note(98, t + 1.11, 1.2, .3, 'sine', sfxBus);
}
function victory() {
  if (!cfg.sfx || !audio()) return;
  duck(1800); tone([[523, 0, .15], [659, .14, .15], [784, .28, .15], [1047, .42, .5]]);
}

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const PAT = [
  { mel: [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 81, 84, 81, 79, 76, 74], bass: [48, 45, 41, 43] },
  { mel: [72, 76, 79, 76, 74, 77, 81, 77, 71, 74, 79, 74, 72, 76, 79, 0], bass: [45, 50, 43, 48] }
];
const STEP = 60 / 116 / 2;
const mus = { on: false, step: 0, next: 0, timer: 0 };
function musicTick() {
  if (!mus.on || !ac) return;
  while (mus.next < ac.currentTime + .4) {
    const p = PAT[Math.floor(mus.step / 16) % 2], i = mus.step % 16;
    if (p.mel[i]) note(mtof(p.mel[i]), mus.next, STEP * .85, .5, 'triangle', musicBus);
    if (i % 4 === 0) note(mtof(p.bass[i / 4]), mus.next, STEP * 3.4, .6, 'sine', musicBus);
    mus.next += STEP; mus.step++;
  }
}
function musicStart() {
  if (mus.on || !cfg.music || !audio()) return;
  mus.on = true; mus.step = 0; mus.next = ac.currentTime + .1;
  musicBus.gain.cancelScheduledValues(ac.currentTime); applyVolumes();
  mus.timer = setInterval(musicTick, 100); musicTick();
}
function musicStop() {
  if (!mus.on) return;
  mus.on = false; clearInterval(mus.timer);
  if (ac) { musicBus.gain.cancelScheduledValues(ac.currentTime); musicBus.gain.setTargetAtTime(0, ac.currentTime, .06); }
}
function syncMusic() {
  const inQuiz = $('#quiz').classList.contains('active');
  if (cfg.music && inQuiz) musicStart(); else if (!(preview && mus.on)) musicStop();
  applyVolumes(); updMusicBtn();
}
let preview = false, previewT = 0;
function previewMusic() {
  if (mus.on) { preview = false; clearTimeout(previewT); musicStop(); return; }
  if (!cfg.music) { toast('Activez d\'abord la musique.'); return; }
  preview = true; musicStart(); clearTimeout(previewT);
  previewT = setTimeout(() => { preview = false; if (!$('#quiz').classList.contains('active')) musicStop(); }, 9000);
}
function updMusicBtn() {
  const b = $('#musicBtn'); if (!b) return;
  b.classList.toggle('off', !cfg.music); b.setAttribute('aria-pressed', String(!!cfg.music));
  b.title = cfg.music ? 'Couper la musique' : 'Activer la musique';
}
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend().catch(() => {}); else ac.resume().catch(() => {});
});

/* ───────── Effets : confettis ───────── */
const fx = $('#fx'), fctx = fx.getContext('2d');
let sparks = [], fxRun = false;
function fxResize() { fx.width = innerWidth; fx.height = innerHeight; }
function burst(x, y, n = 36, colors = ['#8b7cff', '#ffb454', '#3ddc97', '#b3a9ff']) {
  if (reduce) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 7;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, r: 2 + Math.random() * 3.5, c: colors[rnd(colors.length)], l: 1, rot: Math.random() * 6 });
  }
  if (!fxRun) { fxRun = true; requestAnimationFrame(fxLoop); }
}
function fxLoop() {
  fctx.clearRect(0, 0, fx.width, fx.height);
  sparks = sparks.filter(p => p.l > 0);
  sparks.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += .26; p.vx *= .985; p.l -= .014; p.rot += .2;
    fctx.save(); fctx.globalAlpha = Math.max(p.l, 0); fctx.translate(p.x, p.y); fctx.rotate(p.rot);
    fctx.fillStyle = p.c; fctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); fctx.restore();
  });
  if (sparks.length) requestAnimationFrame(fxLoop); else { fxRun = false; fctx.clearRect(0, 0, fx.width, fx.height); }
}
function bigBurst() { [0.2, 0.5, 0.8].forEach((f, i) => setTimeout(() => burst(innerWidth * f, innerHeight * .35, 60), i * 220)); }

/* ───────── Fond animé ───────── */
const bg = $('#bg'), bx = bg.getContext('2d');
let W, H, DPR = 1, parts = [], mx = 0, my = 0;
const SYM = ['{ }', '</>', '=>', '()', '[]', '&&', '$', 'SELECT', 'git', '404', '200', '::', '<?php', 'div', '#id', '.css', 'fn', '++', 'async', 'JSON'];
function bgInit() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  W = bg.width = innerWidth * DPR; H = bg.height = innerHeight * DPR;
  const n = Math.max(16, Math.min(46, Math.round(innerWidth * innerHeight / 38000)));
  parts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, z: .3 + Math.random() * .9, s: SYM[rnd(SYM.length)], v: .08 + Math.random() * .22, ph: Math.random() * 6.28 }));
  if (reduce) bgDraw(0);
}
function bgDraw(t) {
  bx.clearRect(0, 0, W, H);
  const ox = (mx - W / 2) * .02, oy = (my - H / 2) * .02;
  bx.textAlign = 'center';
  parts.forEach(p => {
    if (!reduce) { p.y -= p.v * p.z * DPR; p.x += Math.sin(t / 2200 + p.ph) * .25 * DPR; if (p.y < -30) { p.y = H + 30; p.x = Math.random() * W; } }
    p.dx = p.x + ox * p.z * 4; p.dy = p.y + oy * p.z * 4;
    bx.font = `${Math.round(13 * p.z * DPR + 4)}px ui-monospace,Consolas,monospace`;
    bx.fillStyle = `rgba(160,150,255,${(.12 + p.z * .16).toFixed(2)})`;
    bx.fillText(p.s, p.dx, p.dy);
  });
  const max = 150 * DPR; bx.lineWidth = DPR;
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    const a = parts[i], b = parts[j], d = Math.hypot(a.dx - b.dx, a.dy - b.dy);
    if (d < max) { bx.strokeStyle = `rgba(139,124,255,${((1 - d / max) * .16).toFixed(3)})`; bx.beginPath(); bx.moveTo(a.dx, a.dy); bx.lineTo(b.dx, b.dy); bx.stroke(); }
  }
}
function bgLoop(t) { if (!document.hidden) bgDraw(t); requestAnimationFrame(bgLoop); }

/* ───────── Curseur, inclinaison 3D, révélations ───────── */
if (matchMedia('(pointer:fine)').matches && !reduce) {
  document.documentElement.classList.add('has-cursor');
  const dot = $('#cur-dot'), ring = $('#cur-ring'); let rx = 0, ry = 0, tx = 0, ty = 0;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX; ty = e.clientY; dot.style.transform = `translate(${tx}px,${ty}px)`;
    ring.classList.toggle('hov', !!e.target.closest('button,a,input,label,.cat'));
  });
  (function follow() { rx += (tx - rx) * .18; ry += (ty - ry) * .18; ring.style.transform = `translate(${rx}px,${ry}px)`; requestAnimationFrame(follow); })();
}
let tiltEl = null;
const tiltReset = el => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); };
addEventListener('pointermove', e => {
  mx = e.clientX * DPR; my = e.clientY * DPR;
  if (e.pointerType !== 'mouse' || reduce) return;
  const t = e.target.closest ? e.target.closest('.tilt, .cat') : null;
  if (tiltEl && tiltEl !== t) tiltReset(tiltEl);
  tiltEl = t; if (!t) return;
  const r = t.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
  const m = +t.dataset.max || (t.classList.contains('cat') ? 12 : 6);
  t.style.setProperty('--ry', ((px - .5) * 2 * m).toFixed(2) + 'deg');
  t.style.setProperty('--rx', ((.5 - py) * 2 * m).toFixed(2) + 'deg');
  t.style.setProperty('--mx', (px * 100).toFixed(0) + '%');
  t.style.setProperty('--my', (py * 100).toFixed(0) + '%');
});
document.addEventListener('pointerleave', () => { if (tiltEl) tiltReset(tiltEl); });
let io;
function observeReveal() {
  if (!('IntersectionObserver' in window)) { $$('.reveal').forEach(e => e.classList.add('vis')); return; }
  io = io || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }), { threshold: .12 });
  $$('.reveal:not(.vis)').forEach(e => io.observe(e));
}

/* ───────── Accueil ───────── */
const selTotal = () => cfg.cats.reduce((n, k) => n + packSize(k, cfg.open), 0);
const searchNorm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* ═══════════════════════════════════════════════
   Liste déroulante des 7 catégories
   ═══════════════════════════════════════════════ */
const CATEGORIES_ORDER = ['Langages', 'Frameworks', 'Bases de données', 'Outils', 'Web & API', 'Sécurité', 'Cloud'];
let activeCategory = 'Langages';

function buildCatMenu() {
  const menu = $('#catMenu');
  if (!menu) return;
  menu.innerHTML = '';

  CATEGORIES_ORDER.forEach(catName => {
    const themesInCat = THEMES.filter(t => t.category === catName && ready(t.id));
    if (!themesInCat.length) return;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'cat-menu-item' + (catName === activeCategory ? ' active' : '');
    item.dataset.cat = catName;
    const selCount = themesInCat.filter(t => cfg.cats.includes(t.id)).length;
    item.innerHTML = `<span>${catName}</span><span class="count">${selCount}/${themesInCat.length}</span>`;
    item.onclick = () => {
      activeCategory = catName;
      const label = $('#catToggleLabel'); if (label) label.textContent = catName;
      closeCatMenu();
      applyCategoryFilter();
    };
    menu.appendChild(item);
  });
}

function applyCategoryFilter() {
  // Affiche uniquement la catégorie active
  $$('#cats .grp').forEach(sec => {
    sec.hidden = sec.dataset.g !== activeCategory;
  });
  // Met à jour l'état actif dans le menu
  $$('.cat-menu-item').forEach(it => {
    it.classList.toggle('active', it.dataset.cat === activeCategory);
  });
}

function openCatMenu() {
  const menu = $('#catMenu');
  const toggle = $('#catToggle');
  if (!menu || !toggle) return;
  menu.classList.remove('hidden');
  toggle.classList.add('active');
  toggle.setAttribute('aria-expanded', 'true');
}

function closeCatMenu() {
  $('#catMenu').classList.add('hidden');
  $('#catToggle').classList.remove('active');
  $('#catToggle').setAttribute('aria-expanded', 'false');
}

/* Chips des notions sélectionnées (en haut) */
function renderSelectedNotions() {
  const box = $('#selectedNotions');
  if (!box) return;
  box.innerHTML = '';

  cfg.cats.forEach(id => {
    const theme = THEMES.find(t => t.id === id);
    if (!theme) return;
    const chip = document.createElement('span');
    chip.className = 'notion-chip';

    const label = document.createElement('span');
    label.textContent = theme.name;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.setAttribute('aria-label', `Retirer ${theme.name}`);
    remove.textContent = '×';
    remove.onclick = () => {
      cfg.cats = cfg.cats.filter(x => x !== id);
      saveCfg();
      syncCats();
      renderSelectedNotions();
      buildCatMenu();
      refreshHome();
    };

    chip.append(label, remove);
    box.appendChild(chip);
  });
}

/* ═══════════════════════════════════════════════
   Rendu des cartes de notions
   ═══════════════════════════════════════════════ */
function renderCats() {
  const box = $('#cats'); box.innerHTML = '';
  GROUPS.forEach(g => {
    const list = THEMES.filter(t => t.category === g);
    const sec = document.createElement('section'); sec.className = 'grp'; sec.dataset.g = g;
    sec.innerHTML = '<div class="grp-h"><h3></h3><button class="link" type="button"></button></div><div class="cats"></div>';
    $('h3', sec).textContent = g;
    const grid = $('.cats', sec);
    list.forEach(t => {
      const on = cfg.cats.includes(t.id), rdy = ready(t.id);
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.k = t.id; b.dataset.s = searchNorm(t.name + ' ' + t.id + ' ' + g);
      b.className = 'cat' + (on ? ' on' : '') + (rdy ? '' : ' soon');
      b.setAttribute('aria-pressed', String(on)); if (!rdy) b.setAttribute('aria-disabled', 'true');
      const ic = document.createElement('span'); ic.className = 'ic';
      const img = createThemeIcon(t); if (img) ic.appendChild(img); else ic.textContent = '◆';
      const name = document.createElement('b'); name.textContent = t.name;
      const sub = document.createElement('small'); sub.textContent = rdy ? '' : 'Bientôt';
      const ck = document.createElement('span'); ck.className = 'ck'; ck.textContent = '✓';
      b.append(ck, ic, name, sub);
      b.onclick = () => {
        if (!rdy) { toast(`${t.name} : les questions arrivent bientôt.`); return; }
        // Ajout en DÉBUT de la liste pour remonter en premier
        if (cfg.cats.includes(t.id)) {
          cfg.cats = cfg.cats.filter(x => x !== t.id);
        } else {
          cfg.cats = [t.id, ...cfg.cats];
        }
        b.classList.toggle('on', cfg.cats.includes(t.id));
        b.setAttribute('aria-pressed', String(cfg.cats.includes(t.id)));
        saveCfg();
        renderSelectedNotions();
        buildCatMenu();
        refreshHome();
      };
      grid.appendChild(b);
    });
    $('.link', sec).onclick = () => {
      const ids = list.filter(t => ready(t.id)).map(t => t.id); if (!ids.length) return;
      const all = ids.every(k => cfg.cats.includes(k));
      if (all) {
        cfg.cats = cfg.cats.filter(k => !ids.includes(k));
      } else {
        cfg.cats = [...ids.filter(k => !cfg.cats.includes(k)), ...cfg.cats];
      }
      saveCfg();
      syncCats();
      renderSelectedNotions();
      buildCatMenu();
      refreshHome();
    };
    box.appendChild(sec);
  });
  filterCats();
  applyCategoryFilter();
}

function syncCats() {
  $$('.cat').forEach(b => {
    const on = cfg.cats.includes(b.dataset.k);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  renderSelectedNotions();
  buildCatMenu();
}

function filterCats() {
  const q = searchNorm($('#search').value.trim());
  $$('#cats .grp').forEach(sec => {
    let vis = 0;
    $$('.cat', sec).forEach(b => { const hit = !q || b.dataset.s.includes(q); b.hidden = !hit; if (hit) vis++; });
    sec.hidden = vis === 0;
  });
  // Le noRes doit dépendre du filtre de catégorie ET de la recherche
  const anyVisible = $$('#cats .grp').some(s => !s.hidden);
  const noResEl = $('#noRes');
  if (noResEl) noResEl.hidden = anyVisible;
}

function renderStats() {
  const s = store.get('stats', { games: 0, best: 0, ok: 0, tot: 0, cat: {} });
  const acc = s.tot ? Math.round(100 * s.ok / s.tot) : 0, box = $('#stats'); box.innerHTML = '';
  [[s.games, 'parties jouées'], [s.best, 'meilleur score'], [s.tot ? acc + ' %' : '—', 'bonnes réponses']].forEach(([v, l]) => {
    const d = document.createElement('div'); d.className = 'stat';
    const b = document.createElement('b'); b.textContent = String(v); const sm = document.createElement('small'); sm.textContent = l;
    d.append(b, sm); box.appendChild(d);
  });
}

function refreshHome() {
  const size = selTotal(), n = Math.min(cfg.n, size), k = cfg.cats.length, btn = $('#startBtn');
  btn.disabled = size === 0;
  btn.textContent = size === 0 ? 'Choisissez au moins une notion' : `Lancer la partie · ${n} question${n > 1 ? 's' : ''}`;
  $('#selCount').textContent = k === 0 ? 'Aucune notion sélectionnée' : `${k} notion${k > 1 ? 's' : ''} sélectionnée${k > 1 ? 's' : ''}`;
  $$('#seg button').forEach(b => b.classList.toggle('on', +b.dataset.n === cfg.n));
  // Boutons "Tout choisir" par catégorie
  $$('#cats .grp').forEach(sec => {
    const ids = THEMES.filter(t => t.category === sec.dataset.g && ready(t.id)).map(t => t.id);
    const l = $('.link', sec);
    if (!l) return;
    l.hidden = !ids.length;
    l.textContent = ids.every(x => cfg.cats.includes(x)) ? 'Tout retirer' : 'Tout choisir';
  });
  // Rafraîchir les compteurs du menu déroulant
  buildCatMenu();
}

function initHome() {
  renderCats();
  renderStats();
  buildCatMenu();
  renderSelectedNotions();

  // Bouton qui ouvre / ferme le menu déroulant
  $('#catToggle').onclick = (e) => {
    e.stopPropagation();
    const menu = $('#catMenu');
    if (menu.classList.contains('hidden')) openCatMenu();
    else closeCatMenu();
  };
  document.addEventListener('click', (e) => {
    if (!$('#catMenu').contains(e.target) && !$('#catToggle').contains(e.target)) {
      closeCatMenu();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#catMenu').classList.contains('hidden')) {
      closeCatMenu();
      $('#catToggle').focus();
    }
  });

  $('#search').addEventListener('input', filterCats);

  $$('#seg button').forEach(b => b.onclick = () => { cfg.n = +b.dataset.n; saveCfg(); refreshHome(); });

  [['optOpen', 'open'], ['optTimer', 'timer'], ['optMusic', 'music'], ['optSfx', 'sfx'], ['optVibrate', 'vibrate']].forEach(([id, key]) => {
    const el = $('#' + id); el.checked = !!cfg[key];
    el.onchange = () => {
      cfg[key] = el.checked; saveCfg(); refreshHome();
      if (key === 'music') syncMusic();
      if (key === 'sfx') { applyVolumes(); if (el.checked) tone([[660, 0, .12], [880, .1, .15]]); }
      if (key === 'vibrate' && el.checked) buzz(40);
    };
  });

  [['volMusic', 'musicVol'], ['volSfx', 'sfxVol']].forEach(([id, key]) => {
    const el = $('#' + id); el.value = Math.round(cfg[key] * 100);
    el.oninput = () => { cfg[key] = el.value / 100; applyVolumes(); };
    el.onchange = () => { saveCfg(); if (key === 'sfxVol') tone([[660, 0, .12]]); };
  });

  $('#tMusic').onclick = previewMusic;
  $('#tWin').onclick = () => { if (!cfg.sfx) toast('Activez d\'abord les effets sonores.'); victory(); };
  $('#tLose').onclick = () => { if (!cfg.sfx) toast('Activez d\'abord les effets sonores.'); defeatLong(); };
  $('#musicBtn').onclick = () => {
    cfg.music = !cfg.music; saveCfg(); $('#optMusic').checked = cfg.music; syncMusic();
  };

  updMusicBtn();
  refreshHome();
  observeReveal();
}

/* ───────── Tirage des questions ───────── */
function buildRun() {
  const seen = new Set(store.get('seen', []));
  const mkQueue = list => {
    let fresh = list.filter(q => !seen.has(q.id));
    if (!fresh.length) { list.forEach(q => seen.delete(q.id)); fresh = list.slice(); }
    const rest = list.filter(q => !fresh.includes(q));
    return shuffle(fresh).concat(shuffle(rest));
  };
  const pools = shuffle(cfg.cats.filter(k => bank[k])).map(k => ({ k, m: mkQueue(bank[k].m), o: cfg.open ? mkQueue(bank[k].o) : [] }))
    .filter(p => p.m.length || p.o.length);
  const total = pools.reduce((n, p) => n + p.m.length + p.o.length, 0), N = Math.min(cfg.n, total), picked = [];
  let i = 0;
  while (picked.length < N && pools.length) {
    const p = pools[i % pools.length];
    const wantOpen = cfg.open && Math.random() < .2;
    const q = (wantOpen ? (p.o.shift() || p.m.shift()) : (p.m.shift() || p.o.shift()));
    if (q) { picked.push(q); seen.add(q.id); }
    if (!p.m.length && !p.o.length) pools.splice(i % pools.length, 1); else i++;
  }
  store.set('seen', [...seen]);
  const qs = shuffle(picked).map(q => q.t === 'm'
    ? Object.assign({}, q, { opts: shuffle(q.o.map((t, j) => ({ t, ok: j === 0 }))) })
    : Object.assign({}, q));
  return { qs, i: 0, score: 0, streak: 0, bestStreak: 0, correct: 0, log: [], locked: false, t0: Date.now() };
}

/* ───────── Quiz ───────── */
let run = null, raf = 0, tEnd = 0, tTot = 0, starting = false;
const C_RING = 125.66, LETTERS = ['A', 'B', 'C', 'D'];

async function startGame() {
  if (starting) return; starting = true;
  const btn = $('#startBtn'), label = btn.textContent; btn.disabled = true; btn.textContent = 'Chargement des questions…';
  const results = await Promise.all(cfg.cats.map(k => loadPack(k)));
  starting = false; btn.disabled = false; btn.textContent = label;
  const failed = cfg.cats.filter((k, i) => !results[i]);
  if (failed.length) toast(`Notion indisponible : ${failed.map(k => TH[k].name).join(', ')}. Reconnectez-vous une fois pour la télécharger.`);
  run = buildRun();
  if (!run.qs.length) { toast('Aucune question disponible pour cette sélection.'); refreshHome(); return; }
  tone([[440, 0, .1], [660, .08, .14]]);
  show('quiz'); showQ(); musicStart();
}
function fmtHint(q) {
  return (q.f.length > 1 ? 'Formats acceptés : ' : 'Format obligatoire : ') + q.f.map(f => f.hint).join(' — ou — ');
}
function showQ() {
  const q = run.qs[run.i]; run.locked = false;
  $('#qcount').textContent = `${run.i + 1} / ${run.qs.length}`;
  $('#bar').style.width = (run.i / run.qs.length * 100) + '%';
  updScore();
  $('#qtag').textContent = TH[q.c].name + (q.t === 'o' ? ' · réponse libre' : '');
  $('#qtext').textContent = q.q;
  $('#fb').hidden = true;
  const opts = $('#opts'), form = $('#openForm'), hint = $('#fmtHint'); opts.innerHTML = '';
  if (q.t === 'm') {
    form.hidden = true; hint.hidden = true; opts.hidden = false;
    q.opts.forEach((o, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'opt';
      b.innerHTML = '<span class="k"></span><span></span>';
      $('.k', b).textContent = LETTERS[i]; b.lastChild.textContent = o.t;
      b.onclick = () => answerMC(i); opts.appendChild(b);
    });
  } else {
    opts.hidden = true; form.hidden = false; hint.hidden = false; hint.textContent = fmtHint(q);
    const inp = $('#openIn'); inp.value = ''; inp.className = ''; inp.disabled = false; inp.placeholder = q.f[0].ph || 'Votre réponse…';
    $('#openForm .cta').disabled = false; $('#skipBtn').disabled = false;
    setTimeout(() => { if (matchMedia('(pointer:fine)').matches) inp.focus(); }, 350);
  }
  const card = $('#qcard'); card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
  startTimer(q.t === 'o' ? 40 : 20);
}
function updScore() { $('#qscore').textContent = run.score + ' pts'; $('#qstreak').textContent = 'série ' + run.streak; }
function startTimer(sec) {
  cancelAnimationFrame(raf);
  const ring = $('#ring'); ring.classList.toggle('none', !cfg.timer); ring.classList.remove('low');
  if (!cfg.timer) { tTot = 0; return; }
  tTot = sec * 1000; tEnd = performance.now() + tTot;
  const tick = now => {
    const left = Math.max(0, tEnd - now);
    $('#ringfg').style.strokeDashoffset = C_RING * (1 - left / tTot);
    $('#ringtxt').textContent = Math.ceil(left / 1000);
    ring.classList.toggle('low', left < 6000);
    if (left <= 0) { timeout(); return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
const timeLeftFrac = () => (cfg.timer && tTot) ? Math.max(0, (tEnd - performance.now()) / tTot) : 0;
function timeout() {
  if (!run || run.locked) return; const q = run.qs[run.i];
  if (q.t === 'm') answerMC(-1); else resolveOpen({ ok: false, fmtOk: true }, $('#openIn').value, true);
}

function answerMC(i) {
  if (run.locked) return;
  const q = run.qs[run.i], btns = $$('.opt'), good = q.opts.findIndex(o => o.ok), ok = i === good, frac = timeLeftFrac();
  btns.forEach((b, k) => { b.disabled = true; if (k === good) b.classList.add('ok'); else if (k === i) b.classList.add('ko'); else b.classList.add('dim'); });
  const pt = $('.opt.ok') ? $('.opt.ok').getBoundingClientRect() : null;
  finish(q, ok, i >= 0 ? q.opts[i].t : null, frac, { timedOut: i === -1, good: q.opts[good].t });
  if (ok && pt) burst(pt.left + pt.width / 2, pt.top + pt.height / 2, 34);
}
function resolveOpen(res, given, timedOut) {
  const q = run.qs[run.i]; if (run.locked) return;
  const frac = timeLeftFrac(), inp = $('#openIn'); inp.disabled = true; inp.classList.add(res.ok ? 'ok' : 'ko');
  $('#openForm .cta').disabled = true; $('#skipBtn').disabled = true;
  finish(q, res.ok, given, frac, { timedOut, good: q.a[0], fmtFail: !res.fmtOk && !!String(given || '').trim() });
  if (res.ok) { const r = inp.getBoundingClientRect(); burst(r.left + r.width / 2, r.top, 34); }
}
function finish(q, ok, given, frac, o) {
  run.locked = true; cancelAnimationFrame(raf);
  let pts = 0;
  if (ok) {
    run.streak++; run.bestStreak = Math.max(run.bestStreak, run.streak); run.correct++;
    pts = (q.t === 'o' ? 150 : 100) + Math.round(50 * frac) + Math.min(run.streak - 1, 5) * 10; run.score += pts;
    tone([[660, 0, .12], [880, .1, .2]]); buzz(20);
    const s = $('#qstreak'); s.classList.remove('pop'); void s.offsetWidth; s.classList.add('pop');
  } else { run.streak = 0; defeatShort(); buzz([60, 40, 60]); }
  run.log.push({ q, ok, given, pts, good: o.good, fmtFail: !!o.fmtFail });
  updScore();
  const fb = $('#fb'); fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'ko');
  $('#fbTitle').textContent = ok ? `Bonne réponse ! +${pts} pts` : (o.timedOut ? 'Temps écoulé' : o.fmtFail ? 'Format non respecté : réponse non trouvée' : 'Pas tout à fait');
  const ans = $('#fbAns'); ans.hidden = ok;
  if (!ok) { ans.innerHTML = 'Réponse attendue : <b></b>'; $('b', ans).textContent = o.good; }
  const fe = $('#fbFmt'); fe.hidden = !(q.t === 'o' && o.fmtFail); if (!fe.hidden) fe.textContent = fmtHint(q) + '.';
  $('#fbExp').textContent = q.x || '';
  $('#overBtn').hidden = !(q.t === 'o' && !ok && !o.fmtFail && !o.timedOut);
  $('#nextBtn').textContent = run.i === run.qs.length - 1 ? 'Voir les résultats' : 'Question suivante';
  $('#nextBtn').focus({ preventScroll: true });
  fb.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
}
function next() { if (!run || !run.locked) return; if (run.i >= run.qs.length - 1) endGame(); else { run.i++; showQ(); } }
$('#nextBtn').onclick = next;
$('#openForm').onsubmit = e => {
  e.preventDefault(); if (run.locked) return;
  const v = $('#openIn').value.trim(); if (!v) { $('#openIn').focus(); return; }
  resolveOpen(checkOpen(run.qs[run.i], v), v, false);
};
$('#skipBtn').onclick = () => { if (!run.locked) resolveOpen({ ok: false, fmtOk: true }, '', false); };
$('#overBtn').onclick = () => {
  const last = run.log[run.log.length - 1]; if (!last || last.ok) return;
  last.ok = true; last.pts = 150; run.correct++; run.score += 150; run.streak = 1; run.bestStreak = Math.max(run.bestStreak, 1);
  updScore(); $('#overBtn').hidden = true;
  $('#fb').className = 'fb ok'; $('#fbTitle').textContent = 'Réponse validée ! +150 pts'; $('#fbAns').hidden = true;
  tone([[660, 0, .12], [880, .1, .2]]);
};
$('#quitBtn').onclick = () => { if (confirm('Quitter la partie ? Votre progression sera perdue.')) { cancelAnimationFrame(raf); run = null; renderStats(); refreshHome(); show('home'); } };
addEventListener('keydown', e => {
  if (!$('#quiz').classList.contains('active') || !run) return;
  const q = run.qs[run.i];
  if (e.key === 'Enter' && run.locked) { e.preventDefault(); next(); return; }
  if (!run.locked && q.t === 'm') { const k = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 }[e.key.toLowerCase()]; if (k !== undefined) answerMC(k); }
});

/* ───────── Résultats ───────── */
function endGame() {
  cancelAnimationFrame(raf); musicStop();
  const total = run.qs.length, pct = Math.round(100 * run.correct / total);
  const st = store.get('stats', { games: 0, best: 0, ok: 0, tot: 0, cat: {} });
  const record = run.score > st.best;
  st.games++; st.ok += run.correct; st.tot += total; st.best = Math.max(st.best, run.score);
  run.log.forEach(l => { const c = st.cat[l.q.c] || (st.cat[l.q.c] = { ok: 0, tot: 0 }); c.tot++; if (l.ok) c.ok++; });
  store.set('stats', st);
  const T = pct >= 90 ? ['Architecte du web', 'Vous maîtrisez le sujet de bout en bout.']
    : pct >= 75 ? ['Développeur confirmé', 'Très belle partie, quelques détails à peaufiner.']
    : pct >= 50 ? ['Développeur en progression', 'Les bases sont là. Rejouez pour combler les trous.']
    : pct >= 30 ? ['Apprenti codeur', 'Chaque erreur est une leçon : regardez la section « À revoir ».'] 
    : ['Premier commit', 'Tout le monde commence quelque part. Relisez les explications et relancez.'];
  $('#rtitle').textContent = T[0];
  $('#rsub').textContent = (record && st.games > 1 ? 'Nouveau record ! ' : '') + T[1];
  $('#rscore').textContent = run.score + ' pts';
  const secs = Math.round((Date.now() - run.t0) / 1000), rs = $('#rstats'); rs.innerHTML = '';
  [[`${run.correct}/${total}`, 'bonnes réponses'], [run.bestStreak, 'meilleure série'], [`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, 'durée']].forEach(([v, l]) => {
    const d = document.createElement('div'); d.className = 'stat'; const b = document.createElement('b'); b.textContent = String(v);
    const s = document.createElement('small'); s.textContent = l; d.append(b, s); rs.appendChild(d);
  });
  const rev = $('#review'); rev.innerHTML = ''; const wrong = run.log.filter(l => !l.ok);
  if (!wrong.length) rev.innerHTML = '<p class="empty">Aucune erreur : parfait !</p>';
  wrong.forEach(l => {
    const d = document.createElement('div'); d.className = 'rev';
    d.innerHTML = '<small></small><p></p><p class="a"></p><p class="e"></p>';
    const [s, p, a, e] = d.children;
    s.textContent = TH[l.q.c].name; p.textContent = l.q.q; a.textContent = 'Réponse : ' + l.good;
    e.textContent = (l.fmtFail ? 'Format non respecté. ' : '') + (l.q.x || ''); rev.appendChild(d);
  });
  show('result');
  const fg = $('#rfg'); fg.style.strokeDashoffset = 326.7;
  fg.style.stroke = pct >= 75 ? 'var(--ok)' : pct >= 50 ? 'var(--v)' : 'var(--am)';
  requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = 326.7 * (1 - pct / 100); }));
  const pe = $('#rpct'); let t0 = null;
  const count = ts => { t0 = t0 || ts; const k = Math.min(1, (ts - t0) / 1400); pe.textContent = Math.round(pct * (1 - Math.pow(1 - k, 3))) + ' %'; if (k < 1) requestAnimationFrame(count); };
  requestAnimationFrame(count);
  if (pct >= 75) { setTimeout(bigBurst, 400); victory(); }
  else if (pct < 50) defeatLong();
  renderStats();
}
$('#againBtn').onclick = () => startGame();
$('#homeBtn').onclick = () => { run = null; renderStats(); refreshHome(); show('home'); };
$('#startBtn').onclick = startGame;

/* ───────── Démarrage animé ───────── */
async function boot() {
  const el = $('#boot'), log = $('#bootlog'); let skip = false;
  el.addEventListener('click', () => { skip = true; });
  const done = () => { el.classList.add('off'); setTimeout(() => el.remove(), 700); };
  let seen = false; try { seen = sessionStorage.getItem('dq_boot') === '1'; sessionStorage.setItem('dq_boot', '1'); } catch { /* ignore */ }
  if (reduce || seen) { done(); return; }
  const ctrl = 'serviceWorker' in navigator ? (navigator.serviceWorker.controller ? 'actif' : 'activation en cours') : 'non pris en charge';
  const lines = ['> DevQuiz v2.0', `> ${THEMES.length} notions détectées… ok`, `> logos : ${navigator.onLine ? 'en ligne' : 'SVG locaux'}`, `> mode hors ligne : ${ctrl}`, '> prêt.'];
  let out = '';
  for (const l of lines) {
    if (skip) break;
    for (let i = 1; i <= l.length && !skip; i += 2) { log.textContent = out + l.slice(0, i); await sleep(14); }
    out += l + '\n'; log.textContent = out; await sleep(skip ? 0 : 140);
  }
  await sleep(skip ? 0 : 350); done();
}

/* ───────── Réseau, installation, hors ligne ───────── */
function netState() {
  const n = $('#net'), on = navigator.onLine;
  n.textContent = on ? 'En ligne · logos officiels' : 'Hors ligne · tout fonctionne'; n.className = 'pill ' + (on ? 'on' : 'off');
  if (typeof refreshThemeIcons === 'function') refreshThemeIcons();
}
addEventListener('online', netState); addEventListener('offline', netState);

let deferred = null;
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const installBtn = $('#installBtn');
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; installBtn.hidden = false; });
addEventListener('appinstalled', () => { installBtn.hidden = true; deferred = null; toast('Application installée.'); });
installBtn.onclick = async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch { /* ignore */ } deferred = null; installBtn.hidden = true; };
if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
  const t = $('#tip'); t.hidden = false;
  t.textContent = "Pour installer sur iPhone ou iPad : dans Safari, touchez Partager puis « Sur l'écran d'accueil ».";
}
if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      const had = !!navigator.serviceWorker.controller;
      reg.addEventListener('updatefound', () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener('statechange', () => { if (w.state === 'installed') toast(had ? 'Mise à jour téléchargée : elle sera active au prochain lancement.' : 'Prêt : DevQuiz fonctionne maintenant hors ligne.'); });
      });
    }).catch(() => { /* HTTPS ou localhost requis */ });
  });
}

/* ───────── Initialisation ───────── */
fxResize(); bgInit(); netState();
addEventListener('resize', () => { fxResize(); bgInit(); });
requestAnimationFrame(bgLoop);
initHome();
boot();
})();
