"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { createClient } from "@/lib/supabase/client";
import {
  createZone,
  updateZone,
  deleteZone,
  acquireLock,
  releaseLock,
  getLocksWithPseudos,
} from "@/app/(app)/zones/actions";
import {
  createLabMarker,
  updateLabMarker,
  deleteLabMarker,
  acquireLabLock,
  releaseLabLock,
  getLabLocksWithPseudos,
} from "@/app/(app)/zones/lab-actions";
import {
  createDealPoint,
  updateDealPoint,
  deleteDealPoint,
  acquireDealLock,
  releaseDealLock,
  getDealLocksWithPseudos,
} from "@/app/(app)/zones/deal-actions";
import { ZoneDetailModal } from "./ZoneDetailModal";
import { LabMarkerDetailModal } from "./LabMarkerDetailModal";
import { DealPointDetailModal } from "./DealPointDetailModal";
import {
  DealPointFormPanel,
  EMPTY_DEAL_DRAFT,
  type DealPointDraft,
} from "./DealPointFormPanel";
import { makeDealPointIcon } from "./deal-point-icon";
import { InvestigationAutocomplete } from "./InvestigationAutocomplete";
import type { Gang } from "@/lib/supabase/gangs-types";
import type {
  SensitiveZone,
  ZonePoint,
  ZoneType,
} from "@/lib/supabase/zones-types";
import { LOCK_DURATION_MS } from "@/lib/supabase/zones-types";
import {
  LAB_CATEGORIE_OPTIONS,
  LAB_STATUT_OPTIONS,
  labMarkerIconUrl,
  type LabCategorie,
  type LabMarker,
  type LabStatut,
} from "@/lib/supabase/lab-markers-types";
import {
  NO_ORGANISATION_COLOR,
  type DealPoint,
  type DealProduit,
} from "@/lib/supabase/deal-points-types";
import type { Investigation } from "@/lib/supabase/investigations-types";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/ToastProvider";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { btn, fieldCompactClass } from "@/lib/ui/styles";
import { keepIfUnchanged } from "@/lib/ui/keep-if-unchanged";

type InvestigationOption = Pick<Investigation, "id" | "titre">;

const MAP_LAYERS = [
  { value: "atlas", label: "Atlas", url: "/map/atlas.webp" },
  { value: "satellite", label: "Satellite", url: "/map/satellite.webp" },
  { value: "road", label: "Routière", url: "/map/road.webp" },
] as const;

type MapLayerKey = (typeof MAP_LAYERS)[number]["value"];

type LockInfo = { locked_by: string; locked_at: string; pseudo: string };

type Mode =
  | "view"
  | "drawing"
  | "editing"
  | "lab-placing"
  | "lab-editing"
  | "deal-placing"
  | "deal-editing";

const POLL_INTERVAL_MS = 20_000;

function pointsToLatLngs(points: ZonePoint[]): L.LatLngExpression[] {
  return points.map((p) => [p.y, p.x]);
}

function latLngToPoint(latlng: L.LatLng): ZonePoint {
  return { x: latlng.lng, y: latlng.lat };
}

function makeHandleIcon(): L.DivIcon {
  // Au doigt, une poignée de 12 px est quasi impossible à saisir : sur un
  // écran tactile la zone cliquable passe à 32 px (le point visible reste
  // petit, centré dedans).
  const coarse =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;
  const size = coarse ? 32 : 12;
  const dot = coarse ? 16 : 12;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;"><div style="width:${dot}px;height:${dot}px;border-radius:9999px;background:#5B94D6;border:2px solid #0A0C0F;box-shadow:0 0 0 1px #5B94D6;box-sizing:border-box;"></div></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Icônes en forme d'épingle (pointe vers le bas). Les fichiers fournis
// sont au format portrait (~537×681, ratio ~0.79) et la pointe touche
// quasiment le bas de l'image → l'ancre est en bas-centre.
// Taille à zoom max ; divisée par 1.5 à chaque cran de dézoom (voir
// labScaleForZoom / l'écouteur "zoomend").
const LAB_ICON_W = 44;
const LAB_ICON_H = 56;

function labScaleForZoom(map: L.Map): number {
  return 1 / Math.pow(1.5, map.getMaxZoom() - map.getZoom());
}

function makeLabIcon(
  categorie: LabCategorie | null,
  statut: LabStatut,
  scale = 1,
  highlighted = false,
): L.Icon {
  const w = Math.max(6, Math.round(LAB_ICON_W * scale));
  const h = Math.max(8, Math.round(LAB_ICON_H * scale));
  const tip = Math.round(2 * scale);
  const classNames = [
    // Statut "raided" : marqueur grisé/désaturé (voir .gtf-lab-raided
    // dans app/globals.css), tout en restant cliquable.
    statut === "raided" ? "gtf-lab-raided" : "",
    // Surbrillance temporaire « Voir le QG sur la carte » (fiche B.D.D.) :
    // halo pulsant, voir .gtf-map-highlight dans app/globals.css.
    highlighted ? "gtf-map-highlight" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return L.icon({
    // Icône déterminée uniquement par le statut : "?" pour un labo
    // potentiel (categorie inconnue ou pas encore confirmée), quelle
    // que soit la valeur de categorie — voir labMarkerIconUrl.
    iconUrl: labMarkerIconUrl({ statut, categorie }),
    iconSize: [w, h],
    iconAnchor: [w / 2, h - tip],
    tooltipAnchor: [0, -(h - tip)],
    className: classNames,
  });
}

// --- Filtres d'affichage de la carte ---------------------------------

const DEFAULT_FILTERS = {
  zoneVente: true,
  zoneQg: true,
  // Zones de vente sans gang attribué.
  zoneSansGang: true,
  labArme: true,
  labCocaine: true,
  labMeth: true,
  labActif: true,
  labRaided: true,
  labPotentiel: true,
  dealCocaine: true,
  dealMeth: true,
  dealWeed: true,
  dealActif: true,
  dealInactif: true,
};
type FilterKey = keyof typeof DEFAULT_FILTERS;

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5 text-xs text-gtf-text">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 accent-gtf-blue-hover"
      />
      {label}
    </label>
  );
}

// Question "Lier ce labo à une enquête ?" (formulaires de placement et
// d'édition d'un labo) : Oui/Non, avec recherche par titre parmi les
// enquêtes existantes si Oui (pas de texte libre, voir
// InvestigationAutocomplete).
function LinkInvestigationField({
  linked,
  onLinkedChange,
  investigationId,
  onInvestigationIdChange,
  investigations,
  panelLabelClass,
  panelSelectClass,
}: {
  linked: boolean;
  onLinkedChange: (linked: boolean) => void;
  investigationId: string;
  onInvestigationIdChange: (id: string) => void;
  investigations: InvestigationOption[];
  panelLabelClass: string;
  panelSelectClass: string;
}) {
  return (
    <div className="mt-2">
      <label className={panelLabelClass}>Lier ce labo à une enquête ?</label>
      <div className="flex gap-3 text-xs text-gtf-text">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={!linked}
            onChange={() => {
              onLinkedChange(false);
              onInvestigationIdChange("");
            }}
          />
          Non
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={linked}
            onChange={() => onLinkedChange(true)}
          />
          Oui
        </label>
      </div>
      {linked && (
        <div className="mt-2">
          <InvestigationAutocomplete
            investigations={investigations}
            value={investigationId}
            onChange={onInvestigationIdChange}
            inputClassName={panelSelectClass}
          />
        </div>
      )}
    </div>
  );
}

// Durée d'affichage de la surbrillance déclenchée depuis la fiche B.D.D.
// (« Voir le QG sur la carte ») avant qu'elle ne s'efface toute seule.
const HIGHLIGHT_DURATION_MS = 6_000;

export function InteractiveMap({
  currentUserId,
  canWrite,
  highlightGangId,
}: {
  currentUserId: string;
  canWrite: boolean;
  highlightGangId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const imageOverlayRef = useRef<L.ImageOverlay | null>(null);
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);
  const drawLayerRef = useRef<L.LayerGroup | null>(null);
  const labsLayerRef = useRef<L.LayerGroup | null>(null);
  const labDraftLayerRef = useRef<L.LayerGroup | null>(null);
  const dealsLayerRef = useRef<L.LayerGroup | null>(null);
  const dealDraftLayerRef = useRef<L.LayerGroup | null>(null);
  const modeRef = useRef<Mode>("view");
  const drawingPointsRef = useRef<ZonePoint[]>([]);
  const labEditPosRef = useRef<ZonePoint | null>(null);
  const dealEditPosRef = useRef<ZonePoint | null>(null);

  const [layer, setLayer] = useState<MapLayerKey>("atlas");
  // Facteur d'échelle des icônes labo selon le zoom (1 au zoom max).
  const [labIconScale, setLabIconScale] = useState(1);

  // Filtres d'affichage (panneau en haut à droite). Tout coché = tout
  // visible. Décocher pour masquer.
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  function toggleFilter(key: FilterKey) {
    setFilters((f) => ({ ...f, [key]: !f[key] }));
  }
  const [gangs, setGangs] = useState<Gang[]>([]);
  const [zones, setZones] = useState<SensitiveZone[]>([]);
  const [labMarkers, setLabMarkers] = useState<LabMarker[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationOption[]>(
    [],
  );
  const [locks, setLocks] = useState<Map<string, LockInfo>>(new Map());
  const [labLocks, setLabLocks] = useState<Map<string, LockInfo>>(new Map());
  const [dealPoints, setDealPoints] = useState<DealPoint[]>([]);
  const [dealLocks, setDealLocks] = useState<Map<string, LockInfo>>(new Map());

  const [mode, setMode] = useState<Mode>("view");

  const run = useActionRunner();
  const toast = useToast();
  // État de chargement : la carte (image + Leaflet) et les données Supabase
  // sont deux chargements indépendants ; l'overlay reste affiché tant que
  // l'un des deux n'est pas prêt.
  const [mapReady, setMapReady] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dataError, setDataError] = useState(false);
  const [mapImageError, setMapImageError] = useState(false);
  const [layerLoading, setLayerLoading] = useState(false);
  const pollFailedRef = useRef(false);

  // --- zones : dessin / édition ---
  const [drawingPoints, setDrawingPoints] = useState<ZonePoint[]>([]);
  const [drawGangId, setDrawGangId] = useState("");
  const [drawType, setDrawType] = useState<ZoneType>("vente");
  const [drawError, setDrawError] = useState<string | null>(null);
  const [drawPending, setDrawPending] = useState(false);

  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editingPoints, setEditingPoints] = useState<ZonePoint[]>([]);
  const [editGangId, setEditGangId] = useState("");
  const [editType, setEditType] = useState<ZoneType>("vente");
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, setEditPending] = useState(false);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // --- labos : placement / édition ---
  const [labPlacePos, setLabPlacePos] = useState<ZonePoint | null>(null);
  const [labPlaceCat, setLabPlaceCat] = useState<LabCategorie | "">("arme");
  const [labPlaceStatut, setLabPlaceStatut] = useState<LabStatut>("actif");
  const [labPlaceOrg, setLabPlaceOrg] = useState("");
  const [labPlaceLinkInvestigation, setLabPlaceLinkInvestigation] =
    useState(false);
  const [labPlaceInvestigationId, setLabPlaceInvestigationId] = useState("");
  const [labPlaceError, setLabPlaceError] = useState<string | null>(null);
  const [labPlacePending, setLabPlacePending] = useState(false);

  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const [labEditPos, setLabEditPos] = useState<ZonePoint | null>(null);
  const [labEditCat, setLabEditCat] = useState<LabCategorie | "">("arme");
  const [labEditStatut, setLabEditStatut] = useState<LabStatut>("actif");
  const [labEditOrg, setLabEditOrg] = useState("");
  const [labEditLinkInvestigation, setLabEditLinkInvestigation] =
    useState(false);
  const [labEditInvestigationId, setLabEditInvestigationId] = useState("");
  const [labEditError, setLabEditError] = useState<string | null>(null);
  const [labEditPending, setLabEditPending] = useState(false);

  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [labModalError, setLabModalError] = useState<string | null>(null);

  // --- points de deal : placement / édition ---
  const [dealPlacePos, setDealPlacePos] = useState<ZonePoint | null>(null);
  const [dealPlaceDraft, setDealPlaceDraft] =
    useState<DealPointDraft>(EMPTY_DEAL_DRAFT);
  const [dealPlaceError, setDealPlaceError] = useState<string | null>(null);
  const [dealPlacePending, setDealPlacePending] = useState(false);

  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [dealEditPos, setDealEditPos] = useState<ZonePoint | null>(null);
  const [dealEditDraft, setDealEditDraft] =
    useState<DealPointDraft>(EMPTY_DEAL_DRAFT);
  const [dealEditError, setDealEditError] = useState<string | null>(null);
  const [dealEditPending, setDealEditPending] = useState(false);

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [dealModalError, setDealModalError] = useState<string | null>(null);

  // --- Surbrillance « Voir le QG sur la carte » (depuis la fiche B.D.D.) --
  // Volontairement temporaire (s'efface toute seule) plutôt que persistante
  // tant que rien n'indique le contraire côté utilisateur. Pas de
  // recentrage/zoom automatique : la carte garde son état habituel.
  const [highlightedGangId, setHighlightedGangId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!highlightGangId) return;
    // Synchronisation avec un paramètre d'URL externe (arrivée depuis la
    // fiche B.D.D.) + minuteur d'effacement automatique : cas d'usage
    // explicitement prévu pour un effet, pas un état dérivable en rendu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightedGangId(highlightGangId);
    const timeout = setTimeout(
      () => setHighlightedGangId(null),
      HIGHLIGHT_DURATION_MS,
    );
    return () => clearTimeout(timeout);
  }, [highlightGangId]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    drawingPointsRef.current = drawingPoints;
  }, [drawingPoints]);
  useEffect(() => {
    labEditPosRef.current = labEditPos;
  }, [labEditPos]);
  useEffect(() => {
    dealEditPosRef.current = dealEditPos;
  }, [dealEditPos]);

  // --- Chargement initial + rafraîchissement périodique ------------------

  // Échec réseau/serveur du chargement ou du sondage : un seul toast tant
  // que ça dure (le sondage réessaie tout seul toutes les 20 s), puis un
  // toast de rétablissement.
  function reportPollFailure() {
    setDataError(true);
    if (!pollFailedRef.current) {
      pollFailedRef.current = true;
      toast.error(
        "Connexion perdue : la carte n'est plus mise à jour. Nouvelle tentative automatique…",
      );
    }
  }

  function reportPollSuccess() {
    setDataError(false);
    if (pollFailedRef.current) {
      pollFailedRef.current = false;
      toast.success("Connexion rétablie : la carte est à jour.");
    }
  }

  async function fetchMapData() {
    try {
      const supabase = createClient();
      const [gangsRes, zonesRes, labsRes, dealsRes, investigationsRes] =
        await Promise.all([
          supabase.from("gangs").select("*").returns<Gang[]>(),
          supabase.from("sensitive_zones").select("*").returns<SensitiveZone[]>(),
          supabase.from("lab_markers").select("*").returns<LabMarker[]>(),
          supabase.from("deal_points").select("*").returns<DealPoint[]>(),
          supabase
            .from("investigations")
            .select("id, titre")
            .order("titre", { ascending: true })
            .returns<InvestigationOption[]>(),
        ]);

      // Gangs / zones / labos sont indispensables : sans eux on garde les
      // données précédentes plutôt que d'afficher une carte vide.
      if (gangsRes.error || zonesRes.error || labsRes.error) {
        reportPollFailure();
        return;
      }

      setGangs(keepIfUnchanged(gangsRes.data ?? []));
      setZones(keepIfUnchanged(zonesRes.data ?? []));
      setLabMarkers(keepIfUnchanged(labsRes.data ?? []));
      // Points de deal : en cas d'échec, on garde les derniers affichés
      // plutôt que de bloquer toute la carte.
      if (!dealsRes.error) setDealPoints(keepIfUnchanged(dealsRes.data ?? []));
      setInvestigations(keepIfUnchanged(investigationsRes.data ?? []));
      setDataLoaded(true);
      reportPollSuccess();
    } catch {
      reportPollFailure();
    }
  }

  async function fetchLocks() {
    try {
      const [zoneLocks, markerLocks, pointLocks] = await Promise.all([
        getLocksWithPseudos(),
        getLabLocksWithPseudos(),
        getDealLocksWithPseudos(),
      ]);
      // Les verrous expirés (>3 min) sont écartés ici (dans un callback, pas
      // le rendu) : les Map ne contiennent ensuite que des verrous actifs.
      const now = Date.now();

      const zn = new Map<string, LockInfo>();
      for (const l of zoneLocks) {
        if (now - new Date(l.locked_at).getTime() < LOCK_DURATION_MS) {
          zn.set(l.zone_id, {
            locked_by: l.locked_by,
            locked_at: l.locked_at,
            pseudo: l.pseudo,
          });
        }
      }
      setLocks(keepIfUnchanged(zn));

      const lb = new Map<string, LockInfo>();
      for (const l of markerLocks) {
        if (now - new Date(l.locked_at).getTime() < LOCK_DURATION_MS) {
          lb.set(l.marker_id, {
            locked_by: l.locked_by,
            locked_at: l.locked_at,
            pseudo: l.pseudo,
          });
        }
      }
      setLabLocks(keepIfUnchanged(lb));

      const dl = new Map<string, LockInfo>();
      for (const l of pointLocks) {
        if (now - new Date(l.locked_at).getTime() < LOCK_DURATION_MS) {
          dl.set(l.point_id, {
            locked_by: l.locked_by,
            locked_at: l.locked_at,
            pseudo: l.pseudo,
          });
        }
      }
      setDealLocks(keepIfUnchanged(dl));
    } catch {
      reportPollFailure();
    }
  }

  useEffect(() => {
    // Synchronisation avec le serveur (chargement initial + sondage
    // périodique) : cas d'usage explicitement prévu pour un effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMapData();
    fetchLocks();
    // Pas de sondage quand l'onglet est en arrière-plan ; rattrapage
    // immédiat au retour sur l'onglet.
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchMapData();
      fetchLocks();
    }, POLL_INTERVAL_MS);
    function onVisibilityChange() {
      if (document.hidden) return;
      fetchMapData();
      fetchLocks();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // Exécuté une seule fois : `toast` (utilisé par les fonctions de
    // sondage) est stable, inutile de relancer le sondage à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Initialisation de la carte Leaflet ---------------------------------

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    const img = new Image();
    img.onerror = () => {
      if (!cancelled) setMapImageError(true);
    };
    img.onload = () => {
      if (cancelled) return;

      // On attend un cycle de rendu complet (rAF) avant de mesurer le
      // conteneur : mesuré trop tôt (ex: image servie depuis le cache,
      // onload quasi instantané), sa taille peut encore être 0 ou
      // incorrecte, ce qui fausse gravement le calcul du zoom d'ajustement.
      requestAnimationFrame(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const bounds: L.LatLngBoundsExpression = [
          [0, 0],
          [img.naturalHeight, img.naturalWidth],
        ];

        const fitZoom = Math.floor(
          Math.log2(
            Math.min(
              rect.width / img.naturalWidth,
              rect.height / img.naturalHeight,
            ),
          ),
        );

        const map = L.map(containerRef.current, {
          crs: L.CRS.Simple,
          attributionControl: false,
          // Contrôle +/- géré manuellement ci-dessous (positionné en bas à
          // gauche) : par défaut en haut à gauche, il chevauchait le
          // panneau d'action principal (zones/labos, aussi en haut à
          // gauche sur desktop).
          zoomControl: false,
          center: [img.naturalHeight / 2, img.naturalWidth / 2],
          zoom: fitZoom,
          minZoom: fitZoom,
          maxZoom: fitZoom + 4,
          maxBounds: bounds,
        });
        L.control.zoom({ position: "bottomleft" }).addTo(map);

        const overlay = L.imageOverlay(MAP_LAYERS[0].url, bounds).addTo(map);
        imageOverlayRef.current = overlay;
        overlay.on("load", () => setLayerLoading(false));
        overlay.on("error", () => {
          setLayerLoading(false);
          toast.error("Impossible de charger ce fond de carte. Réessayez.");
        });

        zonesLayerRef.current = L.layerGroup().addTo(map);
        drawLayerRef.current = L.layerGroup().addTo(map);
        labsLayerRef.current = L.layerGroup().addTo(map);
        labDraftLayerRef.current = L.layerGroup().addTo(map);
        dealsLayerRef.current = L.layerGroup().addTo(map);
        dealDraftLayerRef.current = L.layerGroup().addTo(map);

        map.on("click", (e: L.LeafletMouseEvent) => {
          if (modeRef.current === "drawing") {
            setDrawingPoints((prev) => [...prev, latLngToPoint(e.latlng)]);
          } else if (modeRef.current === "lab-placing") {
            setLabPlacePos(latLngToPoint(e.latlng));
          } else if (modeRef.current === "deal-placing") {
            setDealPlacePos(latLngToPoint(e.latlng));
          }
        });

        // Icônes labo : taille pleine au zoom max, /1.5 à chaque dézoom.
        const syncLabScale = () => setLabIconScale(labScaleForZoom(map));
        syncLabScale();
        map.on("zoomend", syncLabScale);

        mapRef.current = map;
        setMapReady(true);
      });
    };
    img.src = MAP_LAYERS[0].url;

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Initialisation unique de Leaflet ; `toast` est stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Changement de version de carte (conserve zoom/position) -----------

  useEffect(() => {
    const selected = MAP_LAYERS.find((m) => m.value === layer);
    if (selected && imageOverlayRef.current) {
      imageOverlayRef.current.setUrl(selected.url);
    }
  }, [layer]);

  // --- Rendu des zones ---------------------------------------------------

  useEffect(() => {
    const group = zonesLayerRef.current;
    if (!group) return;
    group.clearLayers();

    const gangsById = new Map(gangs.map((g) => [g.id, g]));

    // Zone QG à surligner (« Voir le QG sur la carte » depuis la fiche
    // B.D.D.) : une organisation ne devrait en avoir qu'une seule ; si
    // plusieurs existent par erreur, on retient la plus récente sans
    // bloquer l'affichage (même choix que la fiche B.D.D., voir
    // app/(app)/gangs/[id]/page.tsx).
    const highlightedQgZoneId = highlightedGangId
      ? zones
          .filter(
            (z) => z.gang_id === highlightedGangId && z.type_zone === "qg",
          )
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          )[0]?.id ?? null
      : null;

    for (const zone of zones) {
      const isBeingEdited = mode === "editing" && zone.id === editingZoneId;
      if (isBeingEdited) continue;

      if (zone.type_zone === "vente" && !filters.zoneVente) continue;
      if (zone.type_zone === "qg" && !filters.zoneQg) continue;
      if (!zone.gang_id && !filters.zoneSansGang) continue;

      // Zone de vente sans gang : gris neutre fixe (même gris qu'une zone
      // dont l'organisation est en corbeille).
      const gang = zone.gang_id ? gangsById.get(zone.gang_id) : undefined;
      const color = gang?.couleur ?? NO_ORGANISATION_COLOR;
      const lock = locks.get(zone.id);
      const isLockedByOther = !!lock && lock.locked_by !== currentUserId;
      const isHighlighted = zone.id === highlightedQgZoneId;

      const polygon = L.polygon(pointsToLatLngs(zone.points), {
        color: isLockedByOther ? "#8B94A0" : color,
        weight: isHighlighted ? 5 : 2,
        fillColor: color,
        fillOpacity: isLockedByOther ? 0.15 : isHighlighted ? 0.5 : 0.35,
        dashArray: zone.type_zone === "qg" ? "6,6" : undefined,
        className: isHighlighted ? "gtf-map-highlight" : "",
      });

      if (isLockedByOther) {
        polygon.bindTooltip(`En cours de modification par ${lock.pseudo}`, {
          sticky: true,
        });
      }

      polygon.on("click", () => {
        if (modeRef.current !== "view") return;
        setSelectedZoneId(zone.id);
        setModalError(null);
      });

      polygon.addTo(group);
    }
  }, [
    zones,
    gangs,
    locks,
    mode,
    editingZoneId,
    currentUserId,
    filters.zoneVente,
    filters.zoneQg,
    filters.zoneSansGang,
    highlightedGangId,
  ]);

  // --- Rendu des marqueurs laboratoire ---------------------------------

  useEffect(() => {
    const group = labsLayerRef.current;
    if (!group) return;
    group.clearLayers();

    const catShown: Record<LabCategorie, boolean> = {
      arme: filters.labArme,
      cocaine: filters.labCocaine,
      meth: filters.labMeth,
    };

    for (const marker of labMarkers) {
      if (mode === "lab-editing" && marker.id === editingLabId) continue;

      // Catégorie inconnue (labo "potentiel" sans catégorie renseignée) :
      // pas concernée par les filtres Arme/Cocaïne/Meth, toujours montrée.
      if (marker.categorie && !catShown[marker.categorie]) continue;
      if (marker.statut === "actif" && !filters.labActif) continue;
      if (marker.statut === "raided" && !filters.labRaided) continue;
      if (marker.statut === "potentiel" && !filters.labPotentiel) continue;

      const lock = labLocks.get(marker.id);
      const isLockedByOther = !!lock && lock.locked_by !== currentUserId;

      const isHighlighted = marker.organisation_id === highlightedGangId;

      const m = L.marker([marker.position.y, marker.position.x], {
        icon: makeLabIcon(
          marker.categorie,
          marker.statut,
          labIconScale,
          isHighlighted,
        ),
      });

      if (isLockedByOther) {
        m.bindTooltip(`En cours de modification par ${lock.pseudo}`, {
          sticky: true,
        });
      }

      m.on("click", () => {
        if (modeRef.current !== "view") return;
        setSelectedLabId(marker.id);
        setLabModalError(null);
      });

      m.addTo(group);
    }
  }, [
    labMarkers,
    labLocks,
    mode,
    editingLabId,
    currentUserId,
    labIconScale,
    filters.labArme,
    filters.labCocaine,
    filters.labMeth,
    filters.labActif,
    filters.labRaided,
    filters.labPotentiel,
    highlightedGangId,
  ]);

  // --- Rendu des points de deal ---------------------------------------

  useEffect(() => {
    const group = dealsLayerRef.current;
    if (!group) return;
    group.clearLayers();

    const gangsById = new Map(gangs.map((g) => [g.id, g]));
    const produitShown: Record<DealProduit, boolean> = {
      cocaine: filters.dealCocaine,
      meth: filters.dealMeth,
      weed: filters.dealWeed,
    };

    for (const point of dealPoints) {
      if (mode === "deal-editing" && point.id === editingDealId) continue;
      if (!produitShown[point.produit]) continue;
      if (point.statut === "actif" && !filters.dealActif) continue;
      if (point.statut === "inactif" && !filters.dealInactif) continue;

      const lock = dealLocks.get(point.id);
      const isLockedByOther = !!lock && lock.locked_by !== currentUserId;
      const color = point.organisation_id
        ? gangsById.get(point.organisation_id)?.couleur
        : null;

      const m = L.marker([point.position.y, point.position.x], {
        icon: makeDealPointIcon(
          color,
          point.statut,
          labIconScale,
          !!point.organisation_id && point.organisation_id === highlightedGangId,
        ),
      });

      if (isLockedByOther) {
        m.bindTooltip(`En cours de modification par ${lock.pseudo}`, {
          sticky: true,
        });
      }

      m.on("click", () => {
        if (modeRef.current !== "view") return;
        setSelectedDealId(point.id);
        setDealModalError(null);
      });

      m.addTo(group);
    }
  }, [
    dealPoints,
    dealLocks,
    gangs,
    mode,
    editingDealId,
    currentUserId,
    labIconScale,
    filters.dealCocaine,
    filters.dealMeth,
    filters.dealWeed,
    filters.dealActif,
    filters.dealInactif,
    highlightedGangId,
  ]);

  // --- Aperçu du placement / point déplaçable en édition ---------------

  useEffect(() => {
    const group = dealDraftLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (mode !== "deal-placing" || !dealPlacePos) return;

    const color = gangs.find((g) => g.id === dealPlaceDraft.organisationId)?.couleur;
    L.marker([dealPlacePos.y, dealPlacePos.x], {
      icon: makeDealPointIcon(color, dealPlaceDraft.statut, labIconScale),
      interactive: false,
      opacity: 0.85,
    }).addTo(group);
  }, [mode, dealPlacePos, dealPlaceDraft, gangs, labIconScale]);

  // Redessiné quand le statut / l'organisation / le zoom changent ; la
  // position en cours est conservée via dealEditPosRef.
  useEffect(() => {
    const group = dealDraftLayerRef.current;
    if (!group || mode !== "deal-editing" || !editingDealId) return;

    group.clearLayers();
    const start = dealEditPosRef.current;
    if (!start) return;

    const color = gangs.find((g) => g.id === dealEditDraft.organisationId)?.couleur;
    const marker = L.marker([start.y, start.x], {
      icon: makeDealPointIcon(color, dealEditDraft.statut, labIconScale),
      draggable: true,
    }).addTo(group);

    marker.on("dragend", () => {
      setDealEditPos(latLngToPoint(marker.getLatLng()));
    });

    return () => {
      group.clearLayers();
    };
  }, [
    mode,
    editingDealId,
    dealEditDraft.organisationId,
    dealEditDraft.statut,
    gangs,
    labIconScale,
  ]);

  // --- Aperçu du dessin d'une nouvelle zone -----------------------------

  useEffect(() => {
    const group = drawLayerRef.current;
    if (!group) return;
    group.clearLayers();

    if (mode === "drawing" && drawingPoints.length > 0) {
      const latlngs = pointsToLatLngs(drawingPoints);
      L.polyline(latlngs, {
        color: "#5B94D6",
        weight: 2,
        dashArray: "4,4",
      }).addTo(group);
      drawingPoints.forEach((p) => {
        L.marker([p.y, p.x], {
          icon: makeHandleIcon(),
          interactive: false,
        }).addTo(group);
      });
    }
  }, [mode, drawingPoints]);

  // --- Édition d'une zone : points déplaçables -------------------------

  useEffect(() => {
    const group = drawLayerRef.current;
    if (!group || mode !== "editing" || !editingZoneId) return;

    group.clearLayers();

    L.polygon(pointsToLatLngs(editingPoints), {
      color: "#5B94D6",
      weight: 2,
      fillColor: "#5B94D6",
      fillOpacity: 0.25,
    }).addTo(group);

    editingPoints.forEach((_, index) => {
      const marker = L.marker(pointsToLatLngs(editingPoints)[index], {
        icon: makeHandleIcon(),
        draggable: true,
      }).addTo(group);

      marker.on("drag", () => {
        const latlng = marker.getLatLng();
        setEditingPoints((prev) => {
          const next = [...prev];
          next[index] = latLngToPoint(latlng);
          return next;
        });
      });
    });

    return () => {
      group.clearLayers();
    };
  }, [mode, editingZoneId, editingPoints]);

  // --- Aperçu du placement d'un nouveau labo --------------------------

  useEffect(() => {
    const group = labDraftLayerRef.current;
    if (!group) return;
    group.clearLayers();

    if (mode === "lab-placing" && labPlacePos) {
      L.marker([labPlacePos.y, labPlacePos.x], {
        icon: makeLabIcon(labPlaceCat || null, labPlaceStatut, labIconScale),
        interactive: false,
        opacity: 0.85,
      }).addTo(group);
    }
  }, [mode, labPlacePos, labPlaceCat, labPlaceStatut, labIconScale]);

  // --- Édition d'un labo : marqueur déplaçable (créé une seule fois) ----

  // Marqueur déplaçable pendant l'édition. Redessiné à chaque changement
  // de catégorie / statut / zoom (griser immédiatement si passage en
  // "raided") — la position en cours est conservée via labEditPosRef, et
  // ces changements n'arrivent jamais pendant un glissement actif.
  useEffect(() => {
    const group = labDraftLayerRef.current;
    if (!group || mode !== "lab-editing" || !editingLabId) return;

    group.clearLayers();
    const start = labEditPosRef.current;
    if (!start) return;

    const marker = L.marker([start.y, start.x], {
      icon: makeLabIcon(labEditCat || null, labEditStatut, labIconScale),
      draggable: true,
    }).addTo(group);

    marker.on("dragend", () => {
      setLabEditPos(latLngToPoint(marker.getLatLng()));
    });

    return () => {
      group.clearLayers();
    };
  }, [mode, editingLabId, labEditCat, labEditStatut, labIconScale]);

  // --- Actions : dessin d'une nouvelle zone ---------------------------

  function startDrawing() {
    setDrawError(null);
    setDrawingPoints([]);
    setMode("drawing");
  }

  function cancelDrawing() {
    setDrawingPoints([]);
    setDrawError(null);
    setMode("view");
  }

  function undoLastPoint() {
    setDrawingPoints((prev) => prev.slice(0, -1));
  }

  async function validateDrawing() {
    // Gang facultatif pour une zone de vente, obligatoire pour un QG.
    if (!drawGangId && drawType === "qg") {
      setDrawError("Un QG doit être rattaché à un gang.");
      return;
    }
    if (drawingPoints.length < 3) {
      setDrawError("Placez au moins 3 points sur la carte.");
      return;
    }
    setDrawPending(true);
    setDrawError(null);

    const formData = new FormData();
    formData.set("gang_id", drawGangId);
    formData.set("type_zone", drawType);
    formData.set("points", JSON.stringify(drawingPoints));

    const result = await run(() => createZone(formData), {
      success: "Zone créée",
      inline: true,
    });
    setDrawPending(false);

    if (result.error) {
      setDrawError(result.error);
      return;
    }

    setDrawingPoints([]);
    setMode("view");
    fetchMapData();
  }

  // --- Actions : édition d'une zone existante ------------------------

  async function startEditing(zone: SensitiveZone) {
    setModalError(null);
    const formData = new FormData();
    formData.set("zone_id", zone.id);
    const result = await run(() => acquireLock(formData), {
      inline: true,
    });

    if (result.error) {
      setModalError(result.error);
      await fetchLocks();
      return;
    }

    setSelectedZoneId(null);
    setEditingZoneId(zone.id);
    setEditingPoints(zone.points);
    setEditGangId(zone.gang_id ?? "");
    setEditType(zone.type_zone);
    setEditError(null);
    setMode("editing");
  }

  async function cancelEditing() {
    if (editingZoneId) {
      const formData = new FormData();
      formData.set("zone_id", editingZoneId);
      await run(() => releaseLock(formData), { inline: true });
    }
    setEditingZoneId(null);
    setEditingPoints([]);
    setEditError(null);
    setMode("view");
    fetchLocks();
  }

  async function saveEditing() {
    if (!editingZoneId) return;
    if (!editGangId && editType === "qg") {
      setEditError("Un QG doit être rattaché à un gang.");
      return;
    }
    if (editingPoints.length < 3) {
      setEditError("La zone doit avoir au moins 3 points.");
      return;
    }
    setEditPending(true);
    setEditError(null);

    const formData = new FormData();
    formData.set("id", editingZoneId);
    formData.set("gang_id", editGangId);
    formData.set("type_zone", editType);
    formData.set("points", JSON.stringify(editingPoints));

    const result = await run(() => updateZone(formData), {
      success: "Zone mise à jour",
      inline: true,
    });
    setEditPending(false);

    if (result.error) {
      setEditError(result.error);
      return;
    }

    setEditingZoneId(null);
    setEditingPoints([]);
    setMode("view");
    fetchMapData();
    fetchLocks();
  }

  async function handleDelete(zoneId: string) {
    if (
      !window.confirm(
        "Déplacer cette zone vers la corbeille ? Cette action peut être annulée par un administrateur.",
      )
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("id", zoneId);
    const result = await run(() => deleteZone(formData), {
      success: "Zone déplacée vers la corbeille",
      inline: true,
    });

    if (result.error) {
      setModalError(result.error);
      return;
    }

    setSelectedZoneId(null);
    fetchMapData();
  }

  // --- Actions : placement d'un nouveau labo ------------------------

  function startPlacingLab() {
    setLabPlaceError(null);
    setLabPlacePos(null);
    setLabPlaceOrg("");
    setLabPlaceCat("arme");
    setLabPlaceStatut("actif");
    setLabPlaceLinkInvestigation(false);
    setLabPlaceInvestigationId("");
    setMode("lab-placing");
  }

  function cancelPlacingLab() {
    setLabPlacePos(null);
    setLabPlaceError(null);
    setMode("view");
  }

  async function validatePlacingLab() {
    if (!labPlaceOrg) {
      setLabPlaceError("Sélectionnez une organisation.");
      return;
    }
    if (!labPlaceCat && labPlaceStatut !== "potentiel") {
      setLabPlaceError("Sélectionnez une catégorie (sauf statut Potentiel).");
      return;
    }
    if (labPlaceLinkInvestigation && !labPlaceInvestigationId) {
      setLabPlaceError(
        "Sélectionnez une enquête dans la liste (ou répondez Non).",
      );
      return;
    }
    if (!labPlacePos) {
      setLabPlaceError("Cliquez sur la carte pour positionner le labo.");
      return;
    }
    setLabPlacePending(true);
    setLabPlaceError(null);

    const formData = new FormData();
    formData.set("categorie", labPlaceCat);
    formData.set("statut", labPlaceStatut);
    formData.set("organisation_id", labPlaceOrg);
    formData.set(
      "investigation_id",
      labPlaceLinkInvestigation ? labPlaceInvestigationId : "",
    );
    formData.set("position", JSON.stringify(labPlacePos));

    const result = await run(() => createLabMarker(formData), {
      success: "Marqueur laboratoire créé",
      inline: true,
    });
    setLabPlacePending(false);

    if (result.error) {
      setLabPlaceError(result.error);
      return;
    }

    setLabPlacePos(null);
    setMode("view");
    fetchMapData();
  }

  // --- Actions : édition d'un labo existant -------------------------

  async function startEditingLab(marker: LabMarker) {
    setLabModalError(null);
    const formData = new FormData();
    formData.set("marker_id", marker.id);
    const result = await run(() => acquireLabLock(formData), {
      inline: true,
    });

    if (result.error) {
      setLabModalError(result.error);
      await fetchLocks();
      return;
    }

    setSelectedLabId(null);
    setEditingLabId(marker.id);
    setLabEditPos(marker.position);
    labEditPosRef.current = marker.position;
    setLabEditCat(marker.categorie ?? "");
    setLabEditStatut(marker.statut);
    setLabEditOrg(marker.organisation_id);
    setLabEditLinkInvestigation(!!marker.investigation_id);
    setLabEditInvestigationId(marker.investigation_id ?? "");
    setLabEditError(null);
    setMode("lab-editing");
  }

  async function cancelEditingLab() {
    if (editingLabId) {
      const formData = new FormData();
      formData.set("marker_id", editingLabId);
      await run(() => releaseLabLock(formData), { inline: true });
    }
    setEditingLabId(null);
    setLabEditPos(null);
    setLabEditError(null);
    setMode("view");
    fetchLocks();
  }

  async function saveEditingLab() {
    if (!editingLabId) return;
    if (!labEditOrg) {
      setLabEditError("Sélectionnez une organisation.");
      return;
    }
    if (!labEditCat && labEditStatut !== "potentiel") {
      setLabEditError("Sélectionnez une catégorie (sauf statut Potentiel).");
      return;
    }
    if (labEditLinkInvestigation && !labEditInvestigationId) {
      setLabEditError(
        "Sélectionnez une enquête dans la liste (ou répondez Non).",
      );
      return;
    }
    if (!labEditPos) {
      setLabEditError("Position invalide.");
      return;
    }
    setLabEditPending(true);
    setLabEditError(null);

    const formData = new FormData();
    formData.set("id", editingLabId);
    formData.set("categorie", labEditCat);
    formData.set("statut", labEditStatut);
    formData.set("organisation_id", labEditOrg);
    formData.set(
      "investigation_id",
      labEditLinkInvestigation ? labEditInvestigationId : "",
    );
    formData.set("position", JSON.stringify(labEditPos));

    const result = await run(() => updateLabMarker(formData), {
      success: "Marqueur laboratoire mis à jour",
      inline: true,
    });
    setLabEditPending(false);

    if (result.error) {
      setLabEditError(result.error);
      return;
    }

    setEditingLabId(null);
    setLabEditPos(null);
    setMode("view");
    fetchMapData();
    fetchLocks();
  }

  async function handleDeleteLab(markerId: string) {
    if (
      !window.confirm(
        "Déplacer ce marqueur laboratoire vers la corbeille ? Cette action peut être annulée par un administrateur.",
      )
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("id", markerId);
    const result = await run(() => deleteLabMarker(formData), {
      success: "Marqueur laboratoire déplacé vers la corbeille",
      inline: true,
    });

    if (result.error) {
      setLabModalError(result.error);
      return;
    }

    setSelectedLabId(null);
    fetchMapData();
  }

  // --- Actions : points de deal -------------------------------------

  function dealFormData(draft: DealPointDraft, position: ZonePoint): FormData {
    const formData = new FormData();
    formData.set("produit", draft.produit);
    formData.set("statut", draft.statut);
    formData.set("organisation_id", draft.organisationId);
    formData.set("note", draft.note);
    formData.set("position", JSON.stringify(position));
    return formData;
  }

  function startPlacingDeal() {
    setDealPlaceError(null);
    setDealPlacePos(null);
    setDealPlaceDraft(EMPTY_DEAL_DRAFT);
    setMode("deal-placing");
  }

  function cancelPlacingDeal() {
    setDealPlacePos(null);
    setDealPlaceError(null);
    setMode("view");
  }

  async function validatePlacingDeal() {
    if (!dealPlacePos) {
      setDealPlaceError("Cliquez sur la carte pour positionner le point.");
      return;
    }
    setDealPlacePending(true);
    setDealPlaceError(null);

    const result = await run(
      () => createDealPoint(dealFormData(dealPlaceDraft, dealPlacePos)),
      { success: "Point de deal créé", inline: true },
    );
    setDealPlacePending(false);

    if (result.error) {
      setDealPlaceError(result.error);
      return;
    }
    setDealPlacePos(null);
    setMode("view");
    fetchMapData();
  }

  async function startEditingDeal(point: DealPoint) {
    setDealModalError(null);
    const formData = new FormData();
    formData.set("point_id", point.id);
    const result = await run(() => acquireDealLock(formData), { inline: true });

    if (result.error) {
      setDealModalError(result.error);
      await fetchLocks();
      return;
    }

    setSelectedDealId(null);
    setEditingDealId(point.id);
    setDealEditPos(point.position);
    dealEditPosRef.current = point.position;
    setDealEditDraft({
      produit: point.produit,
      statut: point.statut,
      organisationId: point.organisation_id ?? "",
      note: point.note ?? "",
    });
    setDealEditError(null);
    setMode("deal-editing");
  }

  async function cancelEditingDeal() {
    if (editingDealId) {
      const formData = new FormData();
      formData.set("point_id", editingDealId);
      await run(() => releaseDealLock(formData), { inline: true });
    }
    setEditingDealId(null);
    setDealEditPos(null);
    setDealEditError(null);
    setMode("view");
    fetchLocks();
  }

  async function saveEditingDeal() {
    if (!editingDealId || !dealEditPos) return;
    setDealEditPending(true);
    setDealEditError(null);

    const formData = dealFormData(dealEditDraft, dealEditPos);
    formData.set("id", editingDealId);
    const result = await run(() => updateDealPoint(formData), {
      success: "Point de deal mis à jour",
      inline: true,
    });
    setDealEditPending(false);

    if (result.error) {
      setDealEditError(result.error);
      return;
    }
    setEditingDealId(null);
    setDealEditPos(null);
    setMode("view");
    fetchMapData();
    fetchLocks();
  }

  async function handleDeleteDeal(pointId: string) {
    if (
      !window.confirm(
        "Déplacer ce point de deal vers la corbeille ? Cette action peut être annulée par un administrateur.",
      )
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("id", pointId);
    const result = await run(() => deleteDealPoint(formData), {
      success: "Point de deal déplacé vers la corbeille",
      inline: true,
    });

    if (result.error) {
      setDealModalError(result.error);
      return;
    }
    setSelectedDealId(null);
    fetchMapData();
  }

  // --- Sélections dérivées -----------------------------------------

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;
  const selectedGang = selectedZone?.gang_id
    ? gangs.find((g) => g.id === selectedZone.gang_id) ?? null
    : null;
  const selectedLock = selectedZone ? locks.get(selectedZone.id) : undefined;
  const selectedLockedByOther =
    selectedLock && selectedLock.locked_by !== currentUserId
      ? { pseudo: selectedLock.pseudo }
      : null;

  const selectedLab = labMarkers.find((m) => m.id === selectedLabId) ?? null;
  const selectedLabGang = selectedLab
    ? gangs.find((g) => g.id === selectedLab.organisation_id) ?? null
    : null;
  const selectedLabInvestigation =
    selectedLab && selectedLab.investigation_id
      ? investigations.find((i) => i.id === selectedLab.investigation_id) ??
        null
      : null;
  const selectedLabLock = selectedLab
    ? labLocks.get(selectedLab.id)
    : undefined;
  const selectedLabLockedByOther =
    selectedLabLock && selectedLabLock.locked_by !== currentUserId
      ? { pseudo: selectedLabLock.pseudo }
      : null;

  const selectedDeal = dealPoints.find((p) => p.id === selectedDealId) ?? null;
  const selectedDealGang = selectedDeal?.organisation_id
    ? gangs.find((g) => g.id === selectedDeal.organisation_id) ?? null
    : null;
  const selectedDealLock = selectedDeal ? dealLocks.get(selectedDeal.id) : undefined;
  const selectedDealLockedByOther =
    selectedDealLock && selectedDealLock.locked_by !== currentUserId
      ? { pseudo: selectedDealLock.pseudo }
      : null;

  const panelSelectClass = `w-full ${fieldCompactClass}`;
  const panelLabelClass =
    "mb-1 block font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted";

  const someFilterHidden = Object.values(filters).some((v) => !v);

  return (
    <div className="relative h-[75dvh] min-h-[28rem] w-full overflow-hidden rounded-md border border-gtf-border">
      <div ref={containerRef} className="h-full w-full bg-[#0A0C0F]" />

      {(!mapReady || !dataLoaded || mapImageError) && (
        <div
          role={mapImageError ? "alert" : "status"}
          className="absolute inset-0 z-[600] flex flex-col items-center justify-center gap-3 bg-gtf-bg/95 p-4 text-center text-sm text-gtf-text-muted"
        >
          {mapImageError ? (
            <>
              <p className="text-gtf-red">
                Impossible de charger le fond de carte.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={btn("primary")}
              >
                Recharger la page
              </button>
            </>
          ) : (
            <>
              <Spinner className="h-6 w-6 text-gtf-blue-hover" />
              <p>
                {dataError
                  ? "Chargement des données impossible pour le moment. Nouvelle tentative automatique…"
                  : "Chargement de la carte…"}
              </p>
            </>
          )}
        </div>
      )}

      {/* Haut à droite : fond de carte + filtres d'affichage */}
      <div className="absolute right-3 top-3 z-[500] flex w-40 flex-col gap-2 sm:w-48">
        <select
          value={layer}
          onChange={(e) => {
            setLayerLoading(true);
            setLayer(e.target.value as MapLayerKey);
          }}
          className={`${fieldCompactClass} bg-gtf-panel/95 px-3 font-mono text-xs uppercase tracking-wider shadow-lg`}
        >
          {MAP_LAYERS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {layerLoading && (
          <p className="flex items-center gap-2 rounded border border-gtf-border bg-gtf-panel/95 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted shadow-lg">
            <Spinner className="h-3 w-3 text-gtf-blue-hover" />
            Chargement du fond…
          </p>
        )}

        <div className="rounded-md border border-gtf-border bg-gtf-panel/95 shadow-lg">
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-gtf-text hover:text-gtf-blue-hover"
          >
            <span>
              Filtres
              {someFilterHidden && (
                <span className="ml-1 text-gtf-blue-hover">•</span>
              )}
            </span>
            <span className="text-gtf-text-muted">
              {filtersOpen ? "▲" : "▼"}
            </span>
          </button>

          {filtersOpen && (
            <div className="max-h-[45dvh] overflow-y-auto border-t border-gtf-border p-3">
              <p className={panelLabelClass}>Zones</p>
              <FilterCheckbox
                label="Vente"
                checked={filters.zoneVente}
                onChange={() => toggleFilter("zoneVente")}
              />
              <FilterCheckbox
                label="QG"
                checked={filters.zoneQg}
                onChange={() => toggleFilter("zoneQg")}
              />
              <FilterCheckbox
                label="Vente sans gang"
                checked={filters.zoneSansGang}
                onChange={() => toggleFilter("zoneSansGang")}
              />

              <p className={`${panelLabelClass} mt-3`}>Laboratoires</p>
              <FilterCheckbox
                label="Arme"
                checked={filters.labArme}
                onChange={() => toggleFilter("labArme")}
              />
              <FilterCheckbox
                label="Cocaïne"
                checked={filters.labCocaine}
                onChange={() => toggleFilter("labCocaine")}
              />
              <FilterCheckbox
                label="Meth"
                checked={filters.labMeth}
                onChange={() => toggleFilter("labMeth")}
              />

              <p className={`${panelLabelClass} mt-3`}>Statut labo</p>
              <FilterCheckbox
                label="Actif"
                checked={filters.labActif}
                onChange={() => toggleFilter("labActif")}
              />
              <FilterCheckbox
                label="Raid effectué"
                checked={filters.labRaided}
                onChange={() => toggleFilter("labRaided")}
              />
              <FilterCheckbox
                label="Potentiel"
                checked={filters.labPotentiel}
                onChange={() => toggleFilter("labPotentiel")}
              />

              <p className={`${panelLabelClass} mt-3`}>Points de deal</p>
              <FilterCheckbox
                label="Cocaïne"
                checked={filters.dealCocaine}
                onChange={() => toggleFilter("dealCocaine")}
              />
              <FilterCheckbox
                label="Meth"
                checked={filters.dealMeth}
                onChange={() => toggleFilter("dealMeth")}
              />
              <FilterCheckbox
                label="Weed"
                checked={filters.dealWeed}
                onChange={() => toggleFilter("dealWeed")}
              />

              <p className={`${panelLabelClass} mt-3`}>Statut point de deal</p>
              <FilterCheckbox
                label="Actif"
                checked={filters.dealActif}
                onChange={() => toggleFilter("dealActif")}
              />
              <FilterCheckbox
                label="Inactif"
                checked={filters.dealInactif}
                onChange={() => toggleFilter("dealInactif")}
              />

              {someFilterHidden && (
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className={btn("secondary", "sm", "mt-3 w-full")}
                >
                  Tout afficher
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Panneau d'action principal */}
      <div className="absolute inset-x-3 bottom-3 z-[500] sm:inset-x-auto sm:bottom-auto sm:left-3 sm:top-3">
        {mode === "view" && canWrite && (
          <div className="flex flex-row gap-2 sm:flex-col">
            <button
              onClick={startDrawing}
              className={btn("primary", "md", "flex-1 font-mono shadow-lg sm:flex-none")}
            >
              Ajouter une zone
            </button>
            <button
              onClick={startPlacingLab}
              className={btn("secondary", "md", "flex-1 bg-gtf-panel/95 font-mono shadow-lg sm:flex-none")}
            >
              Ajouter un labo
            </button>
            <button
              onClick={startPlacingDeal}
              className={btn("secondary", "md", "flex-1 bg-gtf-panel/95 font-mono shadow-lg sm:flex-none")}
            >
              Ajouter un point de deal
            </button>
          </div>
        )}

        {mode === "drawing" && (
          <div className="max-h-[55dvh] w-full overflow-y-auto rounded-md border border-gtf-border bg-gtf-panel/95 p-3 shadow-lg sm:max-h-[calc(75dvh-1.5rem)] sm:w-72">
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-gtf-text">
              Nouvelle zone
            </p>
            <div className="mt-2">
              <label className={panelLabelClass}>
                Gang{drawType === "vente" && " (facultatif)"}
              </label>
              <select
                value={drawGangId}
                onChange={(e) => setDrawGangId(e.target.value)}
                className={panelSelectClass}
              >
                <option value="">
                  {drawType === "vente" ? "Aucun gang" : "— Sélectionner —"}
                </option>
                {gangs.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2">
              <label className={panelLabelClass}>Type</label>
              <select
                value={drawType}
                onChange={(e) => setDrawType(e.target.value as ZoneType)}
                className={panelSelectClass}
              >
                <option value="vente">Vente</option>
                <option value="qg">QG</option>
              </select>
            </div>
            <p className="mt-2 font-mono text-[11px] text-gtf-text-muted">
              Cliquez sur la carte pour placer les points ({drawingPoints.length}{" "}
              placé{drawingPoints.length > 1 ? "s" : ""}).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={validateDrawing}
                disabled={drawPending}
                className={btn("primary", "sm")}
              >
                {drawPending ? "..." : "Valider la zone"}
              </button>
              <button
                onClick={undoLastPoint}
                disabled={drawingPoints.length === 0}
                className={btn("secondary", "sm")}
              >
                Annuler le dernier point
              </button>
              <button
                onClick={cancelDrawing}
                className={btn("danger", "sm")}
              >
                Annuler
              </button>
            </div>
            {drawError && (
              <p role="alert" className="mt-2 text-xs text-gtf-red">
                {drawError}
              </p>
            )}
          </div>
        )}

        {mode === "editing" && (
          <div className="max-h-[55dvh] w-full overflow-y-auto rounded-md border border-gtf-border bg-gtf-panel/95 p-3 shadow-lg sm:max-h-[calc(75dvh-1.5rem)] sm:w-72">
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-gtf-text">
              Modification de la zone
            </p>
            <div className="mt-2">
              <label className={panelLabelClass}>
                Gang{editType === "vente" && " (facultatif)"}
              </label>
              <select
                value={editGangId}
                onChange={(e) => setEditGangId(e.target.value)}
                className={panelSelectClass}
              >
                <option value="">
                  {editType === "vente" ? "Aucun gang" : "— Sélectionner —"}
                </option>
                {gangs.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2">
              <label className={panelLabelClass}>Type</label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as ZoneType)}
                className={panelSelectClass}
              >
                <option value="vente">Vente</option>
                <option value="qg">QG</option>
              </select>
            </div>
            <p className="mt-2 font-mono text-[11px] text-gtf-text-muted">
              Glissez les points pour ajuster le contour.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={saveEditing}
                disabled={editPending}
                className={btn("primary", "sm")}
              >
                {editPending ? "..." : "Enregistrer"}
              </button>
              <button
                onClick={cancelEditing}
                className={btn("secondary", "sm")}
              >
                Annuler
              </button>
            </div>
            {editError && (
              <p role="alert" className="mt-2 text-xs text-gtf-red">
                {editError}
              </p>
            )}
          </div>
        )}

        {mode === "lab-placing" && (
          <div className="max-h-[55dvh] w-full overflow-y-auto rounded-md border border-gtf-border bg-gtf-panel/95 p-3 shadow-lg sm:max-h-[calc(75dvh-1.5rem)] sm:w-72">
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-gtf-text">
              Nouveau laboratoire
            </p>
            <div className="mt-2">
              <label className={panelLabelClass}>Catégorie</label>
              <select
                value={labPlaceCat}
                onChange={(e) =>
                  setLabPlaceCat(e.target.value as LabCategorie | "")
                }
                className={panelSelectClass}
              >
                {labPlaceStatut === "potentiel" && (
                  <option value="">Non déterminée</option>
                )}
                {LAB_CATEGORIE_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2">
              <label className={panelLabelClass}>Statut</label>
              <select
                value={labPlaceStatut}
                onChange={(e) => {
                  const nextStatut = e.target.value as LabStatut;
                  setLabPlaceStatut(nextStatut);
                  // Catégorie laissée vide en quittant "Potentiel" :
                  // revient sur une valeur valide plutôt qu'un select
                  // vidé de son option "Non déterminée".
                  if (nextStatut !== "potentiel" && !labPlaceCat) {
                    setLabPlaceCat("arme");
                  }
                }}
                className={panelSelectClass}
              >
                {LAB_STATUT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2">
              <label className={panelLabelClass}>Organisation</label>
              <select
                value={labPlaceOrg}
                onChange={(e) => setLabPlaceOrg(e.target.value)}
                className={panelSelectClass}
              >
                <option value="">— Sélectionner —</option>
                {gangs.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nom}
                  </option>
                ))}
              </select>
            </div>
            <LinkInvestigationField
              linked={labPlaceLinkInvestigation}
              onLinkedChange={setLabPlaceLinkInvestigation}
              investigationId={labPlaceInvestigationId}
              onInvestigationIdChange={setLabPlaceInvestigationId}
              investigations={investigations}
              panelLabelClass={panelLabelClass}
              panelSelectClass={panelSelectClass}
            />
            <p className="mt-2 font-mono text-[11px] text-gtf-text-muted">
              {labPlacePos
                ? "Position enregistrée — cliquez ailleurs pour la corriger."
                : "Cliquez sur la carte pour positionner le labo."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={validatePlacingLab}
                disabled={labPlacePending}
                className={btn("primary", "sm")}
              >
                {labPlacePending ? "..." : "Valider le labo"}
              </button>
              <button
                onClick={cancelPlacingLab}
                className={btn("danger", "sm")}
              >
                Annuler
              </button>
            </div>
            {labPlaceError && (
              <p role="alert" className="mt-2 text-xs text-gtf-red">
                {labPlaceError}
              </p>
            )}
          </div>
        )}

        {mode === "lab-editing" && (
          <div className="max-h-[55dvh] w-full overflow-y-auto rounded-md border border-gtf-border bg-gtf-panel/95 p-3 shadow-lg sm:max-h-[calc(75dvh-1.5rem)] sm:w-72">
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-gtf-text">
              Modification du laboratoire
            </p>
            <div className="mt-2">
              <label className={panelLabelClass}>Catégorie</label>
              <select
                value={labEditCat}
                onChange={(e) =>
                  setLabEditCat(e.target.value as LabCategorie | "")
                }
                className={panelSelectClass}
              >
                {labEditStatut === "potentiel" && (
                  <option value="">Non déterminée</option>
                )}
                {LAB_CATEGORIE_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2">
              <label className={panelLabelClass}>Statut</label>
              <select
                value={labEditStatut}
                onChange={(e) => {
                  const nextStatut = e.target.value as LabStatut;
                  setLabEditStatut(nextStatut);
                  if (nextStatut !== "potentiel" && !labEditCat) {
                    setLabEditCat("arme");
                  }
                }}
                className={panelSelectClass}
              >
                {LAB_STATUT_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2">
              <label className={panelLabelClass}>Organisation</label>
              <select
                value={labEditOrg}
                onChange={(e) => setLabEditOrg(e.target.value)}
                className={panelSelectClass}
              >
                {gangs.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nom}
                  </option>
                ))}
              </select>
            </div>
            <LinkInvestigationField
              linked={labEditLinkInvestigation}
              onLinkedChange={setLabEditLinkInvestigation}
              investigationId={labEditInvestigationId}
              onInvestigationIdChange={setLabEditInvestigationId}
              investigations={investigations}
              panelLabelClass={panelLabelClass}
              panelSelectClass={panelSelectClass}
            />
            <p className="mt-2 font-mono text-[11px] text-gtf-text-muted">
              Glissez le marqueur pour le repositionner.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={saveEditingLab}
                disabled={labEditPending}
                className={btn("primary", "sm")}
              >
                {labEditPending ? "..." : "Enregistrer"}
              </button>
              <button
                onClick={cancelEditingLab}
                className={btn("secondary", "sm")}
              >
                Annuler
              </button>
            </div>
            {labEditError && (
              <p role="alert" className="mt-2 text-xs text-gtf-red">
                {labEditError}
              </p>
            )}
          </div>
        )}

        {mode === "deal-placing" && (
          <DealPointFormPanel
            title="Nouveau point de deal"
            draft={dealPlaceDraft}
            onChange={setDealPlaceDraft}
            gangs={gangs}
            hint={
              dealPlacePos
                ? "Position enregistrée — cliquez ailleurs pour la corriger."
                : "Cliquez sur la carte pour positionner le point."
            }
            submitLabel="Valider le point"
            onSubmit={validatePlacingDeal}
            onCancel={cancelPlacingDeal}
            pending={dealPlacePending}
            error={dealPlaceError}
          />
        )}

        {mode === "deal-editing" && (
          <DealPointFormPanel
            title="Modification du point de deal"
            draft={dealEditDraft}
            onChange={setDealEditDraft}
            gangs={gangs}
            hint="Glissez le point pour le repositionner."
            submitLabel="Enregistrer"
            onSubmit={saveEditingDeal}
            onCancel={cancelEditingDeal}
            pending={dealEditPending}
            error={dealEditError}
          />
        )}
      </div>

      {selectedZone && !editingZoneId && (
        <ZoneDetailModal
          zone={selectedZone}
          gang={selectedGang}
          lockedByOther={selectedLockedByOther}
          onClose={() => setSelectedZoneId(null)}
          onEdit={() => startEditing(selectedZone)}
          onDelete={() => handleDelete(selectedZone.id)}
          editError={modalError}
          canWrite={canWrite}
        />
      )}

      {selectedLab && !editingLabId && (
        <LabMarkerDetailModal
          marker={selectedLab}
          gang={selectedLabGang}
          investigation={selectedLabInvestigation}
          lockedByOther={selectedLabLockedByOther}
          onClose={() => setSelectedLabId(null)}
          onEdit={() => startEditingLab(selectedLab)}
          onDelete={() => handleDeleteLab(selectedLab.id)}
          editError={labModalError}
          canWrite={canWrite}
        />
      )}

      {selectedDeal && !editingDealId && (
        <DealPointDetailModal
          point={selectedDeal}
          gang={selectedDealGang}
          lockedByOther={selectedDealLockedByOther}
          onClose={() => setSelectedDealId(null)}
          onEdit={() => startEditingDeal(selectedDeal)}
          onDelete={() => handleDeleteDeal(selectedDeal.id)}
          editError={dealModalError}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}
