export type ZoneType = "vente" | "influence";

export type ZonePoint = { x: number; y: number };

export type SensitiveZone = {
  id: string;
  gang_id: string;
  type_zone: ZoneType;
  points: ZonePoint[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ZoneHistoryEntry = {
  id: string;
  zone_id: string;
  agent_id: string | null;
  agent_pseudo: string;
  resume: string;
  created_at: string;
};

export type ZoneLock = {
  zone_id: string;
  locked_by: string;
  locked_at: string;
};

export const LOCK_DURATION_MS = 3 * 60 * 1000;
