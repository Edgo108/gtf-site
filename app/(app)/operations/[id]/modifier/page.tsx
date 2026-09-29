import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OperationForm } from "@/components/operations/OperationForm";
import type { Operation } from "@/lib/supabase/operations-types";

export default async function ModifierOperationPage({
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

  // La RLS ("operations_select") ne renvoie cette ligne que si l'appelant
  // a un accès complet (admin / lead / agent en écriture) — qui sont
  // exactement les agents autorisés à modifier l'opération.
  const { data: operation } = await supabase
    .from("operations")
    .select("*")
    .eq("id", id)
    .single<Operation>();

  if (!operation) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
        Modifier l&apos;opération
      </h1>
      <div className="mt-6">
        <OperationForm operation={operation} />
      </div>
    </div>
  );
}
