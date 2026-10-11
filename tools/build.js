#!/usr/bin/env node
/* DevQuiz — outil de construction
 *   node tools/build.js
 *
 * 1. vérifie chaque fichier js/questions/<id>.js (structure, doublons, formats des réponses libres) ;
 * 2. écrit js/manifest.js (quelles notions ont des questions) ;
 * 3. régénère la liste de fichiers et le numéro de version de sw.js (mode hors ligne).
 *
 * À relancer après chaque ajout ou modification de question, de notion ou d'icône. */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(rd('js/questions.js') + '\n;globalThis.__core={Q,FMT,checkOpen,norm};', ctx);
vm.runInContext(rd('js/themes.js') + '\n;globalThis.__themes=THEMES;', ctx);
const { Q, FMT, checkOpen } = ctx.__core, THEMES = ctx.__themes;

const errors = [], warns = [], packs = {};
const ids = new Set(THEMES.map(t => t.id));
if (ids.size !== THEMES.length) errors.push('themes.js : identifiants de notion en double');
THEMES.forEach(t => {
  if (!t.icon) warns.push(`${t.id} : pas d'icône déclarée`);
  else if (!fs.existsSync(path.join(ROOT, 'icons/technologies', t.icon + '.svg')) && !/googlecloud|tailwind/.test(t.icon)) {
    const m = rd('js/theme-icons.js').match(new RegExp('"' + t.id + '"\\s*:\\s*\\{\\s*local:\\s*"([^"]+)"'));
    if (!m || !fs.existsSync(path.join(ROOT, 'icons/technologies', m[1] + '.svg'))) warns.push(`${t.id} : icône SVG locale introuvable (icons/technologies/${t.icon}.svg)`);
  }
});

const dir = path.join(ROOT, 'js/questions');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) {
  const id = f.replace(/\.js$/, ''), code = fs.readFileSync(path.join(dir, f), 'utf8');
  if (!ids.has(id)) { warns.push(`js/questions/${f} : aucune notion « ${id} » dans themes.js (fichier ignoré)`); continue; }
  if (!code.trim()) continue;                                   // fichier vide = notion « bientôt »
  const before = Q.length;
  try { vm.runInContext(code, ctx, { filename: f }); } catch (e) { errors.push(`${f} : ${e.message}`); continue; }
  const seen = new Set(); let m = 0, o = 0;
  for (const q of Q.slice(before)) {
    const tag = `${f} : « ${String(q.q).slice(0, 50)} »`;
    if (q.c !== id) errors.push(`${tag} — notion « ${q.c} » dans le fichier de « ${id} »`);
    if (!q.q || q.q.length < 8) errors.push(`${tag} — énoncé trop court`);
    if (seen.has(q.q)) errors.push(`${tag} — doublon`); seen.add(q.q);
    if (q.t === 'm') {
      m++;
      if (q.o.some(x => typeof x !== 'string' || !x.trim())) errors.push(`${tag} — option vide`);
      else if (new Set(q.o.map(x => x.trim().toLowerCase())).size !== 4) errors.push(`${tag} — les 4 options doivent être différentes`);
      if (!q.x) warns.push(`${tag} — pas d'explication`);
    } else {
      o++;
      if (!Array.isArray(q.a) || !q.a.length) errors.push(`${tag} — aucune réponse acceptée`);
      else for (const a of q.a) { if (!checkOpen(q, a).ok) errors.push(`${tag} — la réponse acceptée « ${a} » ne respecte pas son propre format`); }
      if (!q.f || !q.f.length) errors.push(`${tag} — format manquant`);
    }
  }
  packs[id] = { m, o };
}

if (errors.length) { console.error('\n✘ ' + errors.length + ' erreur(s) :\n - ' + errors.join('\n - ')); process.exit(1); }

fs.writeFileSync(path.join(ROOT, 'js/manifest.js'),
  '/* Généré par tools/build.js — ne pas modifier à la main. */\nconst PACKS = ' + JSON.stringify(packs) + ';\n');

/* Service worker : liste des fichiers + version (empreinte du contenu) */
const files = [];
const walk = (d, skip = []) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).forEach(e => {
  const rel = path.posix.join(d, e.name);
  if (e.isDirectory()) walk(rel, skip);
  else files.push(rel);
});
['index.html', 'manifest.webmanifest'].forEach(f => files.push(f));
walk('css'); walk('icons'); walk('js');
const assets = files.filter(f => !/^js\/questions\//.test(f) || packs[path.basename(f, '.js')]).sort();
const h = crypto.createHash('sha1');
assets.forEach(f => { h.update(f); h.update(fs.readFileSync(path.join(ROOT, f))); });
const version = 'devquiz-' + h.digest('hex').slice(0, 10);
let sw = rd('sw.js');
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`)
  .replace(/\/\*ASSETS\*\/[\s\S]*?\/\*END\*\//, '/*ASSETS*/\n  \'./\',\n' + assets.map(a => `  '${a}'`).join(',\n') + '\n  /*END*/');
fs.writeFileSync(path.join(ROOT, 'sw.js'), sw);

const nQ = Object.values(packs).reduce((n, p) => n + p.m + p.o, 0);
console.log(`✔ ${Object.keys(packs).length}/${THEMES.length} notions avec questions · ${nQ} questions · ${assets.length} fichiers en cache · ${version}`);
if (warns.length) console.log('\nAvertissements :\n - ' + warns.join('\n - '));
