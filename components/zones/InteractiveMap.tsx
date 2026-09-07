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
import { ZoneDetailModal } from "./ZoneDetailModal";
import { LabMarkerDetailModal } from "./LabMarkerDetailModal";
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

const MAP_LAYERS = [
  { value: "atlas", label: "Atlas", url: "/map/atlas.png" },
  { value: "satellite", label: "Satellite", url: "/map/satellite.jpg" },
  { value: "road", label: "Routière", url: "/map/road.jpg" },
] as const;

type MapLayerKey = (typeof MAP_LAYERS)[number]["value"];

type LockInfo = { locked_by: string; locked_at: string; pseudo: string };

type Mode = "view" | "drawing" | "editing" | "lab-placing" | "lab-editing";

const POLL_INTERVAL_MS = 20_000;

function pointsToLatLngs(points: ZonePoint[]): L.LatLngExpression[] {
  return points.map((p) => [p.y, p.x]);
}

function latLngToPoint(latlng: L.LatLng): ZonePoint {
  return { x: latlng.lng, y: latlng.lat };
}

function makeHandleIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: '<div style="width:12px;height:12px;border-radius:9999px;background:#5B94D6;border:2px solid #0A0C0F;box-shadow:0 0 0 1px #5B94D6;"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
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
  categorie: LabCategorie,
  statut: LabStatut,
  scale = 1,
): L.Icon {
  const w = Math.max(6, Math.round(LAB_ICON_W * scale));
  const h = Math.max(8, Math.round(LAB_ICON_H * scale));
  const tip = Math.round(2 * scale);
  return L.icon({
    iconUrl: labMarkerIconUrl(categorie),
    iconSize: [w, h],
    iconAnchor: [w / 2, h - tip],
    tooltipAnchor: [0, -(h - tip)],
    // Statut "raided" : marqueur grisé/désaturé (voir .gtf-lab-raided
    // dans app/globals.css), tout en restant cliquable.
    className: statut === "raided" ? "gtf-lab-raided" : "",
  });
}

// --- Filtres d'affichage de la carte ---------------------------------

const DEFAULT_FILTERS = {
  zoneVente: true,
  zoneInfluence: true,
  labArme: true,
  labCocaine: true,
  labMeth: true,
  labActif: true,
  labRaided: true,
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

export function InteractiveMap({
  currentUserId,
  canWrite,
}: {
  currentUserId: string;
  canWrite: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const imageOverlayRef = useRef<L.ImageOverlay | null>(null);
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);
  const drawLayerRef = useRef<L.LayerGroup | null>(null);
  const labsLayerRef = useRef<L.LayerGroup | null>(null);
  const labDraftLayerRef = useRef<L.LayerGroup | null>(null);
  const modeRef = useRef<Mode>("view");
  const drawingPointsRef = useRef<ZonePoint[]>([]);
  const labEditPosRef = useRef<ZonePoint | null>(null);

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
  const [locks, setLocks] = useState<Map<string, LockInfo>>(new Map());
  const [labLocks, setLabLocks] = useState<Map<string, LockInfo>>(new Map());

  const [mode, setMode] = useState<Mode>("view");

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
  const [labPlaceCat, setLabPlaceCat] = useState<LabCategorie>("arme");
  const [labPlaceStatut, setLabPlaceStatut] = useState<LabStatut>("actif");
  const [labPlaceOrg, setLabPlaceOrg] = useState("");
  const [labPlaceError, setLabPlaceError] = useState<string | null>(null);
  const [labPlacePending, setLabPlacePending] = useState(false);

  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const [labEditPos, setLabEditPos] = useState<ZonePoint | null>(null);
  const [labEditCat, setLabEditCat] = useState<LabCategorie>("arme");
  const [labEditStatut, setLabEditStatut] = useState<LabStatut>("actif");
  const [labEditOrg, setLabEditOrg] = useState("");
  const [labEditError, setLabEditError] = useState<string | null>(null);
  const [labEditPending, setLabEditPending] = useState(false);

  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [labModalError, setLabModalError] = useState<string | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    drawingPointsRef.current = drawingPoints;
  }, [drawingPoints]);
  useEffect(() => {
    labEditPosRef.current = labEditPos;
  }, [labEditPos]);

  // --- Chargement initial + rafraîchissement périodique ------------------

  async function fetchMapData() {
    const supabase = createClient();
    const [{ data: gangsData }, { data: zonesData }, { data: labsData }] =
      await Promise.all([
        supabase.from("gangs").select("*").returns<Gang[]>(),
        supabase.from("sensitive_zones").select("*").returns<SensitiveZone[]>(),
        supabase.from("lab_markers").select("*").returns<LabMarker[]>(),
      ]);
    setGangs(gangsData ?? []);
    setZones(zonesData ?? []);
    setLabMarkers(labsData ?? []);
  }

  async function fetchLocks() {
    const [zoneLocks, markerLocks] = await Promise.all([
      getLocksWithPseudos(),
      getLabLocksWithPseudos(),
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
    setLocks(zn);

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
    setLabLocks(lb);
  }

  useEffect(() => {
    // Synchronisation avec le serveur (chargement initial + sondage
    // périodique) : cas d'usage explicitement prévu pour un effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMapData();
    fetchLocks();
    const interval = setInterval(() => {
      fetchMapData();
      fetchLocks();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // --- Initialisation de la carte Leaflet ---------------------------------

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    const img = new Image();
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
          zoomControl: true,
          center: [img.naturalHeight / 2, img.naturalWidth / 2],
          zoom: fitZoom,
          minZoom: fitZoom,
          maxZoom: fitZoom + 4,
          maxBounds: bounds,
        });

        const overlay = L.imageOverlay(MAP_LAYERS[0].url, bounds).addTo(map);
        imageOverlayRef.current = overlay;

        zonesLayerRef.current = L.layerGroup().addTo(map);
        drawLayerRef.current = L.layerGroup().addTo(map);
        labsLayerRef.current = L.layerGroup().addTo(map);
        labDraftLayerRef.current = L.layerGroup().addTo(map);

        map.on("click", (e: L.LeafletMouseEvent) => {
          if (modeRef.current === "drawing") {
            setDrawingPoints((prev) => [...prev, latLngToPoint(e.latlng)]);
          } else if (modeRef.current === "lab-placing") {
            setLabPlacePos(latLngToPoint(e.latlng));
          }
        });

        // Icônes labo : taille pleine au zoom max, /1.5 à chaque dézoom.
        const syncLabScale = () => setLabIconScale(labScaleForZoom(map));
        syncLabScale();
        map.on("zoomend", syncLabScale);

        mapRef.current = map;
      });
    };
    img.src = MAP_LAYERS[0].url;

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
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

    for (const zone of zones) {
      const isBeingEdited = mode === "editing" && zone.id === editingZoneId;
      if (isBeingEdited) continue;

      if (zone.type_zone === "vente" && !filters.zoneVente) continue;
      if (zone.type_zone === "influence" && !filters.zoneInfluence) continue;

      const gang = gangsById.get(zone.gang_id);
      const color = gang?.couleur ?? "#8B94A0";
      const lock = locks.get(zone.id);
      const isLockedByOther = !!lock && lock.locked_by !== currentUserId;

      const polygon = L.polygon(pointsToLatLngs(zone.points), {
        color: isLockedByOther ? "#8B94A0" : color,
        weight: 2,
        fillColor: color,
        fillOpacity: isLockedByOther ? 0.15 : 0.35,
        dashArray: zone.type_zone === "influence" ? "6,6" : undefined,
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
    filters.zoneInfluence,
  ]);

  // --- Rendu des marqueurs laboratoire ---------------------------------

  useEffect(() => {
    const group = labsLayerRef.current;
    if (!group) return;
    group.clearLayers();

    const catShown: Record<LabMarker["categorie"], boolean> = {
      arme: filters.labArme,
      cocaine: filters.labCocaine,
      meth: filters.labMeth,
    };

    for (const marker of labMarkers) {
      if (mode === "lab-editing" && marker.id === editingLabId) continue;

      if (!catShown[marker.categorie]) continue;
      if (marker.statut === "actif" && !filters.labActif) continue;
      if (marker.statut === "raided" && !filters.labRaided) continue;

      const lock = labLocks.get(marker.id);
      const isLockedByOther = !!lock && lock.locked_by !== currentUserId;

      const m = L.marker([marker.position.y, marker.position.x], {
        icon: makeLabIcon(marker.categorie, marker.statut, labIconScale),
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
        icon: makeLabIcon(labPlaceCat, labPlaceStatut, labIconScale),
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
      icon: makeLabIcon(labEditCat, labEditStatut, labIconScale),
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
    if (!drawGangId) {
      setDrawError("Sélectionnez un gang.");
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

    const result = await createZone(formData);
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
    const result = await acquireLock(formData);

    if (result.error) {
      setModalError(result.error);
      await fetchLocks();
      return;
    }

    setSelectedZoneId(null);
    setEditingZoneId(zone.id);
    setEditingPoints(zone.points);
    setEditGangId(zone.gang_id);
    setEditType(zone.type_zone);
    setEditError(null);
    setMode("editing");
  }

  async function cancelEditing() {
    if (editingZoneId) {
      const formData = new FormData();
      formData.set("zone_id", editingZoneId);
      await releaseLock(formData);
    }
    setEditingZoneId(null);
    setEditingPoints([]);
    setEditError(null);
    setMode("view");
    fetchLocks();
  }

  async function saveEditing() {
    if (!editingZoneId) return;
    if (!editGangId) {
      setEditError("Sélectionnez un gang.");
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

    const result = await updateZone(formData);
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
    const result = await deleteZone(formData);

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
    formData.set("position", JSON.stringify(labPlacePos));

    const result = await createLabMarker(formData);
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
    const result = await acquireLabLock(formData);

    if (result.error) {
      setLabModalError(result.error);
      await fetchLocks();
      return;
    }

    setSelectedLabId(null);
    setEditingLabId(marker.id);
    setLabEditPos(marker.position);
    labEditPosRef.current = marker.position;
    setLabEditCat(marker.categorie);
    setLabEditStatut(marker.statut);
    setLabEditOrg(marker.organisation_id);
    setLabEditError(null);
    setMode("lab-editing");
  }

  async function cancelEditingLab() {
    if (editingLabId) {
      const formData = new FormData();
      formData.set("marker_id", editingLabId);
      await releaseLabLock(formData);
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
    formData.set("position", JSON.stringify(labEditPos));

    const result = await updateLabMarker(formData);
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
    const result = await deleteLabMarker(formData);

    if (result.error) {
      setLabModalError(result.error);
      return;
    }

    setSelectedLabId(null);
    fetchMapData();
  }

  // --- Sélections dérivées -----------------------------------------

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;
  const selectedGang = selectedZone
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
  const selectedLabLock = selectedLab
    ? labLocks.get(selectedLab.id)
    : undefined;
  const selectedLabLockedByOther =
    selectedLabLock && selectedLabLock.locked_by !== currentUserId
      ? { pseudo: selectedLabLock.pseudo }
      : null;

  const panelSelectClass =
    "w-full rounded border border-gtf-border bg-gtf-panel-alt px-2 py-1.5 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none";
  const panelLabelClass =
    "mb-1 block font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted";

  const someFilterHidden = Object.values(filters).some((v) => !v);

  return (
    <div className="relative h-[75vh] w-full overflow-hidden rounded-md border border-gtf-border">
      <div ref={containerRef} className="h-full w-full bg-[#0A0C0F]" />

      {/* Haut à droite : fond de carte + filtres d'affichage */}
      <div className="absolute right-3 top-3 z-[500] flex w-48 flex-col gap-2">
        <select
          value={layer}
          onChange={(e) => setLayer(e.target.value as MapLayerKey)}
          className="rounded border border-gtf-border bg-gtf-panel/95 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-gtf-text shadow-lg focus:border-gtf-blue focus:outline-none"
        >
          {MAP_LAYERS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

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
            <div className="border-t border-gtf-border p-3">
              <p className={panelLabelClass}>Zones</p>
              <FilterCheckbox
                label="Vente"
                checked={filters.zoneVente}
                onChange={() => toggleFilter("zoneVente")}
              />
              <FilterCheckbox
                label="Influence"
                checked={filters.zoneInfluence}
                onChange={() => toggleFilter("zoneInfluence")}
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

              {someFilterHidden && (
                <button
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="mt-3 w-full rounded border border-gtf-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted hover:text-gtf-text"
                >
                  Tout afficher
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Panneau d'action principal */}
      <div className="absolute left-3 top-3 z-[500]">
        {mode === "view" && canWrite && (
          <div className="flex flex-col gap-2">
            <button
              onClick={startDrawing}
              className="rounded bg-gtf-blue px-4 py-2 font-mono text-xs uppercase tracking-widest text-gtf-text shadow-lg hover:bg-gtf-blue-hover"
            >
              Ajouter une zone
            </button>
            <button
              onClick={startPlacingLab}
              className="rounded border border-gtf-border bg-gtf-panel/95 px-4 py-2 font-mono text-xs uppercase tracking-widest text-gtf-text shadow-lg hover:border-gtf-blue"
            >
              Ajouter un labo
            </button>
          </div>
        )}

        {mode === "drawing" && (
          <div className="w-72 rounded-md border border-gtf-border bg-gtf-panel/95 p-3 shadow-lg">
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-gtf-text">
              Nouvelle zone
            </p>
            <div className="mt-2">
              <label className={panelLabelClass}>Gang</label>
              <select
                value={drawGangId}
                onChange={(e) => setDrawGangId(e.target.value)}
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
            <div className="mt-2">
              <label className={panelLabelClass}>Type</label>
              <select
                value={drawType}
                onChange={(e) => setDrawType(e.target.value as ZoneType)}
                className={panelSelectClass}
              >
                <option value="vente">Vente</option>
                <option value="influence">Influence</option>
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
                className="rounded bg-gtf-blue px-3 py-1.5 text-xs uppercase tracking-wider text-gtf-text hover:bg-gtf-blue-hover disabled:opacity-60"
              >
                {drawPending ? "..." : "Valider la zone"}
              </button>
              <button
                onClick={undoLastPoint}
                disabled={drawingPoints.length === 0}
                className="rounded border border-gtf-border px-3 py-1.5 text-xs uppercase tracking-wider text-gtf-text-muted hover:text-gtf-text disabled:opacity-40"
              >
                Annuler le dernier point
              </button>
              <button
                onClick={cancelDrawing}
                className="rounded border border-gtf-red px-3 py-1.5 text-xs uppercase tracking-wider text-gtf-red hover:bg-gtf-red/10"
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
          <div className="w-72 rounded-md border border-gtf-border bg-gtf-panel/95 p-3 shadow-lg">
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-gtf-text">
              Modification de la zone
            </p>
            <div className="mt-2">
              <label className={panelLabelClass}>Gang</label>
              <select
                value={editGangId}
                onChange={(e) => setEditGangId(e.target.value)}
                className={panelSelectClass}
              >
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
                <option value="influence">Influence</option>
              </select>
            </div>
            <p className="mt-2 font-mono text-[11px] text-gtf-text-muted">
              Glissez les points pour ajuster le contour.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={saveEditing}
                disabled={editPending}
                className="rounded bg-gtf-blue px-3 py-1.5 text-xs uppercase tracking-wider text-gtf-text hover:bg-gtf-blue-hover disabled:opacity-60"
              >
                {editPending ? "..." : "Enregistrer"}
              </button>
              <button
                onClick={cancelEditing}
                className="rounded border border-gtf-border px-3 py-1.5 text-xs uppercase tracking-wider text-gtf-text-muted hover:text-gtf-text"
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
          <div className="w-72 rounded-md border border-gtf-border bg-gtf-panel/95 p-3 shadow-lg">
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-gtf-text">
              Nouveau laboratoire
            </p>
            <div className="mt-2">
              <label className={panelLabelClass}>Catégorie</label>
              <select
                value={labPlaceCat}
                onChange={(e) =>
                  setLabPlaceCat(e.target.value as LabCategorie)
                }
                className={panelSelectClass}
              >
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
                onChange={(e) =>
                  setLabPlaceStatut(e.target.value as LabStatut)
                }
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
            <p className="mt-2 font-mono text-[11px] text-gtf-text-muted">
              {labPlacePos
                ? "Position enregistrée — cliquez ailleurs pour la corriger."
                : "Cliquez sur la carte pour positionner le labo."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={validatePlacingLab}
                disabled={labPlacePending}
                className="rounded bg-gtf-blue px-3 py-1.5 text-xs uppercase tracking-wider text-gtf-text hover:bg-gtf-blue-hover disabled:opacity-60"
              >
                {labPlacePending ? "..." : "Valider le labo"}
              </button>
              <button
                onClick={cancelPlacingLab}
                className="rounded border border-gtf-red px-3 py-1.5 text-xs uppercase tracking-wider text-gtf-red hover:bg-gtf-red/10"
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
          <div className="w-72 rounded-md border border-gtf-border bg-gtf-panel/95 p-3 shadow-lg">
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-gtf-text">
              Modification du laboratoire
            </p>
            <div className="mt-2">
              <label className={panelLabelClass}>Catégorie</label>
              <select
                value={labEditCat}
                onChange={(e) => setLabEditCat(e.target.value as LabCategorie)}
                className={panelSelectClass}
              >
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
                onChange={(e) => setLabEditStatut(e.target.value as LabStatut)}
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
            <p className="mt-2 font-mono text-[11px] text-gtf-text-muted">
              Glissez le marqueur pour le repositionner.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={saveEditingLab}
                disabled={labEditPending}
                className="rounded bg-gtf-blue px-3 py-1.5 text-xs uppercase tracking-wider text-gtf-text hover:bg-gtf-blue-hover disabled:opacity-60"
              >
                {labEditPending ? "..." : "Enregistrer"}
              </button>
              <button
                onClick={cancelEditingLab}
                className="rounded border border-gtf-border px-3 py-1.5 text-xs uppercase tracking-wider text-gtf-text-muted hover:text-gtf-text"
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
          lockedByOther={selectedLabLockedByOther}
          onClose={() => setSelectedLabId(null)}
          onEdit={() => startEditingLab(selectedLab)}
          onDelete={() => handleDeleteLab(selectedLab.id)}
          editError={labModalError}
          canWrite={canWrite}
        />
      )}
    </div>
  );
}
