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

export type AnnouncementRead = {
  id: string;
  announcement_id: string;
  user_id: string;
  read_at: string;
};
