import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementForm } from "@/components/announcements/AnnouncementForm";
import type { Announcement } from "@/lib/supabase/announcements-types";

export default async function ModifierAnnoncePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: announcement } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .single<Announcement>();

  if (!announcement) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const canEdit =
    announcement.created_by === user.id || profile?.role === "admin";

  // Défense en profondeur : la RLS bloque déjà la modification côté base.
  if (!canEdit) {
    redirect("/annonces");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Modifier la notification
      </h1>
      <div className="mt-6">
        <AnnouncementForm announcement={announcement} />
      </div>
    </div>
  );
}
