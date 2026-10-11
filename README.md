# DevQuiz — quiz du développement web (PWA)

Application installable sur mobile et utilisable **hors ligne**. Les questions changent à chaque partie.
Aucune dépendance : HTML / CSS / JavaScript. Un seul outil optionnel (Node.js) sert à vérifier les questions.

## Tester sur votre PC (WAMP)

1. Copiez le dossier `devquiz` dans `C:\wamp64\www\`.
2. Démarrez WAMP, puis ouvrez **http://localhost/devquiz/** (jamais le fichier `index.html` en double-clic).
3. Attendez le message « Prêt : DevQuiz fonctionne maintenant hors ligne ».
4. F12 > Application > Service Workers : cochez « Offline », rechargez : tout doit fonctionner.

## Installer sur mobile

Il faut du **HTTPS** : publiez le dossier sur GitHub Pages, Netlify ou Cloudflare Pages.
Android (Chrome) : « Installer l'application ». iPhone (Safari) : Partager > Sur l'écran d'accueil.

## Contenu

67 notions et langages, **au moins 100 questions chacune** (QCM et réponses libres à format obligatoire).
Chaque partie tire des questions au hasard parmi les notions choisies, mélange l'ordre des réponses
et évite les questions déjà vues tant qu'il en reste de nouvelles.

## Son et musique

Dans l'accueil, section « Son et musique » : musique de fond pendant la partie (désactivable, avec volume),
effets sonores (bonne réponse, victoire, « wah wah wahhh » de défaite) avec volume, vibrations, et boutons d'écoute.
Pendant une partie, le bouton ♪ en haut coupe ou rétablit la musique. Tous les sons sont synthétisés par le navigateur :
aucun fichier audio, donc rien à télécharger et tout fonctionne hors ligne.

## Ajouter des questions (une notion = un fichier)

Les questions sont dans `js/questions/<id>.js` (l'id est celui de `js/themes.js`).
Une notion dont le fichier est vide s'affiche « Bientôt ». Les fichiers sont chargés à la demande,
donc on peut y mettre des milliers de questions sans ralentir le démarrage.

```js
// QCM : la BONNE réponse est toujours écrite en premier (l'ordre est mélangé à l'affichage)
M('python', "Question ?", "Bonne réponse", "Mauvaise 1", "Mauvaise 2", "Mauvaise 3", "Explication");

// Réponse libre : réponses acceptées + FORMAT OBLIGATOIRE + explication
O('git', "Quelle commande fusionne une branche ?", ['git merge'], 'gitcmd', "Explication");
O('owasp', "Nom de l'attaque ?", ['injection SQL', 'SQL injection'], ['fr', 'en'], "Explication"); // plusieurs formats possibles
```

Formats disponibles (voir `FMT` dans `js/questions.js`) : `tag` (<p>), `word`, `lower`, `prop` (CSS), `fn` (nom()),
`method`, `hook`, `upper` (MAJUSCULES), `gitcmd`, `dockercmd`, `int`, `ext`, `file`, `sym`, `en`, `fr`.
Le format est affiché au joueur. Une réponse qui ne le respecte pas est comptée comme « non trouvée ».
Vous pouvez aussi définir un format sur mesure : `{ re: /^...$/, hint: "texte affiché", ph: "exemple" }`.

## Ajouter une notion

1. Ajoutez une ligne dans `js/themes.js`.
2. Créez `js/questions/<id>.js` et, si possible, `icons/technologies/<icone>.svg`.
3. Si le logo existe dans Devicon, ajoutez-le dans `js/theme-icons.js` (`online`), sinon mettez `online: null`.

## Après chaque modification : `node tools/build.js`

Dans PowerShell, depuis le dossier du projet : `node tools\build.js`. Il :
- vérifie toutes les questions (doublons, options identiques, réponses libres qui ne respectent pas leur propre format) ;
- met à jour `js/manifest.js` (notions disponibles) ;
- régénère la liste de fichiers et le numéro de version de `sw.js`, pour que les appareils déjà installés se mettent à jour.

## Icônes

En ligne : logos officiels (Devicon, version figée). Hors ligne, ou si un logo ne charge pas : SVG locaux dans `icons/technologies/`.
Le basculement est automatique quand la connexion change.
