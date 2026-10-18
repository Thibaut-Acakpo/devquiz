/* DevQuiz — logique de l'application */
(() => {
'use strict';

/* ───────── Utilitaires ───────── */
const APP_VERSION = '2.0';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem('dq_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { if (v === null) localStorage.removeItem('dq_' + k); else localStorage.setItem('dq_' + k, JSON.stringify(v)); } catch { /* stockage indisponible */ } }
};
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const searchNorm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const fmtN = x => Number.isInteger(x) ? String(x) : (Math.round(x * 10) / 10).toString().replace('.', ',');
const plural = (n, a, b) => (n > 1 ? b : a);
const scoreOf = (correct, total) => (total ? Math.round(100 * correct / total) : 0);   // toujours sur 100

/* ───────── Notions et packs de questions ───────── */
const TH = Object.fromEntries(THEMES.map(t => [t.id, t]));
const GROUPS = [...new Set(THEMES.map(t => t.category))];
const ready = id => !!(typeof PACKS !== 'undefined' && PACKS[id]);
const packSize = (id, open) => ready(id) ? PACKS[id].m + (open ? PACKS[id].o : 0) : 0;
const bank = {}, loading = {};

/* Charge js/questions/<id>.js à la demande (servi par le cache hors ligne). */
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
const N_CHOICES = [10, 20, 25, 50, 100];    // 100 ÷ n est toujours un nombre entier de points
const defCfg = { cats: ['html', 'css', 'javascript', 'php'], n: 20, open: true, timer: true, music: true, musicVol: 0.5, sfx: true, sfxVol: 0.8, vibrate: true, theme: 'dark', themeV: 3 };
const savedCfg = store.get('cfg', {});
let cfg = Object.assign({}, defCfg, savedCfg);
if (savedCfg.sound === false && savedCfg.sfx === undefined) { cfg.sfx = false; cfg.vibrate = false; }   // ancien réglage « sons et vibrations »
if (cfg.n === 30) cfg.n = 25;
if (!N_CHOICES.includes(cfg.n)) cfg.n = 20;
if (savedCfg.themeV !== 3) { cfg.theme = 'dark'; cfg.themeV = 3; }      // le thème sombre (couleurs du logo) devient le thème par défaut
if (!['auto', 'light', 'dark'].includes(cfg.theme)) cfg.theme = 'dark';
cfg.musicVol = Math.min(1, Math.max(0, +cfg.musicVol || 0)); cfg.sfxVol = Math.min(1, Math.max(0, +cfg.sfxVol || 0));
cfg.cats = (cfg.cats || []).filter(k => TH[k] && ready(k));
if (!cfg.cats.length && !store.get('cfgTouched', false)) cfg.cats = defCfg.cats.filter(ready);
const saveCfg = () => { store.set('cfg', cfg); store.set('cfgTouched', true); };

function applyTheme() {
  document.documentElement.dataset.theme = cfg.theme;
  const dark = cfg.theme === 'dark' || (cfg.theme === 'auto' && !matchMedia('(prefers-color-scheme: light)').matches);
  $$('meta[name="theme-color"]').forEach(m => { m.content = dark ? '#060c2f' : '#f3f6ff'; });
}

/* ───────── État ───────── */
let run = null, raf = 0, tEnd = 0, tTot = 0, tLeft = null, pauseN = 0, hiddenPaused = false, starting = false, bootOpen = false, lastWrong = [];
const C_RING = 125.66, LETTERS = ['A', 'B', 'C', 'D'];

/* ───────── Notification ───────── */
let toastT;
function toast(msg, action) {
  const t = $('#toast'); t.textContent = '';
  const s = document.createElement('span'); s.textContent = msg; t.appendChild(s);
  if (action) { const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label; b.onclick = action.fn; t.appendChild(b); }
  t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), action ? 12000 : 3600);
}

/* ───────── Sons, musique et vibrations (tout est synthétisé : aucun fichier audio, donc 100 % hors ligne) ───────── */
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
/* « wah » de trombone triste : dents de scie, filtre qui s'ouvre puis se referme, hauteur qui glisse */
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
function defeatShort() {      // mauvaise réponse : « wah wah wahhh »
  if (!cfg.sfx || !audio()) return;
  const t = ac.currentTime; duck(1500);
  wah(t, 311, .2); wah(t + .22, 293.7, .2); wah(t + .44, 277.2, .65, .93, true);
}
function defeatLong() {       // partie perdue
  if (!cfg.sfx || !audio()) return;
  const t = ac.currentTime + .15; duck(2800);
  wah(t, 392, .34); wah(t + .37, 370, .34); wah(t + .74, 349, .34); wah(t + 1.11, 330, 1.2, .9, true);
  note(98, t + 1.11, 1.2, .3, 'sine', sfxBus);
}
function victory() {          // partie gagnée
  if (!cfg.sfx || !audio()) return;
  duck(1800); tone([[523, 0, .15], [659, .14, .15], [784, .28, .15], [1047, .42, .5]]);
}
function intro() {            // son d'entrée dans l'application : différent de tous les sons de jeu
  if (!cfg.sfx || !audio()) return;
  const t = ac.currentTime + .05;
  [[523.25, 0], [659.25, .13], [783.99, .26], [1046.5, .4]].forEach(([f, d]) => { note(f, t + d, .9, .26, 'sine', sfxBus); note(f * 2, t + d, .45, .06, 'triangle', sfxBus); });
  [261.63, 329.63, 392].forEach(f => note(f, t, 1.7, .16, 'triangle', sfxBus));
  note(2093, t + .6, .6, .05, 'sine', sfxBus);
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
let preview = false, previewT = 0;
const inGame = () => !!run && !$('#play').hidden;
function syncMusic() {
  if (cfg.music && inGame()) musicStart(); else if (!(preview && mus.on)) musicStop();
  applyVolumes(); updMusicBtn();
}
function previewMusic() {
  if (mus.on) { preview = false; clearTimeout(previewT); musicStop(); return; }
  if (!cfg.music) { toast('Activez d\'abord la musique.'); return; }
  preview = true; musicStart(); clearTimeout(previewT);
  previewT = setTimeout(() => { preview = false; if (!inGame()) musicStop(); }, 9000);
}
function updMusicBtn() {
  const b = $('#btnMusic');
  b.classList.toggle('off', !cfg.music); b.setAttribute('aria-pressed', String(!!cfg.music));
  b.title = cfg.music ? 'Couper la musique' : 'Activer la musique';
}

/* ───────── Confettis ───────── */
const fx = $('#fx'), fctx = fx.getContext('2d');
let sparks = [], fxRun = false;
function fxResize() { fx.width = innerWidth; fx.height = innerHeight; }
function burst(x, y, n = 36) {
  if (reduce) return;
  const colors = ['#d97757', '#b5532f', '#2c7a4b', '#e9b44c', '#6a9bcc'];
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
const bigBurst = () => [0.2, 0.5, 0.8].forEach((f, i) => setTimeout(() => burst(innerWidth * f, innerHeight * .35, 60), i * 220));

/* ───────── Chronomètre (suspendu quand une fenêtre est ouverte ou que l'onglet est caché) ───────── */
function tick(now) {
  const left = Math.max(0, tEnd - now), ring = $('#ring');
  $('#ringfg').style.strokeDashoffset = C_RING * (1 - left / tTot);
  $('#ringtxt').textContent = Math.ceil(left / 1000);
  ring.classList.toggle('low', left < 6000);
  if (left <= 0) { timeout(); return; }
  raf = requestAnimationFrame(tick);
}
function startTimer(sec) {
  cancelAnimationFrame(raf); tLeft = null;
  const ring = $('#ring'); ring.classList.toggle('none', !cfg.timer); ring.classList.remove('low');
  if (!cfg.timer) { tTot = 0; return; }
  tTot = sec * 1000; tEnd = performance.now() + tTot; $('#ringfg').style.strokeDashoffset = 0;
  if (pauseN > 0) { tLeft = tTot; return; }
  raf = requestAnimationFrame(tick);
}
function pauseTimer() {
  pauseN++;
  if (pauseN === 1 && tTot && run && !run.locked && tLeft === null) { tLeft = Math.max(0, tEnd - performance.now()); cancelAnimationFrame(raf); }
}
function resumeTimer() {
  pauseN = Math.max(0, pauseN - 1);
  if (pauseN === 0 && tLeft !== null) { tEnd = performance.now() + tLeft; tLeft = null; if (run && !run.locked) raf = requestAnimationFrame(tick); }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (!hiddenPaused) { hiddenPaused = true; pauseTimer(); } if (ac) ac.suspend().catch(() => {}); }
  else { if (hiddenPaused) { hiddenPaused = false; resumeTimer(); } if (ac) ac.resume().catch(() => {}); }
});

/* ───────── Fenêtres de dialogue ───────── */
function openDlg(id) {
  const d = $('#' + id); if (d.open) return;
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  pauseTimer();
}
$$('dialog').forEach(d => {
  d.addEventListener('click', e => { if (e.target === d) d.close(); });             // clic sur le fond
  $$('[data-close]', d).forEach(b => b.addEventListener('click', () => d.close()));
  d.addEventListener('close', () => resumeTimer());
});
function confirmDlg({ title, msg, ok = 'Confirmer', danger = false }) {
  return new Promise(res => {
    const d = $('#dlgConfirm'); $('#cfTitle').textContent = title; $('#cfMsg').textContent = msg;
    const b = $('#cfOk'); b.textContent = ok; b.classList.toggle('danger', danger); b.classList.toggle('primary', !danger);
    d.returnValue = ''; d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true });
    openDlg('dlgConfirm');
  });
}

/* ───────── Statistiques ───────── */
function loadStats() {
  const s = store.get('stats', null) || { games: 0, best: 0, ok: 0, tot: 0, cat: {}, v: 2 };
  if (s.v !== 2) { s.best = 0; s.v = 2; }          // l'ancien score n'était pas sur 100
  s.cat = s.cat || {}; return s;
}

/* ───────── Choix des notions (dialogue) ───────── */
const openG = new Set([GROUPS[0]]);
function renderCats() {
  const box = $('#cats'), q = searchNorm($('#search').value.trim()); box.innerHTML = ''; let shown = 0;
  GROUPS.forEach(g => {
    const list = THEMES.filter(t => t.category === g && (!q || searchNorm(t.name + ' ' + t.id).includes(q)));
    if (!list.length) return; shown += list.length;
    const det = document.createElement('details'); det.className = 'grp'; det.dataset.g = g; det.open = !!q || openG.has(g);
    det.addEventListener('toggle', () => { if (!$('#search').value.trim()) { det.open ? openG.add(g) : openG.delete(g); } });
    const sum = document.createElement('summary');
    const h = document.createElement('span'); h.className = 'grp-t'; h.textContent = g;
    const cnt = document.createElement('span'); cnt.className = 'grp-c';
    const all = document.createElement('button'); all.type = 'button'; all.className = 'link small';
    sum.append(h, cnt, all); det.appendChild(sum);
    all.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      const ids = THEMES.filter(t => t.category === g && ready(t.id)).map(t => t.id);
      cfg.cats = ids.every(k => cfg.cats.includes(k)) ? cfg.cats.filter(k => !ids.includes(k)) : [...new Set([...cfg.cats, ...ids])];
      saveCfg(); updCats();
    };
    const grid = document.createElement('div'); grid.className = 'cats';
    list.forEach(t => {
      const rdy = ready(t.id), b = document.createElement('button');
      b.type = 'button'; b.dataset.k = t.id; b.className = 'cat' + (rdy ? '' : ' soon');
      if (!rdy) b.setAttribute('aria-disabled', 'true');
      const ic = document.createElement('span'); ic.className = 'ic';
      const img = createThemeIcon(t); if (img) ic.appendChild(img); else ic.textContent = '◆';
      const name = document.createElement('b'); name.textContent = t.name + (rdy ? '' : ' (bientôt)');
      const ck = document.createElement('span'); ck.className = 'ck'; ck.textContent = '✓'; ck.setAttribute('aria-hidden', 'true');
      b.append(ic, name, ck);
      b.onclick = () => {
        if (!rdy) { toast(`${t.name} : les questions arrivent bientôt.`); return; }
        cfg.cats = cfg.cats.includes(t.id) ? cfg.cats.filter(x => x !== t.id) : [...cfg.cats, t.id];
        saveCfg(); updCats();
      };
      grid.appendChild(b);
    });
    det.appendChild(grid); box.appendChild(det);
  });
  $('#noRes').hidden = shown > 0; updCats();
}
function updCats() {
  $$('.cat').forEach(b => { const on = cfg.cats.includes(b.dataset.k); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  $$('.grp').forEach(det => {
    const ids = THEMES.filter(t => t.category === det.dataset.g && ready(t.id)).map(t => t.id), n = ids.filter(k => cfg.cats.includes(k)).length;
    $('.grp-c', det).textContent = `${n}/${ids.length}`;
    const l = $('.link', det); l.hidden = !ids.length; l.textContent = ids.length && ids.every(k => cfg.cats.includes(k)) ? 'Tout retirer' : 'Tout choisir';
  });
  const k = cfg.cats.length, readyIds = THEMES.filter(t => ready(t.id)).map(t => t.id);
  $('#selCount').textContent = k ? `${k} notion${plural(k, '', 's')} sélectionnée${plural(k, '', 's')}` : 'Aucune notion sélectionnée';
  $('#allBtn').textContent = readyIds.length && readyIds.every(x => cfg.cats.includes(x)) ? 'Tout désélectionner' : 'Tout sélectionner';
  renderIdle();
}

/* ───────── Carte principale : état « prêt à jouer » ───────── */
const poolTotal = () => cfg.cats.reduce((n, k) => n + packSize(k, cfg.open), 0);
const effN = () => Math.min(cfg.n, poolTotal());
function renderIdle() {
  const k = cfg.cats.length, n = effN(), st = loadStats(), saved = store.get('run', null);
  $('#lead').textContent = `${THEMES.length} notions, des questions différentes à chaque partie, même hors ligne.`;
  $('#sumNotions').textContent = k ? `${k} notion${plural(k, '', 's')} sélectionnée${plural(k, '', 's')}` : 'Aucune notion sélectionnée';
  const names = cfg.cats.map(id => TH[id].name);
  $('#sumList').textContent = names.length ? names.slice(0, 4).join(', ') + (names.length > 4 ? ` +${names.length - 4}` : '') : 'Touchez ici pour choisir';
  const chips = $('#chips'); chips.innerHTML = '';
  const items = n ? [`${n} question${plural(n, '', 's')}`, `${fmtN(100 / n)} point${plural(100 / n, '', 's')} chacune`] : [];
  items.push(cfg.timer ? 'Chronomètre' : 'Sans chronomètre', cfg.open ? 'Réponses libres' : 'QCM uniquement');
  items.forEach(t => { const c = document.createElement('span'); c.className = 'chip'; c.textContent = t; chips.appendChild(c); });
  $('#btnPlay').disabled = n === 0; $('#btnPlay').textContent = n ? 'Jouer' : 'Choisissez des notions';
  const rb = $('#btnResume');
  if (saved && saved.qs && saved.i < saved.qs.length) { rb.hidden = false; rb.textContent = `Reprendre la partie (${saved.i}/${saved.qs.length})`; } else rb.hidden = true;
  $('#bestLine').textContent = st.games ? `Meilleur score : ${st.best} / 100 · ${st.games} partie${plural(st.games, '', 's')} jouée${plural(st.games, '', 's')}` : 'Aucune partie jouée pour l\'instant.';
  $('#ptsNote').textContent = `Chaque question vaut ${fmtN(100 / cfg.n)} point${plural(100 / cfg.n, '', 's')} : une partie fait toujours 100 points au total.`;
}
function showPlay() { $('#idle').hidden = true; $('#play').hidden = false; }
function showIdle() { musicStop(); $('#play').hidden = true; $('#idle').hidden = false; renderIdle(); }

/* ───────── Tirage des questions ───────── */
/* Tire les questions de façon équilibrée entre les notions choisies, en privilégiant celles pas encore vues. */
function pickQuestions() {
  const seen = new Set(store.get('seen', []));
  const mkQueue = list => {
    let fresh = list.filter(q => !seen.has(q.id));
    if (!fresh.length) { list.forEach(q => seen.delete(q.id)); fresh = list.slice(); }
    const rest = list.filter(q => !fresh.includes(q));
    return shuffle(fresh).concat(shuffle(rest));
  };
  const pools = shuffle(cfg.cats.filter(k => bank[k])).map(k => ({ k, m: mkQueue(bank[k].m), o: cfg.open ? mkQueue(bank[k].o) : [] })).filter(p => p.m.length || p.o.length);
  const total = pools.reduce((n, p) => n + p.m.length + p.o.length, 0), N = Math.min(cfg.n, total), picked = [];
  let i = 0;
  while (picked.length < N && pools.length) {
    const p = pools[i % pools.length], wantOpen = cfg.open && Math.random() < .2;
    const q = wantOpen ? (p.o.shift() || p.m.shift()) : (p.m.shift() || p.o.shift());
    if (q) { picked.push(q); seen.add(q.id); }
    if (!p.m.length && !p.o.length) pools.splice(i % pools.length, 1); else i++;
  }
  store.set('seen', [...seen]);
  return shuffle(picked);
}
const withOpts = q => q.t === 'm' ? Object.assign({}, q, { opts: shuffle(q.o.map((t, j) => ({ t, ok: j === 0, idx: j }))) }) : Object.assign({}, q);

/* ───────── Partie ───────── */
function setBusy(b) { const p = $('#btnPlay'); p.disabled = b; if (b) p.textContent = 'Chargement…'; else renderIdle(); }
async function newGame() {
  if (starting || !effN()) return; starting = true; audio(); setBusy(true);
  const results = await Promise.all(cfg.cats.map(k => loadPack(k)));
  starting = false; setBusy(false);
  const failed = cfg.cats.filter((k, i) => !results[i]);
  if (failed.length) toast(`Notion indisponible : ${failed.map(k => TH[k].name).join(', ')}. Reconnectez-vous une fois pour la télécharger.`);
  const list = pickQuestions();
  if (!list.length) { toast('Aucune question disponible pour cette sélection.'); return; }
  beginRun(list, false);
}
function beginRun(list, review) {
  const qs = list.map(withOpts);
  run = { qs, i: 0, total: qs.length, correct: 0, streak: 0, bestStreak: 0, log: [], locked: false, t0: Date.now(), review };
  store.set('run', null);
  tone([[440, 0, .1], [660, .08, .14]]);
  showPlay(); showQ(); musicStart();
}
async function resumeGame() {
  const s = store.get('run', null); if (!s || starting) return; starting = true; audio();
  await Promise.all([...new Set(s.qs.map(x => x.c))].map(loadPack)); starting = false;
  const find = (c, id) => { const b = bank[c]; return b ? b.m.concat(b.o).find(q => q.id === id) : null; };
  const qs = [];
  for (const x of s.qs) {
    const q = find(x.c, x.id);
    if (!q) { store.set('run', null); renderIdle(); toast('La partie sauvegardée ne correspond plus aux questions : elle a été abandonnée.'); return; }
    qs.push(q.t === 'm' ? Object.assign({}, q, { opts: x.ord.map(j => ({ t: q.o[j], ok: j === 0, idx: j })) }) : Object.assign({}, q));
  }
  const log = s.log.map(l => { const q = find(l.c, l.id); return q ? { q: Object.assign({}, q), ok: l.ok, given: l.given, good: l.good, fmtFail: l.fmtFail } : null; }).filter(Boolean);
  run = { qs, i: s.i, total: qs.length, correct: s.correct, streak: s.streak, bestStreak: s.bestStreak, log, locked: false, t0: s.t0, review: false };
  tone([[440, 0, .1], [660, .08, .14]]); showPlay(); showQ(); musicStart();
}
function saveRun() {
  if (!run || run.review) return;
  store.set('run', {
    i: run.i, correct: run.correct, streak: run.streak, bestStreak: run.bestStreak, t0: run.t0,
    qs: run.qs.map(q => ({ c: q.c, id: q.id, ord: q.t === 'm' ? q.opts.map(o => o.idx) : null })),
    log: run.log.map(l => ({ c: l.q.c, id: l.q.id, ok: l.ok, given: l.given, good: l.good, fmtFail: l.fmtFail }))
  });
}
const fmtHint = q => (q.f.length > 1 ? 'Formats acceptés : ' : 'Format obligatoire : ') + q.f.map(f => f.hint).join('  ou  ');

function showQ() {
  const q = run.qs[run.i]; run.locked = false; saveRun();
  $('#qCount').textContent = `${run.i + 1} / ${run.total}`;
  $('#bar').style.width = (run.i / run.total * 100) + '%';
  updScore();
  $('#qTag').textContent = TH[q.c].name + (q.t === 'o' ? ' · réponse libre' : '');
  $('#qText').textContent = q.q;
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
    $('#openForm .btn.primary').disabled = false; $('#skipBtn').disabled = false;
    setTimeout(() => { if (matchMedia('(pointer:fine)').matches && !document.querySelector('dialog[open]')) inp.focus(); }, 300);
  }
  startTimer(q.t === 'o' ? 40 : 20);
}
function updScore() {
  $('#qScore').textContent = `${scoreOf(run.correct, run.total)} / 100`;
  $('#qStreak').textContent = 'série ' + run.streak;
}
function timeout() {
  if (!run || run.locked) return; const q = run.qs[run.i];
  if (q.t === 'm') answerMC(-1); else resolveOpen({ ok: false, fmtOk: true }, $('#openIn').value, true);
}
function answerMC(i) {
  if (!run || run.locked) return;
  const q = run.qs[run.i], btns = $$('.opt'), good = q.opts.findIndex(o => o.ok), ok = i === good;
  btns.forEach((b, k) => { b.disabled = true; if (k === good) b.classList.add('ok'); else if (k === i) b.classList.add('ko'); else b.classList.add('dim'); });
  const pt = $('.opt.ok') ? $('.opt.ok').getBoundingClientRect() : null;
  finish(q, ok, i >= 0 ? q.opts[i].t : null, { timedOut: i === -1, good: q.opts[good].t });
  if (ok && pt) burst(pt.left + pt.width / 2, pt.top + pt.height / 2, 30);
}
function resolveOpen(res, given, timedOut) {
  if (!run || run.locked) return; const q = run.qs[run.i];
  const inp = $('#openIn'); inp.disabled = true; inp.classList.add(res.ok ? 'ok' : 'ko');
  $('#openForm .btn.primary').disabled = true; $('#skipBtn').disabled = true;
  finish(q, res.ok, given, { timedOut, good: q.a[0], fmtFail: !res.fmtOk && !!String(given || '').trim() });
  if (res.ok) { const r = inp.getBoundingClientRect(); burst(r.left + r.width / 2, r.top, 30); }
}
function finish(q, ok, given, o) {
  run.locked = true; cancelAnimationFrame(raf);
  const pts = 100 / run.total;                         // points fixes : identiques pour toutes les questions
  if (ok) {
    run.streak++; run.bestStreak = Math.max(run.bestStreak, run.streak); run.correct++;
    tone([[660, 0, .12], [880, .1, .2]]); buzz(20);
  } else { run.streak = 0; defeatShort(); buzz([60, 40, 60]); }
  run.log.push({ q, ok, given, good: o.good, fmtFail: !!o.fmtFail });
  updScore();
  const fb = $('#fb'); fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'ko');
  $('#fbTitle').textContent = ok ? `Bonne réponse ! +${fmtN(pts)} point${plural(pts, '', 's')}`
    : (o.timedOut ? 'Temps écoulé' : o.fmtFail ? 'Format non respecté : réponse non trouvée' : 'Mauvaise réponse');
  const ans = $('#fbAns'); ans.hidden = ok;
  if (!ok) { ans.textContent = 'Réponse attendue : '; const b = document.createElement('b'); b.textContent = o.good; ans.appendChild(b); }
  const fe = $('#fbFmt'); fe.hidden = !(q.t === 'o' && o.fmtFail); if (!fe.hidden) fe.textContent = fmtHint(q) + '.';
  $('#fbExp').textContent = q.x || '';
  $('#nextBtn').textContent = run.i === run.total - 1 ? 'Voir les résultats' : 'Question suivante';
  if (!document.querySelector('dialog[open]')) $('#nextBtn').focus({ preventScroll: true });
  fb.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
}
function next() { if (!run || !run.locked) return; if (run.i >= run.total - 1) endGame(); else { run.i++; showQ(); } }

/* ───────── Résultats (fenêtre de dialogue) ───────── */
function endGame() {
  cancelAnimationFrame(raf); musicStop(); store.set('run', null);
  const total = run.total, score = scoreOf(run.correct, total), review = run.review, st = loadStats();
  const record = !review && score > st.best;
  if (!review) {
    st.games++; st.ok += run.correct; st.tot += total; st.best = Math.max(st.best, score);
    run.log.forEach(l => { const c = st.cat[l.q.c] || (st.cat[l.q.c] = { ok: 0, tot: 0 }); c.tot++; if (l.ok) c.ok++; });
    store.set('stats', st);
  }
  const T = score >= 90 ? ['Architecte du web', 'Vous maîtrisez le sujet de bout en bout.']
    : score >= 75 ? ['Développeur confirmé', 'Très belle partie, quelques détails à peaufiner.']
    : score >= 50 ? ['Développeur en progression', 'Les bases sont là. Rejouez pour combler les trous.']
    : score >= 30 ? ['Apprenti codeur', 'Chaque erreur est une leçon : regardez la section « À revoir ».']
    : ['Premier commit', 'Tout le monde commence quelque part. Relisez les explications et relancez.'];
  $('#rtitle').textContent = review ? 'Séance de révision terminée' : T[0];
  $('#rsub').textContent = (record && st.games > 1 ? 'Nouveau record ! ' : '') + T[1];
  const secs = Math.round((Date.now() - run.t0) / 1000), rs = $('#rstats'); rs.innerHTML = '';
  [[`${run.correct}/${total}`, 'bonnes réponses'], [run.bestStreak, 'meilleure série'], [`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, 'durée']].forEach(([v, l]) => {
    const d = document.createElement('div'); d.className = 'stat'; const b = document.createElement('b'); b.textContent = String(v);
    const s = document.createElement('small'); s.textContent = l; d.append(b, s); rs.appendChild(d);
  });
  const wrong = run.log.filter(l => !l.ok); lastWrong = wrong.map(l => l.q);
  const rev = $('#review'); rev.innerHTML = '';
  $('#revBox').hidden = !wrong.length; $('#revBox').open = false;
  $('#revSum').textContent = `À revoir (${wrong.length})`;
  wrong.forEach(l => {
    const d = document.createElement('div'); d.className = 'rev';
    d.innerHTML = '<small></small><p></p><p class="a"></p><p class="g"></p><p class="e"></p>';
    const [s, p, a, g, e] = d.children;
    s.textContent = TH[l.q.c].name; p.textContent = l.q.q; a.textContent = 'Réponse : ' + l.good;
    if (l.given) g.textContent = (l.fmtFail ? 'Votre réponse (format non respecté) : ' : 'Votre réponse : ') + l.given; else g.remove();
    e.textContent = l.q.x; rev.appendChild(d);
  });
  $('#errBtn').hidden = !wrong.length;
  run = null; showIdle();
  const fg = $('#rfg'); fg.style.strokeDashoffset = 326.7;
  fg.style.stroke = score >= 75 ? 'var(--ok)' : score >= 50 ? 'var(--accent)' : 'var(--ko)';
  $('#rpct').textContent = '0';
  openDlg('dlgResult');
  requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = 326.7 * (1 - score / 100); }));
  const pe = $('#rpct'); let t0 = null;
  const count = ts => { t0 = t0 || ts; const k = Math.min(1, (ts - t0) / 1200); pe.textContent = Math.round(score * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(count); };
  requestAnimationFrame(count);
  if (score >= 75) { setTimeout(bigBurst, 350); victory(); }
  else if (score < 50) defeatLong();
  else tone([[523, 0, .15], [659, .15, .3]]);
}

/* ───────── Statistiques (fenêtre de dialogue) ───────── */
function barRow(name, ok, tot) {
  const acc = tot ? Math.round(100 * ok / tot) : 0, r = document.createElement('div');
  r.className = 'bar-row ' + (acc >= 75 ? 'good' : acc < 50 ? 'bad' : '');
  r.innerHTML = '<span class="bn"></span><span class="bv"></span><span class="bt"><i></i></span>';
  $('.bn', r).textContent = name; $('.bv', r).textContent = `${acc} % · ${ok}/${tot}`; $('.bt i', r).style.width = acc + '%';
  return r;
}
function renderStatsDlg() {
  const st = loadStats(), acc = st.tot ? Math.round(100 * st.ok / st.tot) : 0, box = $('#stats'); box.innerHTML = '';
  [[st.games, 'parties jouées'], [st.games ? st.best + ' / 100' : '—', 'meilleur score'], [st.tot ? acc + ' %' : '—', 'bonnes réponses']].forEach(([v, l]) => {
    const d = document.createElement('div'); d.className = 'stat'; const b = document.createElement('b'); b.textContent = String(v);
    const s = document.createElement('small'); s.textContent = l; d.append(b, s); box.appendChild(d);
  });
  const entries = Object.entries(st.cat).filter(([id, c]) => TH[id] && c.tot > 0);
  const weak = $('#weak'), all = $('#allStats'); weak.innerHTML = ''; all.innerHTML = '';
  const none = t => { const p = document.createElement('p'); p.className = 'muted small'; p.textContent = t; return p; };
  const w = entries.filter(([, c]) => c.tot >= 5).sort((a, b) => a[1].ok / a[1].tot - b[1].ok / b[1].tot).slice(0, 5);
  if (w.length) w.forEach(([id, c]) => weak.appendChild(barRow(TH[id].name, c.ok, c.tot))); else weak.appendChild(none('Jouez quelques parties : les notions à retravailler apparaîtront ici.'));
  if (entries.length) entries.sort((a, b) => b[1].tot - a[1].tot).forEach(([id, c]) => all.appendChild(barRow(TH[id].name, c.ok, c.tot))); else all.appendChild(none('Aucune réponse enregistrée pour l\'instant.'));
}

/* ───────── Branchements ───────── */
$('#btnPlay').onclick = newGame;
$('#btnResume').onclick = resumeGame;
$('#btnNotions').onclick = () => openDlg('dlgNotions');
$('#btnSettings').onclick = () => { syncSettingsUI(); openDlg('dlgSettings'); };
$('#btnStats').onclick = () => { renderStatsDlg(); openDlg('dlgStats'); };
$('#btnHelp').onclick = () => openDlg('dlgHelp');
$('#nextBtn').onclick = next;
$('#openForm').onsubmit = e => {
  e.preventDefault(); if (!run || run.locked) return;
  const v = $('#openIn').value.trim(); if (!v) { $('#openIn').focus(); return; }
  resolveOpen(checkOpen(run.qs[run.i], v), v, false);
};
$('#skipBtn').onclick = () => { if (run && !run.locked) resolveOpen({ ok: false, fmtOk: true }, '', false); };
$('#btnQuit').onclick = async () => {
  if (!run) return;
  const review = run.review;
  if (await confirmDlg({ title: 'Quitter la partie ?', msg: review ? 'La séance de révision sera abandonnée.' : 'Votre progression est sauvegardée : vous pourrez reprendre cette partie plus tard.', ok: 'Quitter' })) {
    cancelAnimationFrame(raf); run = null; showIdle();
  }
};
$('#againBtn').onclick = () => { $('#dlgResult').close(); newGame(); };
$('#errBtn').onclick = () => { $('#dlgResult').close(); if (lastWrong.length) beginRun(lastWrong, true); };
$('#btnMusic').onclick = () => { cfg.music = !cfg.music; saveCfg(); $('#optMusic').checked = cfg.music; syncMusic(); };
$('#search').addEventListener('input', renderCats);
$('#allBtn').onclick = () => {
  const ids = THEMES.filter(t => ready(t.id)).map(t => t.id);
  cfg.cats = ids.every(x => cfg.cats.includes(x)) ? [] : ids; saveCfg(); updCats();
};
$('#dlgNotions').addEventListener('close', () => { $('#search').value = ''; renderCats(); });
$('#dlgSettings').addEventListener('close', () => { if (preview) { preview = false; clearTimeout(previewT); if (!inGame()) musicStop(); } });

/* Réglages */
function syncSettingsUI() {
  $$('#seg button').forEach(b => b.classList.toggle('on', +b.dataset.n === cfg.n));
  $$('#segTheme button').forEach(b => b.classList.toggle('on', b.dataset.t === cfg.theme));
  [['optOpen', 'open'], ['optTimer', 'timer'], ['optMusic', 'music'], ['optSfx', 'sfx'], ['optVibrate', 'vibrate']].forEach(([id, k]) => { $('#' + id).checked = !!cfg[k]; });
  $('#volMusic').value = Math.round(cfg.musicVol * 100); $('#volSfx').value = Math.round(cfg.sfxVol * 100);
  renderIdle();
}
$$('#seg button').forEach(b => b.onclick = () => { cfg.n = +b.dataset.n; saveCfg(); syncSettingsUI(); });
$$('#segTheme button').forEach(b => b.onclick = () => { cfg.theme = b.dataset.t; saveCfg(); applyTheme(); syncSettingsUI(); });
[['optOpen', 'open'], ['optTimer', 'timer'], ['optMusic', 'music'], ['optSfx', 'sfx'], ['optVibrate', 'vibrate']].forEach(([id, key]) => {
  $('#' + id).onchange = e => {
    cfg[key] = e.target.checked; saveCfg(); renderIdle();
    if (key === 'music') syncMusic();
    if (key === 'sfx') { applyVolumes(); if (cfg.sfx) tone([[660, 0, .12], [880, .1, .15]]); }
    if (key === 'vibrate' && cfg.vibrate) buzz(40);
  };
});
[['volMusic', 'musicVol'], ['volSfx', 'sfxVol']].forEach(([id, key]) => {
  const el = $('#' + id);
  el.oninput = () => { cfg[key] = el.value / 100; applyVolumes(); };
  el.onchange = () => { saveCfg(); if (key === 'sfxVol') tone([[660, 0, .12]]); };
});
const needSfx = () => { if (!cfg.sfx) toast('Activez d\'abord les effets sonores.'); };
$('#tIntro').onclick = () => { needSfx(); intro(); };
$('#tMusic').onclick = previewMusic;
$('#tWin').onclick = () => { needSfx(); victory(); };
$('#tLose').onclick = () => { needSfx(); defeatLong(); };
$('#btnReset').onclick = async () => {
  if (await confirmDlg({ title: 'Réinitialiser les statistiques ?', msg: 'Vos parties, votre meilleur score et votre progression par notion seront effacés. Cette action est définitive.', ok: 'Réinitialiser', danger: true })) {
    store.set('stats', null); store.set('seen', []); renderIdle(); toast('Statistiques réinitialisées.');
  }
};

/* Clavier : A–D ou 1–4 pour répondre, Entrée pour continuer */
addEventListener('keydown', e => {
  if (!run || $('#play').hidden || bootOpen || document.querySelector('dialog[open]')) return;
  const q = run.qs[run.i];
  if (e.key === 'Enter' && run.locked) { e.preventDefault(); next(); return; }
  if (!run.locked && q.t === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const k = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 }[e.key.toLowerCase()];
    if (k !== undefined) answerMC(k);
  }
});

/* ───────── Écran d'entrée : un geste est nécessaire pour autoriser le son ───────── */
function boot() {
  const el = $('#boot'), btn = $('#bootEnter'); let seen = false;
  try { seen = sessionStorage.getItem('dq_boot') === '1'; } catch { /* ignore */ }
  if (seen) { el.remove(); return; }
  bootOpen = true; btn.focus();
  btn.onclick = () => {
    try { sessionStorage.setItem('dq_boot', '1'); } catch { /* ignore */ }
    intro(); bootOpen = false; el.classList.add('off'); setTimeout(() => el.remove(), 600);
  };
}

/* ───────── Réseau, installation, hors ligne ───────── */
function netState() {
  $('#netLine').textContent = navigator.onLine ? 'En ligne · logos officiels' : 'Hors ligne · tout fonctionne quand même';
  if (typeof refreshThemeIcons === 'function') refreshThemeIcons();
}
addEventListener('online', netState); addEventListener('offline', netState);

let deferred = null;
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
function showInstall(on) { $('#btnInstall').hidden = !on; $('#btnInstall2').hidden = !on; $('#installNA').hidden = on; }
async function doInstall() { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch { /* ignore */ } deferred = null; showInstall(false); }
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; showInstall(true); });
addEventListener('appinstalled', () => { showInstall(false); deferred = null; toast('Application installée.'); });
$('#btnInstall').onclick = doInstall; $('#btnInstall2').onclick = doInstall;
if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
  const t = $('#iosTip'); t.hidden = false;
  t.textContent = 'Pour installer sur iPhone ou iPad : dans Safari, touchez Partager puis « Sur l\'écran d\'accueil ».';
}
function verLine() {
  const on = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
  $('#verLine').textContent = `DevQuiz ${APP_VERSION} · ${on ? 'mode hors ligne prêt' : 'mode hors ligne en préparation'}`;
}
if ('serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller;
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* HTTPS ou localhost requis */ });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      verLine();
      if (had) toast('Nouvelle version installée.', { label: 'Actualiser', fn: () => location.reload() });
      else toast('Prêt : DevQuiz fonctionne maintenant hors ligne.');
    });
  });
}

/* ───────── Initialisation ───────── */
applyTheme(); fxResize(); netState(); verLine();
addEventListener('resize', fxResize);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
renderCats(); renderIdle(); updMusicBtn(); showInstall(false);
boot();
})();
