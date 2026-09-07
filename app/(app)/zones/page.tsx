import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MapLoader } from "@/components/zones/MapLoader";
import { uniteCanWrite } from "@/lib/permissions";

export default async function ZonesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, unite")
    .eq("id", user!.id)
    .single();

  const canWrite = uniteCanWrite("zones", profile ?? {});

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Carte interactive des zones sensibles
        </h1>
        {profile?.role === "admin" && (
          <Link
            href="/admin/zones/corbeille"
            className="rounded border border-gtf-border px-4 py-2 text-xs uppercase tracking-widest text-gtf-text-muted hover:text-gtf-text"
          >
            Corbeille
          </Link>
        )}
      </div>

      <div className="mt-6">
        <MapLoader currentUserId={user!.id} canWrite={canWrite} />
      </div>
    </div>
  );
}
