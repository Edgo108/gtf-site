import L from "leaflet";
import {
  NO_ORGANISATION_COLOR,
  type DealStatut,
} from "@/lib/supabase/deal-points-types";

// Point de deal : simple disque généré par le site (aucune image), pour
// rester distinct des épingles de labo et des zones à tous les zooms.
//   - remplissage = couleur de l'organisation, gris neutre sinon ;
//   - fin contour clair plein, lisible sur les 3 fonds de carte ;
//   - inactif : contour en pointillés + désaturé + opacité réduite
//     (.gtf-deal-inactive dans app/globals.css), jamais confondu avec un
//     point actif sans organisation (gris plein, contour plein, opaque).

// Diamètre au zoom max ; même facteur d'échelle que les icônes de labo.
const DEAL_DOT_SIZE = 18;

// La couleur vient de la B.D.D. et part dans du HTML : on n'accepte qu'un
// code hexadécimal.
function safeColor(color: string | null | undefined): string {
  return color && /^#[0-9a-f]{3,8}$/i.test(color) ? color : NO_ORGANISATION_COLOR;
}

export function makeDealPointIcon(
  color: string | null | undefined,
  statut: DealStatut,
  scale = 1,
  highlighted = false,
): L.DivIcon {
  const size = Math.max(7, Math.round(DEAL_DOT_SIZE * scale));
  const border = size >= 12 ? 2 : 1.5;
  const inactive = statut === "inactif";
  const classNames = [
    inactive ? "gtf-deal-inactive" : "",
    highlighted ? "gtf-map-highlight" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return L.divIcon({
    className: classNames,
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${safeColor(color)};border:${border}px ${inactive ? "dashed" : "solid"} #F2F4F7;box-shadow:0 0 0 1px rgba(10,12,15,0.75);box-sizing:border-box;"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
  });
}
