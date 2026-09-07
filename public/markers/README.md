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

- PNG avec fond transparent, format **portrait** (les images actuelles
  font ~537×681, ratio ~0.79)
- forme d'**épingle pointant vers le bas**, la pointe touchant quasiment
  le bas de l'image : l'icône est ancrée en bas-centre, affichée en
  44×56 px sur la carte — voir `makeLabIcon` / `LAB_ICON_W` / `LAB_ICON_H`
  dans `components/zones/InteractiveMap.tsx` pour ajuster taille et
  ancrage (si tu changes le ratio des images, ajuste `LAB_ICON_H`)
- couleurs pleines : le statut « raid effectué » applique automatiquement
  un filtre `grayscale` + opacité réduite (`.gtf-lab-raided` dans
  `app/globals.css`), inutile de fournir une variante grisée
- ~400 Ko/fichier actuellement : si tu veux alléger le chargement de la
  carte, ré-exporte-les autour de 128–256 px
