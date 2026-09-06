"use client";

import { useRef, useState, useTransition } from "react";
import {
  createGangMember,
  updateGangMember,
  deleteGangMember,
} from "@/app/(app)/gangs/actions";
import { MemberStatutBadge } from "./MemberStatutBadge";
import type { GangMember, MembreStatut } from "@/lib/supabase/gangs-types";

const STATUTS: { value: MembreStatut; label: string }[] = [
  { value: "actif", label: "Actif" },
  { value: "recherche", label: "Recherché" },
  { value: "arrete", label: "Arrêté" },
  { value: "decede", label: "Décédé" },
];

const inputClass =
  "rounded border border-gtf-border bg-gtf-panel px-2 py-1.5 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none";

export function MembersList({
  gangId,
  members,
}: {
  gangId: string;
  members: GangMember[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <AddMemberForm gangId={gangId} />

      <div className="overflow-x-auto rounded-md border border-gtf-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gtf-border bg-gtf-panel-alt font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <MemberRow key={member.id} gangId={gangId} member={member} />
            ))}
            {members.length === 0 && (
              <tr>
                <td
                  colSpan={4}
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
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAction(formData: FormData) {
    setError(null);
    formData.set("gang_id", gangId);

    startTransition(async () => {
      const result = await createGangMember(formData);
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
        className="self-start rounded bg-gtf-blue px-4 py-2 text-xs uppercase tracking-widest text-gtf-text hover:bg-gtf-blue-hover"
      >
        Ajouter un membre
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleAction}
      className="flex flex-wrap items-end gap-3 rounded-md border border-gtf-border bg-gtf-panel-alt p-3"
    >
      <div>
        <label
          htmlFor="new-member-nom"
          className="mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted"
        >
          Nom
        </label>
        <input id="new-member-nom" name="nom" required className={inputClass} />
      </div>
      <div>
        <label
          htmlFor="new-member-role"
          className="mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted"
        >
          Rôle
        </label>
        <input
          id="new-member-role"
          name="role"
          placeholder="Chef, Lieutenant, Membre..."
          className={inputClass}
        />
      </div>
      <div>
        <label
          htmlFor="new-member-statut"
          className="mb-1 block font-mono text-xs uppercase tracking-wider text-gtf-text-muted"
        >
          Statut
        </label>
        <select
          id="new-member-statut"
          name="statut"
          defaultValue="actif"
          className={inputClass}
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
        className="rounded bg-gtf-blue px-4 py-2 text-xs uppercase tracking-widest text-gtf-text hover:bg-gtf-blue-hover disabled:opacity-60"
      >
        {pending ? "..." : "Ajouter"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded border border-gtf-border px-4 py-2 text-xs uppercase tracking-widest text-gtf-text-muted hover:text-gtf-text"
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
}: {
  gangId: string;
  member: GangMember;
}) {
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
      const result = await updateGangMember(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  function handleDelete() {
    if (!window.confirm(`Retirer "${member.nom}" de la liste des membres ?`)) {
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("id", member.id);
    formData.set("gang_id", gangId);

    startTransition(async () => {
      const result = await deleteGangMember(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <tr className="border-b border-gtf-border last:border-0">
      <td className="px-4 py-3">
        {editing ? (
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className={`w-full ${inputClass}`}
          />
        ) : (
          member.nom
        )}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={`w-full ${inputClass}`}
          />
        ) : (
          member.role || "—"
        )}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <select
            value={statut}
            onChange={(e) => setStatut(e.target.value as MembreStatut)}
            className={inputClass}
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
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={pending}
                className="rounded bg-gtf-blue px-3 py-1 text-xs uppercase tracking-wider text-gtf-text hover:bg-gtf-blue-hover disabled:opacity-60"
              >
                Enregistrer
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setNom(member.nom);
                  setRole(member.role);
                  setStatut(member.statut);
                }}
                className="rounded border border-gtf-border px-3 py-1 text-xs uppercase tracking-wider text-gtf-text-muted hover:text-gtf-text"
              >
                Annuler
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="rounded border border-gtf-border px-3 py-1 text-xs uppercase tracking-wider text-gtf-text-muted hover:text-gtf-text"
              >
                Modifier
              </button>
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
          <p role="alert" className="mt-1 text-right text-xs text-gtf-red">
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}
