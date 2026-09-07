"use client";

import { useState, useTransition } from "react";
import {
  updateAgent,
  updateAgentUnite,
  toggleStatut,
  deleteAgent,
  resetAgentPassword,
} from "@/app/(app)/admin/agents/actions";
import { GRADES } from "@/lib/constants";
import { UNITES, UNITE_LABELS } from "@/lib/permissions";
import type { Profile } from "@/lib/supabase/types";

// Rang du grade : plus élevé = plus haut dans la liste (Commandant → Agent).
function gradeRank(grade: string): number {
  const i = GRADES.indexOf(grade as (typeof GRADES)[number]);
  return i === -1 ? -1 : i;
}

export function AgentsTable({
  profiles,
  currentUserId,
  canManageAgents,
  canManageUnite,
}: {
  profiles: Profile[];
  currentUserId: string;
  canManageAgents: boolean;
  canManageUnite: boolean;
}) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visible = profiles
    .filter((p) => {
      if (!q) return true;
      return [p.pseudo, p.grade, p.role, p.unite, UNITE_LABELS[p.unite] ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    })
    // Tri de base : grade décroissant, puis pseudo A→Z.
    .slice()
    .sort(
      (a, b) =>
        gradeRank(b.grade) - gradeRank(a.grade) ||
        a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" }),
    );

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un agent…"
          className="w-full max-w-xs rounded border border-gtf-border bg-gtf-panel-alt px-3 py-2 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-gtf-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gtf-border bg-gtf-panel-alt font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
              <th className="px-4 py-3">Pseudo</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Unité</th>
              <th className="px-4 py-3">Statut</th>
              {canManageAgents && (
                <th className="px-4 py-3 text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((profile) => (
              <AgentRow
                key={profile.id}
                profile={profile}
                isSelf={profile.id === currentUserId}
                canManageAgents={canManageAgents}
                canManageUnite={canManageUnite}
              />
            ))}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={canManageAgents ? 6 : 5}
                  className="px-4 py-6 text-center text-gtf-text-muted"
                >
                  Aucun agent ne correspond à « {query} ».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UniteCell({
  profile,
  editable,
}: {
  profile: Profile;
  editable: boolean;
}) {
  const [unite, setUnite] = useState(profile.unite);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!editable) {
    return <span className="font-mono text-xs">{profile.unite}</span>;
  }

  function handleChange(next: string) {
    const previous = unite;
    setUnite(next as Profile["unite"]);
    setError(null);
    setSaved(false);

    const formData = new FormData();
    formData.set("id", profile.id);
    formData.set("unite", next);

    startTransition(async () => {
      const result = await updateAgentUnite(formData);
      if (result.error) {
        setError(result.error);
        setUnite(previous);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div>
      <select
        value={unite}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded border border-gtf-border bg-gtf-panel px-2 py-1 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none disabled:opacity-60"
      >
        {UNITES.map((u) => (
          <option key={u} value={u} title={UNITE_LABELS[u]}>
            {u}
          </option>
        ))}
      </select>
      {saved && !error && (
        <span className="ml-2 text-xs text-gtf-green">enregistré</span>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-gtf-red">
          {error}
        </p>
      )}
    </div>
  );
}

function AgentRow({
  profile,
  isSelf,
  canManageAgents,
  canManageUnite,
}: {
  profile: Profile;
  isSelf: boolean;
  canManageAgents: boolean;
  canManageUnite: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [pseudo, setPseudo] = useState(profile.pseudo);
  const [grade, setGrade] = useState(profile.grade);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    const formData = new FormData();
    formData.set("id", profile.id);
    formData.set("pseudo", pseudo);
    formData.set("grade", grade);

    startTransition(async () => {
      const result = await updateAgent(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  function handleToggleStatut() {
    setError(null);
    const formData = new FormData();
    formData.set("id", profile.id);
    formData.set("statut", profile.statut);

    startTransition(async () => {
      const result = await toggleStatut(formData);
      if (result.error) setError(result.error);
    });
  }

  function handleResetPassword() {
    setError(null);

    if (newPassword.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    const formData = new FormData();
    formData.set("id", profile.id);
    formData.set("password", newPassword);

    startTransition(async () => {
      const result = await resetAgentPassword(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNewPassword("");
      setResetting(false);
    });
  }

  function handleDelete() {
    if (
      !window.confirm(
        `Supprimer définitivement le compte de "${profile.pseudo}" ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("id", profile.id);

    startTransition(async () => {
      const result = await deleteAgent(formData);
      if (result.error) setError(result.error);
    });
  }

  return (
    <tr className="border-b border-gtf-border last:border-0">
      <td className="px-4 py-3">
        {editing ? (
          <input
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className="w-full rounded border border-gtf-border bg-gtf-panel px-2 py-1 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
          />
        ) : (
          profile.pseudo
        )}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="rounded border border-gtf-border bg-gtf-panel px-2 py-1 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
          >
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        ) : (
          profile.grade
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gtf-text-muted">
        {profile.role}
      </td>
      <td className="px-4 py-3">
        <UniteCell profile={profile} editable={canManageUnite} />
      </td>
      <td className="px-4 py-3">
        <span
          className={
            profile.statut === "actif" ? "text-gtf-green" : "text-gtf-red"
          }
        >
          {profile.statut}
        </span>
      </td>
      {canManageAgents && (
        <td className="px-4 py-3">
          {resetting ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <input
                type="text"
                autoFocus
                placeholder="Nouveau mot de passe temporaire"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rounded border border-gtf-border bg-gtf-panel px-2 py-1 text-sm text-gtf-text focus:border-gtf-blue focus:outline-none"
              />
              <button
                onClick={handleResetPassword}
                disabled={pending}
                className="rounded bg-gtf-blue px-3 py-1 text-xs uppercase tracking-wider text-gtf-text hover:bg-gtf-blue-hover disabled:opacity-60"
              >
                Valider
              </button>
              <button
                onClick={() => {
                  setResetting(false);
                  setNewPassword("");
                  setError(null);
                }}
                className="rounded border border-gtf-border px-3 py-1 text-xs uppercase tracking-wider text-gtf-text-muted hover:text-gtf-text"
              >
                Annuler
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
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
                      setPseudo(profile.pseudo);
                      setGrade(profile.grade);
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
                    onClick={() => setResetting(true)}
                    className="rounded border border-gtf-border px-3 py-1 text-xs uppercase tracking-wider text-gtf-text-muted hover:text-gtf-text"
                  >
                    Réinitialiser mdp
                  </button>
                  <button
                    onClick={handleToggleStatut}
                    disabled={pending || isSelf}
                    className="rounded border border-gtf-amber px-3 py-1 text-xs uppercase tracking-wider text-gtf-amber hover:bg-gtf-amber/10 disabled:opacity-40"
                  >
                    {profile.statut === "actif" ? "Suspendre" : "Réactiver"}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={pending || isSelf}
                    className="rounded border border-gtf-red px-3 py-1 text-xs uppercase tracking-wider text-gtf-red hover:bg-gtf-red/10 disabled:opacity-40"
                  >
                    Supprimer
                  </button>
                </>
              )}
            </div>
          )}
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
