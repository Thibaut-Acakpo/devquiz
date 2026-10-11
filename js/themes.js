/* DevQuiz — catalogue des notions
 * Pour ajouter une notion : ajoutez une ligne ici, créez js/questions/<id>.js
 * (et si possible une icône icons/technologies/<icon>.svg), puis lancez : node tools/build.js
 * Une notion sans question s'affiche « Bientôt » et ne peut pas être choisie.
 */
const THEMES = [
  /* ───────── Langages ───────── */
  { id: "html", name: "HTML", category: "Langages", icon: "html" },
  { id: "css", name: "CSS", category: "Langages", icon: "css" },
  { id: "javascript", name: "JavaScript", category: "Langages", icon: "javascript" },
  { id: "typescript", name: "TypeScript", category: "Langages", icon: "typescript" },
  { id: "python", name: "Python", category: "Langages", icon: "python" },
  { id: "php", name: "PHP", category: "Langages", icon: "php" },
  { id: "c", name: "C", category: "Langages", icon: "c" },
  { id: "cpp", name: "C++", category: "Langages", icon: "cpp" },
  { id: "csharp", name: "C#", category: "Langages", icon: "csharp" },
  { id: "java", name: "Java", category: "Langages", icon: "java" },
  { id: "kotlin", name: "Kotlin", category: "Langages", icon: "kotlin" },
  { id: "swift", name: "Swift", category: "Langages", icon: "swift" },
  { id: "dart", name: "Dart", category: "Langages", icon: "dart" },
  { id: "go", name: "Go", category: "Langages", icon: "go" },
  { id: "rust", name: "Rust", category: "Langages", icon: "rust" },
  { id: "ruby", name: "Ruby", category: "Langages", icon: "ruby" },
  { id: "r", name: "R", category: "Langages", icon: "r" },
  { id: "lua", name: "Lua", category: "Langages", icon: "lua" },

  /* ───────── Frameworks ───────── */
  { id: "react", name: "React", category: "Frameworks", icon: "react" },
  { id: "vue", name: "Vue.js", category: "Frameworks", icon: "vue" },
  { id: "angular", name: "Angular", category: "Frameworks", icon: "angular" },
  { id: "svelte", name: "Svelte", category: "Frameworks", icon: "svelte" },
  { id: "nextjs", name: "Next.js", category: "Frameworks", icon: "nextjs" },
  { id: "nodejs", name: "Node.js", category: "Frameworks", icon: "nodejs" },
  { id: "express", name: "Express.js", category: "Frameworks", icon: "express" },
  { id: "laravel", name: "Laravel", category: "Frameworks", icon: "laravel" },
  { id: "symfony", name: "Symfony", category: "Frameworks", icon: "symfony" },
  { id: "django", name: "Django", category: "Frameworks", icon: "django" },
  { id: "flask", name: "Flask", category: "Frameworks", icon: "flask" },
  { id: "fastapi", name: "FastAPI", category: "Frameworks", icon: "fastapi" },
  { id: "spring", name: "Spring", category: "Frameworks", icon: "spring" },
  { id: "dotnet", name: ".NET", category: "Frameworks", icon: "dotnet" },
  { id: "flutter", name: "Flutter", category: "Frameworks", icon: "flutter" },
  { id: "tailwind", name: "Tailwind CSS", category: "Frameworks", icon: "tailwindcss" },
  { id: "bootstrap", name: "Bootstrap", category: "Frameworks", icon: "bootstrap" },

  /* ───────── Bases de données ───────── */
  { id: "sql", name: "SQL", category: "Bases de données", icon: "sql" },
  { id: "mysql", name: "MySQL", category: "Bases de données", icon: "mysql" },
  { id: "postgresql", name: "PostgreSQL", category: "Bases de données", icon: "postgresql" },
  { id: "sqlite", name: "SQLite", category: "Bases de données", icon: "sqlite" },
  { id: "mongodb", name: "MongoDB", category: "Bases de données", icon: "mongodb" },
  { id: "redis", name: "Redis", category: "Bases de données", icon: "redis" },

  /* ───────── Outils ───────── */
  { id: "git", name: "Git", category: "Outils", icon: "git" },
  { id: "github", name: "GitHub", category: "Outils", icon: "github" },
  { id: "gitlab", name: "GitLab", category: "Outils", icon: "gitlab" },
  { id: "docker", name: "Docker", category: "Outils", icon: "docker" },
  { id: "linux", name: "Linux", category: "Outils", icon: "linux" },
  { id: "vscode", name: "Visual Studio Code", category: "Outils", icon: "vscode" },
  { id: "npm", name: "npm", category: "Outils", icon: "npm" },
  { id: "postman", name: "Postman", category: "Outils", icon: "postman" },
  { id: "jira", name: "Jira", category: "Outils", icon: "jira" },
  { id: "trello", name: "Trello", category: "Outils", icon: "trello" },

  /* ───────── Web & API ───────── */
  { id: "http", name: "HTTP", category: "Web & API", icon: "http" },
  { id: "rest-api", name: "REST API", category: "Web & API", icon: "rest" },
  { id: "graphql", name: "GraphQL", category: "Web & API", icon: "graphql" },
  { id: "json", name: "JSON", category: "Web & API", icon: "json" },
  { id: "websocket", name: "WebSocket", category: "Web & API", icon: "websocket" },
  { id: "pwa", name: "PWA & hors ligne", category: "Web & API", icon: "pwa" },
  { id: "accessibilite", name: "Accessibilité", category: "Web & API", icon: "accessibility" },
  { id: "performance", name: "Performance web", category: "Web & API", icon: "performance" },

  /* ───────── Sécurité ───────── */
  { id: "cybersecurity", name: "Cybersécurité", category: "Sécurité", icon: "security" },
  { id: "owasp", name: "OWASP", category: "Sécurité", icon: "owasp" },
  { id: "jwt", name: "JWT", category: "Sécurité", icon: "jwt" },

  /* ───────── Cloud ───────── */
  { id: "aws", name: "Amazon Web Services", category: "Cloud", icon: "aws" },
  { id: "azure", name: "Microsoft Azure", category: "Cloud", icon: "azure" },
  { id: "google-cloud", name: "Google Cloud", category: "Cloud", icon: "googlecloud" },
  { id: "vercel", name: "Vercel", category: "Cloud", icon: "vercel" },
  { id: "cloudflare", name: "Cloudflare", category: "Cloud", icon: "cloudflare" }
];
