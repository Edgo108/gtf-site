"use client";

import { useState } from "react";
import Link from "next/link";
import {
  markAnnouncementRead,
  deleteAnnouncement,
} from "@/app/(app)/annonces/actions";
import { ActionButton } from "@/components/ui/ActionButton";
import { BADGE_TONES, badgeBase, btn } from "@/lib/ui/styles";
import type { Announcement } from "@/lib/supabase/announcements-types";

export function AnnouncementCard({
  announcement,
  isRead,
  canManage,
}: {
  announcement: Announcement;
  isRead: boolean;
  canManage: boolean;
}) {
  const [read, setRead] = useState(isRead);
  const [deleted, setDeleted] = useState(false);

  const isUrgent = announcement.priorite === "urgente";

  if (deleted) {
    return null;
  }

  return (
    <div
      className={`rounded-md border p-4 ${
        isUrgent
          ? "border-gtf-red bg-gtf-red/5"
          : "border-gtf-border bg-gtf-panel"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {!read && (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-gtf-blue-hover"
              aria-hidden="true"
              title="Non lu"
            />
          )}
          {isUrgent && (
            <span className={`${badgeBase} ${BADGE_TONES.red}`}>Urgent</span>
          )}
          <h2 className="font-display text-base font-semibold uppercase tracking-wide text-gtf-text">
            {announcement.titre}
          </h2>
        </div>
        <span className="shrink-0 font-mono text-xs text-gtf-text-muted">
          {new Date(announcement.created_at).toLocaleString("fr-FR")}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gtf-text">
        {announcement.message}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {!read && (
          <ActionButton
            action={markAnnouncementRead}
            fields={{ announcement_id: announcement.id }}
            success="Annonce marquée comme lue"
            variant="info"
            size="sm"
            onSuccess={() => setRead(true)}
          >
            Marquer comme lu
          </ActionButton>
        )}
        {canManage && (
          <>
            <Link
              href={`/annonces/${announcement.id}/modifier`}
              className={btn("secondary", "sm")}
            >
              Modifier
            </Link>
            <ActionButton
              action={deleteAnnouncement}
              fields={{ id: announcement.id }}
              confirm={`Supprimer la notification « ${announcement.titre} » ?`}
              success="Annonce supprimée"
              variant="danger"
              size="sm"
              onSuccess={() => setDeleted(true)}
            >
              Supprimer
            </ActionButton>
          </>
        )}
      </div>
    </div>
  );
}
