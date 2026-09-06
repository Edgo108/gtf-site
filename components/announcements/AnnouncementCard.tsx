"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  markAnnouncementRead,
  deleteAnnouncement,
} from "@/app/(app)/annonces/actions";
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
  const [pending, startTransition] = useTransition();
  const [read, setRead] = useState(isRead);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUrgent = announcement.priorite === "urgente";

  function handleMarkRead() {
    setError(null);
    const formData = new FormData();
    formData.set("announcement_id", announcement.id);

    startTransition(async () => {
      const result = await markAnnouncementRead(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setRead(true);
    });
  }

  function handleDelete() {
    if (
      !window.confirm(`Supprimer la notification « ${announcement.titre} » ?`)
    ) {
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("id", announcement.id);

    startTransition(async () => {
      const result = await deleteAnnouncement(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDeleted(true);
    });
  }

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
        <div className="flex items-center gap-2">
          {!read && (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-gtf-blue-hover"
              aria-hidden="true"
              title="Non lu"
            />
          )}
          {isUrgent && (
            <span className="rounded border border-gtf-red bg-gtf-red/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gtf-red">
              Urgent
            </span>
          )}
          <h2 className="font-display text-base font-semibold uppercase tracking-wide text-gtf-text">
            {announcement.titre}
          </h2>
        </div>
        <span className="shrink-0 font-mono text-xs text-gtf-text-muted">
          {new Date(announcement.created_at).toLocaleString("fr-FR")}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm text-gtf-text">
        {announcement.message}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {!read && (
          <button
            onClick={handleMarkRead}
            disabled={pending}
            className="rounded border border-gtf-blue px-3 py-1 text-xs uppercase tracking-wider text-gtf-blue-hover hover:bg-gtf-blue/10 disabled:opacity-60"
          >
            Marquer comme lu
          </button>
        )}
        {canManage && (
          <>
            <Link
              href={`/annonces/${announcement.id}/modifier`}
              className="rounded border border-gtf-border px-3 py-1 text-xs uppercase tracking-wider text-gtf-text-muted hover:text-gtf-text"
            >
              Modifier
            </Link>
            <button
              onClick={handleDelete}
              disabled={pending}
              className="rounded border border-gtf-red px-3 py-1 text-xs uppercase tracking-wider text-gtf-red hover:bg-gtf-red/10 disabled:opacity-60"
            >
              Supprimer
            </button>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-gtf-red">
          {error}
        </p>
      )}
    </div>
  );
}
