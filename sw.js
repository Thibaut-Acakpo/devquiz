/* DevQuiz — service worker (mode hors ligne)
 * Les fichiers de la liste ASSETS sont téléchargés à l'installation ; ensuite tout fonctionne sans connexion.
 * Stratégie : cache d'abord, puis mise à jour en arrière-plan.
 * La liste et le numéro de version sont générés par « node tools/build.js » : ne les modifiez pas à la main. */
const VERSION = 'devquiz-646b7aa470';
const ASSETS = [
/*ASSETS*/
  './',
  'css/style.css',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/favicon-64.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/logo.png',
  'icons/technologies/accessibility.svg',
  'icons/technologies/angular.svg',
  'icons/technologies/aws.svg',
  'icons/technologies/azure.svg',
  'icons/technologies/bootstrap.svg',
  'icons/technologies/c.svg',
  'icons/technologies/cloudflare.svg',
  'icons/technologies/cplusplus.svg',
  'icons/technologies/csharp.svg',
  'icons/technologies/css3.svg',
  'icons/technologies/dart.svg',
  'icons/technologies/django.svg',
  'icons/technologies/docker.svg',
  'icons/technologies/dotnet.svg',
  'icons/technologies/express.svg',
  'icons/technologies/fastapi.svg',
  'icons/technologies/flask.svg',
  'icons/technologies/flutter.svg',
  'icons/technologies/git.svg',
  'icons/technologies/github.svg',
  'icons/technologies/gitlab.svg',
  'icons/technologies/go.svg',
  'icons/technologies/googlecloud.svg',
  'icons/technologies/graphql.svg',
  'icons/technologies/html5.svg',
  'icons/technologies/http.svg',
  'icons/technologies/java.svg',
  'icons/technologies/javascript.svg',
  'icons/technologies/jira.svg',
  'icons/technologies/json.svg',
  'icons/technologies/jwt.svg',
  'icons/technologies/kotlin.svg',
  'icons/technologies/laravel.svg',
  'icons/technologies/linux.svg',
  'icons/technologies/lua.svg',
  'icons/technologies/mongodb.svg',
  'icons/technologies/mysql.svg',
  'icons/technologies/nextjs.svg',
  'icons/technologies/nodejs.svg',
  'icons/technologies/npm.svg',
  'icons/technologies/owasp.svg',
  'icons/technologies/performance.svg',
  'icons/technologies/php.svg',
  'icons/technologies/postgresql.svg',
  'icons/technologies/postman.svg',
  'icons/technologies/pwa.svg',
  'icons/technologies/python.svg',
  'icons/technologies/r.svg',
  'icons/technologies/react.svg',
  'icons/technologies/redis.svg',
  'icons/technologies/rest.svg',
  'icons/technologies/ruby.svg',
  'icons/technologies/rust.svg',
  'icons/technologies/security.svg',
  'icons/technologies/spring.svg',
  'icons/technologies/sql.svg',
  'icons/technologies/sqlite.svg',
  'icons/technologies/svelte.svg',
  'icons/technologies/swift.svg',
  'icons/technologies/symfony.svg',
  'icons/technologies/tailwindcss.svg',
  'icons/technologies/trello.svg',
  'icons/technologies/typescript.svg',
  'icons/technologies/vercel.svg',
  'icons/technologies/vscode.svg',
  'icons/technologies/vuejs.svg',
  'icons/technologies/websocket.svg',
  'index.html',
  'js/app.js',
  'js/manifest.js',
  'js/questions.js',
  'js/questions/accessibilite.js',
  'js/questions/angular.js',
  'js/questions/aws.js',
  'js/questions/azure.js',
  'js/questions/bootstrap.js',
  'js/questions/c.js',
  'js/questions/cloudflare.js',
  'js/questions/cpp.js',
  'js/questions/csharp.js',
  'js/questions/css.js',
  'js/questions/cybersecurity.js',
  'js/questions/dart.js',
  'js/questions/django.js',
  'js/questions/docker.js',
  'js/questions/dotnet.js',
  'js/questions/express.js',
  'js/questions/fastapi.js',
  'js/questions/flask.js',
  'js/questions/flutter.js',
  'js/questions/git.js',
  'js/questions/github.js',
  'js/questions/gitlab.js',
  'js/questions/go.js',
  'js/questions/google-cloud.js',
  'js/questions/graphql.js',
  'js/questions/html.js',
  'js/questions/http.js',
  'js/questions/java.js',
  'js/questions/javascript.js',
  'js/questions/jira.js',
  'js/questions/json.js',
  'js/questions/jwt.js',
  'js/questions/kotlin.js',
  'js/questions/laravel.js',
  'js/questions/linux.js',
  'js/questions/lua.js',
  'js/questions/mongodb.js',
  'js/questions/mysql.js',
  'js/questions/nextjs.js',
  'js/questions/nodejs.js',
  'js/questions/npm.js',
  'js/questions/owasp.js',
  'js/questions/performance.js',
  'js/questions/php.js',
  'js/questions/postgresql.js',
  'js/questions/postman.js',
  'js/questions/pwa.js',
  'js/questions/python.js',
  'js/questions/r.js',
  'js/questions/react.js',
  'js/questions/redis.js',
  'js/questions/rest-api.js',
  'js/questions/ruby.js',
  'js/questions/rust.js',
  'js/questions/spring.js',
  'js/questions/sql.js',
  'js/questions/sqlite.js',
  'js/questions/svelte.js',
  'js/questions/swift.js',
  'js/questions/symfony.js',
  'js/questions/tailwind.js',
  'js/questions/trello.js',
  'js/questions/typescript.js',
  'js/questions/vercel.js',
  'js/questions/vscode.js',
  'js/questions/vue.js',
  'js/questions/websocket.js',
  'js/theme-icons.js',
  'js/themes.js',
  'manifest.webmanifest'
  /*END*/
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    try { await cache.addAll(ASSETS); }
    catch (err) { await Promise.all(ASSETS.map(a => cache.add(a).catch(() => null))); }   // un fichier manquant n'empêche pas l'installation
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // logos en ligne : gérés par le navigateur

  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => null);

    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') { const page = await caches.match('index.html'); if (page) return page; }
    return Response.error();
  })());
});
