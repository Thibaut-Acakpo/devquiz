# DevQuiz — le quiz des développeurs (PWA)

Application installable sur mobile et utilisable **hors ligne**. 67 notions et langages, au moins 100 questions chacune
(QCM et réponses libres à format obligatoire). Aucune dépendance : HTML / CSS / JavaScript.

## Interface

Une seule page : la carte centrale sert à la fois d'accueil et de partie. Tout le reste s'ouvre dans des fenêtres de dialogue :
notions et langages, réglages (bouton engrenage en haut à droite), statistiques, aide, résultats, confirmations.
Thème sombre par défaut, aux couleurs du logo (marine, cyan, bleu, violet, jaune, rouge, vert) ; thèmes clair et automatique disponibles dans les réglages.

## Points

Une partie vaut toujours **100 points**. Chaque question vaut 100 ÷ nombre de questions (10, 20, 25, 50 ou 100 questions :
10, 5, 4, 2 ou 1 point). Pas de bonus de vitesse, pas de points variables, pas de validation manuelle d'une réponse.

## Réponses libres

Le format exigé est affiché sous la question. Une réponse qui ne respecte pas le format est comptée comme non trouvée.

## Sons

- Son d'entrée (à l'appui sur « Entrer ») : différent de tous les sons de jeu.
- Musique de fond pendant la partie uniquement, désactivable (réglages ou bouton haut-parleur).
- Bonne réponse : carillon. Mauvaise réponse : « wah wah wahhh ». Partie gagnée (≥ 75) : fanfare. Partie perdue (< 50) : chant de défaite.
- Volumes séparés, vibrations. Tout est synthétisé : aucun fichier audio.

## Fonctions utiles

Reprise de la partie interrompue, « Rejouer mes erreurs », statistiques par notion (notions à travailler), chronomètre suspendu
quand une fenêtre est ouverte ou que l'onglet est caché, mise à jour avec bouton « Actualiser ».

## Tester sur votre PC (WAMP)

1. Copiez le dossier `devquiz` dans `C:\wamp64\www\`.
2. Ouvrez **http://localhost/devquiz/** (jamais le fichier `index.html` en double-clic).
3. F12 > Application > Service Workers : cochez « Offline », rechargez : tout doit fonctionner.

## Publier (GitHub Pages) et installer sur mobile

HTTPS obligatoire pour l'installation. Android (Chrome) : « Installer ». iPhone (Safari) : Partager > Sur l'écran d'accueil.

## Ajouter des questions

Une notion = un fichier `js/questions/<id>.js` (voir `js/themes.js` pour les identifiants) :

```js
M('python', "Question ?", "Bonne réponse", "Mauvaise 1", "Mauvaise 2", "Mauvaise 3", "Explication");   // QCM
O('git', "Quelle commande fusionne une branche ?", ['git merge'], 'gitcmd', "Explication");            // réponse libre + format
```

Formats : `tag`, `word`, `lower`, `prop`, `fn`, `method`, `hook`, `upper`, `gitcmd`, `dockercmd`, `cmd`, `dash`, `int`, `ext`, `file`, `sym`, `en`, `fr`
(voir `FMT` dans `js/questions.js`), ou un format sur mesure `{ re, hint, ph }`.

**Après chaque modification** : `node tools\build.js` (vérifie les questions, met à jour la liste des notions et le cache hors ligne).

## Sécurité

Politique de sécurité du contenu (CSP) stricte : aucun script ni style en ligne, seules les icônes de langages sont chargées
depuis un CDN (avec repli sur des SVG locaux).
