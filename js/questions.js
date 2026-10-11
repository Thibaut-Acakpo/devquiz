/* DevQuiz — noyau de la banque de questions
 *
 * Les questions sont dans js/questions/<id-de-la-notion>.js (un fichier par notion, chargé à la demande).
 *
 *   M(notion, question, BONNE réponse, mauvaise 1, mauvaise 2, mauvaise 3, explication)
 *       QCM : la bonne réponse est toujours écrite en premier, l'ordre est mélangé à l'affichage.
 *
 *   O(notion, question, [réponses acceptées], format, explication)
 *       Réponse libre. `format` est OBLIGATOIRE : nom d'un format de FMT (ou liste de noms,
 *       ou objet { re, hint, ph }). Si la réponse de l'utilisateur ne respecte aucun des formats,
 *       elle est comptée comme « non trouvée », même si le fond est bon.
 *       Chaque réponse acceptée doit elle-même respecter un des formats (vérifié par tools/build.js).
 */
const Q = [];

/* Formats de réponse libre.
 *   re     : expression régulière que la réponse (telle que tapée) doit respecter
 *   hint   : texte affiché à l'utilisateur ("Format obligatoire : …")
 *   ph     : exemple affiché dans le champ de saisie
 *   tol    : tolère une faute de frappe (mots longs uniquement)
 *   prefix : accepte des arguments supplémentaires après la réponse (ex. git commit -m "…")
 *   raw    : comparaison exacte, casse comprise (pour les symboles) */
const FMT = {
  tag:    { re: /^<[a-z][a-z0-9-]*\s*\/?>$/i, hint: 'la balise avec ses chevrons, ex. <p>', ph: '<balise>' },
  word:   { re: /^[A-Za-z0-9_$-]+$/, hint: 'un seul mot, sans espace', ph: 'mot' },
  lower:  { re: /^[a-z][a-z0-9_-]*$/, hint: 'un seul mot, en minuscules', ph: 'mot' },
  prop:   { re: /^[a-z]+(-[a-z]+)*$/, hint: 'nom de propriété CSS, en minuscules, avec des tirets si besoin', ph: 'ma-propriete' },
  fn:     { re: /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*\(\)$/, hint: 'le nom suivi de parenthèses, ex. maFonction()', ph: 'nom()' },
  method: { re: /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*(\(\))?$/, hint: 'nom de méthode, éventuellement préfixé, ex. Objet.methode', ph: 'Objet.methode' },
  hook:   { re: /^use[A-Z][A-Za-z0-9]*$/, hint: 'nom du hook en camelCase, ex. useRef', ph: 'useXxx' },
  upper:  { re: /^[A-Z][A-Z0-9_]*( [A-Z][A-Z0-9_]*)*$/, hint: 'en MAJUSCULES, ex. SELECT', ph: 'MOT' },
  gitcmd: { re: /^git [a-z][a-z-]*( \S+)*$/, hint: 'commande complète commençant par git, ex. git add', ph: 'git commande', prefix: true },
  dockercmd: { re: /^docker [a-z][a-z-]*( \S+)*$/, hint: 'commande complète commençant par docker, ex. docker ps', ph: 'docker commande', prefix: true },
  int:    { re: /^\d+$/, hint: 'un nombre entier, chiffres uniquement', ph: '000' },
  ext:    { re: /^\.[a-z0-9]+$/, hint: "l'extension avec le point, ex. .php", ph: '.ext' },
  file:   { re: /^[A-Za-z0-9_.-]+$/, hint: 'un nom de fichier ou un mot, sans espace', ph: 'nom.ext' },
  sym:    { re: /^\S{1,5}$/, hint: 'le symbole seul, sans espace', ph: '??', raw: true },
  cmd:    { re: /^[a-z][\w.-]*( \S+)+$/, hint: 'commande complète, ex. npm install', ph: 'commande argument', prefix: true },
  dash:   { re: /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, hint: 'en minuscules, mots séparés par des tirets', ph: 'mot-mot' },
  en:     { re: /^[A-Za-z]+( [A-Za-z]+)*$/, hint: 'en anglais, mots séparés par des espaces, sans ponctuation', ph: 'mots en anglais', tol: true },
  fr:     { re: /^[A-Za-zÀ-ÿ'’-]+( [A-Za-zÀ-ÿ'’-]+)*$/, hint: 'en français, mots séparés par des espaces', ph: 'quelques mots', tol: true }
};

/* ───────── Outils partagés (navigateur + tools/build.js) ───────── */
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9_ ]+/g, ' ').replace(/\s+/g, ' ').trim();

function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/* Vérifie une réponse libre. fmtOk = le format est respecté ; ok = format respecté ET bonne réponse. */
function checkOpen(q, input) {
  const v = String(input == null ? '' : input).trim();
  const good = q.f.filter(f => f.re.test(v));
  if (!v || !good.length) return { fmtOk: false, ok: false };
  const ok = good.some(f => q.a.some(a => {
    if (f.raw) return v === a;
    const u = norm(v), t = norm(a);
    if (!u) return false;
    if (u === t) return true;
    if (f.prefix && u.startsWith(t + ' ')) return true;
    if (f.tol) { const tol = t.length >= 9 ? 2 : t.length >= 5 ? 1 : 0; return tol > 0 && lev(u, t) <= tol; }
    return false;
  }));
  return { fmtOk: true, ok };
}

/* ───────── Aides d'écriture des questions ───────── */
const M = (c, q, a, b, d, e, x) => Q.push({ t: 'm', c, q, o: [a, b, d, e], x: x || '' });
const O = (c, q, a, f, x) => {
  if (!f) throw new Error('Format manquant pour la question : ' + q);
  const list = (Array.isArray(f) ? f : [f]).map(k => {
    if (typeof k === 'string') { if (!FMT[k]) throw new Error('Format inconnu « ' + k + ' » : ' + q); return FMT[k]; }
    return k;
  });
  Q.push({ t: 'o', c, q, a, f: list, x: x || '' });
};
