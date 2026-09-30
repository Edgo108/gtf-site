# Icônes des marqueurs « Laboratoire »

La carte interactive (`/zones`) affiche une icône par catégorie de labo,
plus une icône dédiée au statut « Potentiel » :

| Fichier             | Catégorie / statut  | Utilisé par                                        |
| ------------------- | ------------------- | --------------------------------------------------- |
| `arme.png`          | Arme                | `labMarkerIconUrl({ statut: "actif", categorie: "arme" })` |
| `cocaine.png`       | Cocaïne             | `labMarkerIconUrl({ statut: "actif", categorie: "cocaine" })` |
| `meth.png`          | Meth                | `labMarkerIconUrl({ statut: "actif", categorie: "meth" })` |
| `potentiel.png`     | Statut « Potentiel » | `labMarkerIconUrl({ statut: "potentiel", categorie: null })` |

Le choix de l'icône est **entièrement automatique**, basé sur le statut
du marqueur (jamais un choix manuel) : `potentiel.png` s'affiche pour
tout labo au statut « Potentiel », quelle que soit sa catégorie
(renseignée ou non) — voir `labMarkerIconUrl` dans
`lib/supabase/lab-markers-types.ts`.

Pour remplacer une icône, dépose un fichier avec **exactement le même
nom** (`arme.png`, `cocaine.png`, `meth.png`, `potentiel.png`).

Recommandations :

- PNG avec fond transparent, format **portrait**, ratio ~0.79, en
  **~132×168 px** (3× la taille d'affichage, net sur écran haute
  densité). Inutile d'aller au-delà : une icône de 1000 px pèse ~1 Mo
  pour rien. Les images actuelles ont été réduites à cette taille
  (10 Ko chacune au lieu de 300 Ko à 1,2 Mo).
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
