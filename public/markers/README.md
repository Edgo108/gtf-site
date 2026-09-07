# Icônes des marqueurs « Laboratoire »

La carte interactive (`/zones`) affiche une icône par catégorie de labo :

| Fichier             | Catégorie | Utilisé par                          |
| ------------------- | --------- | ------------------------------------ |
| `arme.png`          | Arme      | `labMarkerIconUrl("arme")`           |
| `cocaine.png`       | Cocaïne   | `labMarkerIconUrl("cocaine")`        |
| `meth.png`          | Meth      | `labMarkerIconUrl("meth")`           |

Les 3 fichiers présents sont des **placeholders** générés automatiquement
(disque coloré + lettre). Remplace-les par tes vraies icônes en gardant
**exactement les mêmes noms de fichiers**.

Recommandations :

- PNG carré avec fond transparent
- ~48×48 px (affiché à 34×34 sur la carte, ancré au centre — voir
  `makeLabIcon` dans `components/zones/InteractiveMap.tsx` si tu veux
  changer la taille / l'ancrage)
- couleurs pleines : le statut « raid effectué » applique automatiquement
  un filtre `grayscale` + opacité réduite (`.gtf-lab-raided` dans
  `app/globals.css`), inutile de fournir une variante grisée
