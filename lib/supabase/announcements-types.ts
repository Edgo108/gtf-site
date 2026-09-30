export type AnnouncementPriorite = "normale" | "urgente";

export type Announcement = {
  id: string;
  titre: string;
  message: string;
  priorite: AnnouncementPriorite;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

