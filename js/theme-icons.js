/* DevQuiz — icônes des notions
 *  - En ligne : vrai logo (Devicon, version figée ; Simple Icons pour AWS).
 *  - Hors ligne, ou si le logo ne charge pas : SVG local dans icons/technologies/ (mis en cache par le service worker).
 *  - online: null = pas de logo officiel, on utilise toujours le SVG local.
 */
const DEVICON_VERSION = "v2.16.0";
const THEME_ICONS = {
  "html": { local: "html5", online: "html5" },
  "css": { local: "css3", online: "css3" },
  "javascript": { local: "javascript", online: "javascript" },
  "js": { local: "javascript", online: "javascript" },
  "typescript": { local: "typescript", online: "typescript" },
  "python": { local: "python", online: "python" },
  "php": { local: "php", online: "php" },
  "c": { local: "c", online: "c" },
  "cpp": { local: "cplusplus", online: "cplusplus" },
  "cplusplus": { local: "cplusplus", online: "cplusplus" },
  "csharp": { local: "csharp", online: "csharp" },
  "java": { local: "java", online: "java" },
  "kotlin": { local: "kotlin", online: "kotlin" },
  "swift": { local: "swift", online: "swift" },
  "dart": { local: "dart", online: "dart" },
  "go": { local: "go", online: "go" },
  "rust": { local: "rust", online: "rust" },
  "ruby": { local: "ruby", online: "ruby" },
  "r": { local: "r", online: "r" },
  "lua": { local: "lua", online: "lua" },
  "react": { local: "react", online: "react" },
  "vue": { local: "vuejs", online: "vuejs" },
  "vuejs": { local: "vuejs", online: "vuejs" },
  "angular": { local: "angular", online: "angular" },
  "svelte": { local: "svelte", online: "svelte" },
  "nextjs": { local: "nextjs", online: "nextjs" },
  "nodejs": { local: "nodejs", online: "nodejs" },
  "node": { local: "nodejs", online: "nodejs" },
  "express": { local: "express", online: "express" },
  "laravel": { local: "laravel", online: "laravel" },
  "symfony": { local: "symfony", online: "symfony" },
  "django": { local: "django", online: "django" },
  "flask": { local: "flask", online: "flask" },
  "fastapi": { local: "fastapi", online: "fastapi" },
  "spring": { local: "spring", online: "spring" },
  "dotnet": { local: "dotnet", online: "dotnetcore" },
  "flutter": { local: "flutter", online: "flutter" },
  "tailwindcss": { local: "tailwindcss", online: "tailwindcss" },
  "bootstrap": { local: "bootstrap", online: "bootstrap" },
  "mysql": { local: "mysql", online: "mysql" },
  "postgresql": { local: "postgresql", online: "postgresql" },
  "sqlite": { local: "sqlite", online: "sqlite" },
  "mongodb": { local: "mongodb", online: "mongodb" },
  "redis": { local: "redis", online: "redis" },
  "git": { local: "git", online: "git" },
  "github": { local: "github", online: "github" },
  "gitlab": { local: "gitlab", online: "gitlab" },
  "docker": { local: "docker", online: "docker" },
  "linux": { local: "linux", online: "linux" },
  "vscode": { local: "vscode", online: "vscode" },
  "npm": { local: "npm", online: "npm" },
  "postman": { local: "postman", online: "postman" },
  "jira": { local: "jira", online: "jira" },
  "trello": { local: "trello", online: "trello" },
  "graphql": { local: "graphql", online: "graphql" },
  "json": { local: "json", online: "json" },
  "websocket": { local: "websocket", online: "socketio" },
  "aws": { local: "aws", online: "amazonaws" },
  "azure": { local: "azure", online: "azure" },
  "googlecloud": { local: "googlecloud", online: "googlecloud" },
  "vercel": { local: "vercel", online: "vercel" },
  "cloudflare": { local: "cloudflare", online: "cloudflare" },
  "sql": { local: "sql", online: null },
  "http": { local: "http", online: null },
  "rest": { local: "rest", online: null },
  "security": { local: "security", online: null },
  "owasp": { local: "owasp", online: null },
  "jwt": { local: "jwt", online: null },
  "pwa": { local: "pwa", online: null },
  "accessibility": { local: "accessibility", online: null },
  "performance": { local: "performance", online: null }
};

function themeIconUrls(theme) {
  const cfg = THEME_ICONS[theme.id] || THEME_ICONS[theme.icon] || { local: theme.icon, online: null };
  const local = cfg.local ? `icons/technologies/${cfg.local}.svg` : null;
  let online = null;
  if (cfg.online) {
    online = cfg.online === 'amazonaws'
      ? 'https://cdn.simpleicons.org/amazonaws'
      : `https://cdn.jsdelivr.net/gh/devicons/devicon@${DEVICON_VERSION}/icons/${cfg.online}/${cfg.online}-original.svg`;
  }
  return { local, online };
}

/* Choisit la source selon l'état du réseau (appelée à la création et à chaque changement de connexion). */
function applyThemeIcon(img) {
  const { local, online } = img._urls;
  const wantOnline = !!online && navigator.onLine && !img._onlineFailed;
  const target = wantOnline ? online : local;
  if (target && img.getAttribute('src') !== target) img.src = target;
}

function createThemeIcon(theme) {
  const urls = themeIconUrls(theme);
  if (!urls.local && !urls.online) return null;
  const img = document.createElement('img');
  img.className = 'theme-icon';
  img.width = 42; img.height = 42;
  img.alt = ''; img.decoding = 'async'; img.loading = 'lazy';
  img._urls = urls; img._onlineFailed = false;
  img.onerror = () => {
    if (img.getAttribute('src') === urls.online && urls.local) { img._onlineFailed = true; img.src = urls.local; return; }
    img.onerror = null; img.remove();      // plus aucune source : l'appelant garde son repli textuel
  };
  applyThemeIcon(img);
  return img;
}

function refreshThemeIcons() {
  document.querySelectorAll('img.theme-icon').forEach(img => { img._onlineFailed = false; if (img._urls) applyThemeIcon(img); });
}
