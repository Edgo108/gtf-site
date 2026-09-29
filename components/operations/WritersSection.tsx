"use client";

import { useTransition } from "react";
import { addOperationWriter, removeOperationWriter } from "@/app/(app)/operations/actions";
import { EntityAutocomplete } from "@/components/operations/EntityAutocomplete";
import { ActionButton } from "@/components/ui/ActionButton";
import { Panel } from "@/components/ui/Panel";
import { useActionRunner } from "@/lib/ui/use-action-runner";

export type WriterRow = { linkId: string; agentId: string; pseudo: string };

// Gestion de la liste des agents ajoutés en écriture. Retirer/ajouter un
// agent est réservé au lead (ou à l'admin) : `canManage` masque les
// contrôles pour un simple agent en écriture, qui voit la liste en lecture
// seule — la RLS refuse de toute façon la requête côté serveur.
export function WritersSection({
  operationId,
  writers,
  availableAgents,
  canManage,
}: {
  operationId: string;
  writers: WriterRow[];
  availableAgents: { id: string; label: string }[];
  canManage: boolean;
}) {
  const run = useActionRunner();
  const [pending, startTransition] = useTransition();

  function handleAdd(agentId: string) {
    const formData = new FormData();
    formData.set("operation_id", operationId);
    formData.set("agent_id", agentId);
    startTransition(async () => {
      await run(() => addOperationWriter(formData), {
        success: "Agent ajouté en écriture.",
      });
    });
  }

  return (
    <Panel title="Agents assignés en écriture">
      <ul className="flex flex-col gap-2">
        {writers.map((w) => (
          <li
            key={w.linkId}
            className="flex items-center justify-between gap-2 rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2"
          >
            <span className="text-sm text-gtf-text">{w.pseudo}</span>
            {canManage && (
              <ActionButton
                action={removeOperationWriter}
                fields={{ id: w.linkId, operation_id: operationId }}
                confirm={`Retirer ${w.pseudo} de la liste d'écriture ?`}
                success="Agent retiré."
                variant="danger"
                size="sm"
              >
                Retirer
              </ActionButton>
            )}
          </li>
        ))}
        {writers.length === 0 && (
          <p className="text-sm text-gtf-text-muted">
            Aucun agent ajouté en écriture.
          </p>
        )}
      </ul>

      {canManage && (
        <div className="mt-3">
          <EntityAutocomplete
            items={availableAgents}
            onSelect={handleAdd}
            disabled={pending}
            placeholder="Rechercher un agent par pseudo…"
          />
        </div>
      )}
    </Panel>
  );
}
