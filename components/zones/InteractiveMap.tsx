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
import { ZoneDetailModal } from "./ZoneDetailModal";
import type { Gang } from "@/lib/supabase/gangs-types";
import type {
  SensitiveZone,
  ZonePoint,
  ZoneType,
} from "@/lib/supabase/zones-types";
import { LOCK_DURATION_MS } from "@/lib/supabase/zones-types";

const MAP_LAYERS = [
  { value: "atlas", label: "Atlas", url: "/map/atlas.png" },
  { value: "satellite", label: "Satellite", url: "/map/satellite.jpg" },
  { value: "road", label: "Routière", url: "/map/road.jpg" },
] as const;

type MapLayerKey = (typeof MAP_LAYERS)[number]["value"];

type LockInfo = { locked_by: string; locked_at: string; pseudo: string };

type Mode = "view" | "drawing" | "editing";

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
  const modeRef = useRef<Mode>("view");
  const drawingPointsRef = useRef<ZonePoint[]>([]);

  const [layer, setLayer] = useState<MapLayerKey>("atlas");
  const [gangs, setGangs] = useState<Gang[]>([]);
  const [zones, setZones] = useState<SensitiveZone[]>([]);
  const [locks, setLocks] = useState<Map<string, LockInfo>>(new Map());

  const [mode, setMode] = useState<Mode>("view");
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

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    drawingPointsRef.current = drawingPoints;
  }, [drawingPoints]);

  // --- Chargement initial + rafraîchissement périodique ------------------

  async function fetchZonesAndGangs() {
    const supabase = createClient();
    const [{ data: gangsData }, { data: zonesData }] = await Promise.all([
      supabase.from("gangs").select("*").returns<Gang[]>(),
      supabase.from("sensitive_zones").select("*").returns<SensitiveZone[]>(),
    ]);
    setGangs(gangsData ?? []);
    setZones(zonesData ?? []);
  }

  async function fetchLocks() {
    const result = await getLocksWithPseudos();
    // Les verrous expirés (>3 min) sont écartés ici (dans un callback, pas
    // le rendu) : `locks` ne contient ensuite que des verrous actifs, ce
    // qui évite d'appeler Date.now() pendant le rendu en aval.
    const now = Date.now();
    const next = new Map<string, LockInfo>();
    for (const l of result) {
      if (now - new Date(l.locked_at).getTime() < LOCK_DURATION_MS) {
        next.set(l.zone_id, {
          locked_by: l.locked_by,
          locked_at: l.locked_at,
          pseudo: l.pseudo,
        });
      }
    }
    setLocks(next);
  }

  useEffect(() => {
    // Synchronisation avec le serveur (chargement initial + sondage
    // périodique) : cas d'usage explicitement prévu pour un effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchZonesAndGangs();
    fetchLocks();
    const interval = setInterval(() => {
      fetchZonesAndGangs();
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

        // Zoom calculé nous-mêmes à partir de la taille réellement mesurée
        // du conteneur, plutôt que de dépendre du fitBounds interne de
        // Leaflet (sensible au timing juste après la création de la carte).
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

        map.on("click", (e: L.LeafletMouseEvent) => {
          if (modeRef.current === "drawing") {
            setDrawingPoints((prev) => [...prev, latLngToPoint(e.latlng)]);
          }
        });

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

  // --- Rendu des zones (redessine à chaque changement pertinent) ---------

  useEffect(() => {
    const group = zonesLayerRef.current;
    if (!group) return;
    group.clearLayers();

    const gangsById = new Map(gangs.map((g) => [g.id, g]));

    for (const zone of zones) {
      const isBeingEdited = mode === "editing" && zone.id === editingZoneId;
      if (isBeingEdited) continue; // rendu séparément par l'effet d'édition

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
  }, [zones, gangs, locks, mode, editingZoneId, currentUserId]);

  // --- Aperçu en direct pendant le dessin d'une nouvelle zone -------------

  useEffect(() => {
    const group = drawLayerRef.current;
    if (!group) return;
    group.clearLayers();

    if (mode === "drawing" && drawingPoints.length > 0) {
      const latlngs = pointsToLatLngs(drawingPoints);
      L.polyline(latlngs, { color: "#5B94D6", weight: 2, dashArray: "4,4" }).addTo(
        group,
      );
      drawingPoints.forEach((p) => {
        L.marker([p.y, p.x], { icon: makeHandleIcon(), interactive: false }).addTo(
          group,
        );
      });
    }
  }, [mode, drawingPoints]);

  // --- Édition d'une zone existante : points déplaçables ------------------

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

  // --- Actions : dessin d'une nouvelle zone -------------------------------

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
    fetchZonesAndGangs();
  }

  // --- Actions : édition d'une zone existante -----------------------------

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
    fetchZonesAndGangs();
    fetchLocks();
  }

  // --- Suppression ---------------------------------------------------------

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
    fetchZonesAndGangs();
  }

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;
  const selectedGang = selectedZone
    ? gangs.find((g) => g.id === selectedZone.gang_id) ?? null
    : null;
  const selectedLock = selectedZone ? locks.get(selectedZone.id) : undefined;
  const selectedLockedByOther =
    selectedLock && selectedLock.locked_by !== currentUserId
      ? { pseudo: selectedLock.pseudo }
      : null;

  return (
    <div className="relative h-[75vh] w-full overflow-hidden rounded-md border border-gtf-border">
      <div ref={containerRef} className="h-full w-full bg-[#0A0C0F]" />

      {/* Sélecteur de version de carte */}
      <div className="absolute right-3 top-3 z-[500]">
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
      </div>

      {/* Panneau d'action principal */}
      <div className="absolute left-3 top-3 z-[500]">
        {mode === "view" && canWrite && (
          <button
            onClick={startDrawing}
            className="rounded bg-gtf-blue px-4 py-2 font-mono text-xs uppercase tracking-widest text-gtf-text shadow-lg hover:bg-gtf-blue-hover"
          >
            Ajouter une zone
          </button>
        )}

        {mode === "drawing" && (
          <div className="w-72 rounded-md border border-gtf-border bg-gtf-panel/95 p-3 shadow-lg">
            <p className="font-display text-xs font-semibold uppercase tracking-wide text-gtf-text">
              Nouvelle zone
            </p>
            <div className="mt-2">
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted">
                Gang
              </label>
              <select
                value={drawGangId}
                onChange={(e) => setDrawGangId(e.target.value)}
                className="w-full rounded border border-gtf-border bg-gtf-panel-alt px-2 py-1.5 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
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
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted">
                Type
              </label>
              <select
                value={drawType}
                onChange={(e) => setDrawType(e.target.value as ZoneType)}
                className="w-full rounded border border-gtf-border bg-gtf-panel-alt px-2 py-1.5 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
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
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted">
                Gang
              </label>
              <select
                value={editGangId}
                onChange={(e) => setEditGangId(e.target.value)}
                className="w-full rounded border border-gtf-border bg-gtf-panel-alt px-2 py-1.5 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
              >
                {gangs.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2">
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-gtf-text-muted">
                Type
              </label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as ZoneType)}
                className="w-full rounded border border-gtf-border bg-gtf-panel-alt px-2 py-1.5 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
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
    </div>
  );
}
