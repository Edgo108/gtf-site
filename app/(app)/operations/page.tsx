import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { OperationCard } from "@/components/operations/OperationCard";
import { canAccessOperations } from "@/lib/permissions";
import type { OperationListRow } from "@/lib/supabase/operations-types";
import { btn } from "@/lib/ui/styles";

export default async function OperationsPage() {
  const supabase = await createClient();

  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, unite")
    .eq("id", user.id)
    .single();

  // Section entièrement invisible pour le DOJ (aussi vérifié ici pour
  // bloquer un accès direct par URL, en plus de la nav masquée).
  if (!canAccessOperations(profile ?? {})) {
    redirect("/dashboard");
  }

  // Les opérations pour lesquelles CET agent a un accès complet (admin,
  // lead ou agent en écriture) : la RLS de `operations` ne renvoie que
  // celles-là pour une requête scoping utilisateur normal.
  const { data: accessibleRows } = await supabase
    .from("operations")
    .select("id");
  const accessibleIds = new Set((accessibleRows ?? []).map((r) => r.id));

  // Liste résumée visible à TOUT agent non-DOJ (titre, statut, pseudo du
  // lead uniquement) : construite côté serveur avec la clé service_role,
  // qui sélectionne explicitement ces seules colonnes. Voir le commentaire
  // sur la policy "operations_select" dans supabase/operations.sql.
  const admin = createAdminClient();
  const { data: operations } = await admin
    .from("operations")
    .select("id, titre, statut, lead_id")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const leadIds = [...new Set((operations ?? []).map((o) => o.lead_id))];
  const { data: leadProfiles } = leadIds.length
    ? await admin.from("profiles").select("id, pseudo").in("id", leadIds)
    : { data: [] as { id: string; pseudo: string }[] };
  const pseudoById = new Map((leadProfiles ?? []).map((p) => [p.id, p.pseudo]));

  const rows: OperationListRow[] = (operations ?? []).map((o) => ({
    id: o.id,
    titre: o.titre,
    statut: o.statut,
    lead_pseudo: pseudoById.get(o.lead_id) ?? "Agent inconnu",
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Opérations
        </h1>
        <div className="flex flex-wrap gap-3">
          {profile?.role === "admin" && (
            <Link href="/admin/operations/corbeille" className={btn("secondary", "md")}>
              Corbeille
            </Link>
          )}
          <Link href="/operations/nouvelle" className={btn("primary", "md")}>
            Nouvelle opération
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((operation) => (
          <OperationCard
            key={operation.id}
            operation={operation}
            clickable={accessibleIds.has(operation.id)}
          />
        ))}
        {rows.length === 0 && (
          <p className="col-span-full text-sm text-gtf-text-muted">
            Aucune opération pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}
