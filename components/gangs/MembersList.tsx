"use client";

import { useRef, useState, useTransition } from "react";
import {
  createGangMember,
  updateGangMember,
  deleteGangMember,
} from "@/app/(app)/gangs/actions";
import { ActionButton } from "@/components/ui/ActionButton";
import { Spinner } from "@/components/ui/Spinner";
import { MemberStatutBadge } from "./MemberStatutBadge";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import {
  btn,
  fieldCompactClass,
  inputBase,
  labelClass,
} from "@/lib/ui/styles";
import type { GangMember, MembreStatut } from "@/lib/supabase/gangs-types";

const STATUTS: { value: MembreStatut; label: string }[] = [
  { value: "actif", label: "Actif" },
  { value: "recherche", label: "Recherché" },
  { value: "arrete", label: "Arrêté" },
  { value: "decede", label: "Décédé" },
];

export function MembersList({
  gangId,
  members,
  canWrite,
}: {
  gangId: string;
  members: GangMember[];
  canWrite: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {canWrite && <AddMemberForm gangId={gangId} />}

      <div className="overflow-x-auto rounded-md border border-gtf-border">
        <table className="gtf-stack w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gtf-border bg-gtf-panel-alt font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Statut</th>
              {canWrite && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <MemberRow
                key={member.id}
                gangId={gangId}
                member={member}
                canWrite={canWrite}
              />
            ))}
            {members.length === 0 && (
              <tr>
                <td
                  colSpan={canWrite ? 4 : 3}
                  className="px-4 py-6 text-center text-gtf-text-muted"
                >
                  Aucun membre identifié.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddMemberForm({ gangId }: { gangId: string }) {
  const run = useActionRunner();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAction(formData: FormData) {
    setError(null);
    formData.set("gang_id", gangId);

    startTransition(async () => {
      const result = await run(() => createGangMember(formData), {
        success: "Membre ajouté",
        inline: true,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      formRef.current?.reset();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={btn("primary", "md", "self-start")}
      >
        Ajouter un membre
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleAction}
      className="flex flex-wrap items-end gap-4 rounded-md border border-gtf-border bg-gtf-panel-alt p-4"
    >
      <div className="w-full sm:w-auto">
        <label htmlFor="new-member-nom" className={labelClass}>
          Nom
        </label>
        <input
          id="new-member-nom"
          name="nom"
          required
          className={`${inputBase} w-full sm:w-auto`}
        />
      </div>
      <div className="w-full sm:w-auto">
        <label htmlFor="new-member-role" className={labelClass}>
          Rôle
        </label>
        <input
          id="new-member-role"
          name="role"
          placeholder="Chef, Lieutenant, Membre..."
          className={`${inputBase} w-full sm:w-auto`}
        />
      </div>
      <div className="w-full sm:w-auto">
        <label htmlFor="new-member-statut" className={labelClass}>
          Statut
        </label>
        <select
          id="new-member-statut"
          name="statut"
          defaultValue="actif"
          className={`${inputBase} w-full sm:w-auto`}
        >
          {STATUTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={btn("primary")}
      >
        {pending && <Spinner className="h-3 w-3" />}
        Ajouter
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={pending}
        className={btn("secondary")}
      >
        Annuler
      </button>

      {error && (
        <p role="alert" className="w-full text-xs text-gtf-red">
          {error}
        </p>
      )}
    </form>
  );
}

function MemberRow({
  gangId,
  member,
  canWrite,
}: {
  gangId: string;
  member: GangMember;
  canWrite: boolean;
}) {
  const run = useActionRunner();
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState(member.nom);
  const [role, setRole] = useState(member.role);
  const [statut, setStatut] = useState<MembreStatut>(member.statut);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    const formData = new FormData();
    formData.set("id", member.id);
    formData.set("gang_id", gangId);
    formData.set("nom", nom);
    formData.set("role", role);
    formData.set("statut", statut);

    startTransition(async () => {
      const result = await run(() => updateGangMember(formData), {
        success: "Membre mis à jour",
        inline: true,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  return (
    <tr className="border-b border-gtf-border last:border-0">
      <td data-label="Nom" className="px-4 py-3">
        {editing ? (
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className={`w-full ${fieldCompactClass}`}
          />
        ) : (
          member.nom
        )}
      </td>
      <td data-label="Rôle" className="px-4 py-3">
        {editing ? (
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={`w-full ${fieldCompactClass}`}
          />
        ) : (
          member.role || "—"
        )}
      </td>
      <td data-label="Statut" className="px-4 py-3">
        {editing ? (
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value as MembreStatut)}
            className={fieldCompactClass}
          >
            {STATUTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        ) : (
          <MemberStatutBadge statut={member.statut} />
        )}
      </td>
      {canWrite && (
        <td className="px-4 py-3">
          <div className="gtf-stack-actions flex flex-wrap justify-end gap-2">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={pending}
                  className={btn("primary", "sm")}
                >
                  {pending && <Spinner className="h-3 w-3" />}
                  Enregistrer
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setNom(member.nom);
                    setRole(member.role);
                    setStatut(member.statut);
                    setError(null);
                  }}
                  className={btn("secondary", "sm")}
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className={btn("secondary", "sm")}
                >
                  Modifier
                </button>
                <ActionButton
                  action={deleteGangMember}
                  fields={{ id: member.id, gang_id: gangId }}
                  confirm={`Retirer "${member.nom}" de la liste des membres ?`}
                  success="Membre retiré"
                  variant="danger"
                  size="sm"
                >
                  Supprimer
                </ActionButton>
              </>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-1 text-right text-xs text-gtf-red">
              {error}
            </p>
          )}
        </td>
      )}
    </tr>
  );
}
