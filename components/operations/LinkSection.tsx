"use client";

import { useTransition } from "react";
import Link from "next/link";
import { addOperationLink, removeOperationLink } from "@/app/(app)/operations/actions";
import { EntityAutocomplete } from "@/components/operations/EntityAutocomplete";
import { ActionButton } from "@/components/ui/ActionButton";
import { Panel } from "@/components/ui/Panel";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import type { OperationLinkKind } from "@/lib/supabase/operations-types";

export type LinkedRow = { linkId: string; label: string; href: string };

// Section générique de liens many-to-many (enquêtes / mandats / labos /
// zones / groupes B.D.D.) : recherche + auto-complétion pour ajouter un
// élément existant, liste des éléments déjà liés (cliquables vers leur
// fiche) avec retrait. Calqué sur le lien labo ↔ enquête déjà en place.
export function LinkSection({
  title,
  kind,
  operationId,
  linked,
  available,
}: {
  title: string;
  kind: OperationLinkKind;
  operationId: string;
  linked: LinkedRow[];
  available: { id: string; label: string }[];
}) {
  const run = useActionRunner();
  const [pending, startTransition] = useTransition();

  function handleAdd(targetId: string) {
    const formData = new FormData();
    formData.set("operation_id", operationId);
    formData.set("kind", kind);
    formData.set("target_id", targetId);
    startTransition(async () => {
      await run(() => addOperationLink(formData), { success: "Élément lié." });
    });
  }

  return (
    <Panel title={title}>
      <ul className="flex flex-col gap-2">
        {linked.map((item) => (
          <li
            key={item.linkId}
            className="flex items-center justify-between gap-2 rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2"
          >
            <Link
              href={item.href}
              className="min-w-0 truncate text-sm text-gtf-blue-hover underline"
            >
              {item.label}
            </Link>
            <ActionButton
              action={removeOperationLink}
              fields={{ operation_id: operationId, kind, link_id: item.linkId }}
              success="Lien retiré."
              variant="danger"
              size="sm"
            >
              Retirer
            </ActionButton>
          </li>
        ))}
        {linked.length === 0 && (
          <p className="text-sm text-gtf-text-muted">Aucun élément lié.</p>
        )}
      </ul>

      <div className="mt-3">
        <EntityAutocomplete
          items={available}
          onSelect={handleAdd}
          disabled={pending}
          placeholder="Rechercher pour ajouter…"
        />
      </div>
    </Panel>
  );
}
