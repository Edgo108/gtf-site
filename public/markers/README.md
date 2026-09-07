# Icônes des marqueurs « Laboratoire »

La carte interactive (`/zones`) affiche une icône par catégorie de labo :

| Fichier             | Catégorie | Utilisé par                          |
| ------------------- | --------- | ------------------------------------ |
| `arme.png`          | Arme      | `labMarkerIconUrl("arme")`           |
| `cocaine.png`       | Cocaïne   | `labMarkerIconUrl("cocaine")`        |
| `meth.png`          | Meth      | `labMarkerIconUrl("meth")`           |

Pour remplacer une icône, dépose un fichier avec **exactement le même
nom** (`arme.png`, `cocaine.png`, `meth.png`).

Recommandations :

- PNG **carré** avec fond transparent (les images actuelles font 724×724)
- forme d'**épingle pointant vers le bas** : l'icône est ancrée près de
  sa pointe basse (≈ 90 % de la hauteur), affichée à 44 px sur la carte —
  voir `makeLabIcon` / `LAB_ICON_SIZE` dans
  `components/zones/InteractiveMap.tsx` pour ajuster taille et ancrage
- couleurs pleines : le statut « raid effectué » applique automatiquement
  un filtre `grayscale` + opacité réduite (`.gtf-lab-raided` dans
  `app/globals.css`), inutile de fournir une variante grisée
- ~400 Ko/fichier actuellement : si tu veux alléger le chargement de la
  carte, ré-exporte-les autour de 128–256 px
