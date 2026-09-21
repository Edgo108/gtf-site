"use client";

import { useState, useTransition } from "react";
import {
  updateAgent,
  updateAgentUnite,
  toggleStatut,
  deleteAgent,
  resetAgentPassword,
} from "@/app/(app)/admin/agents/actions";
import { ActionButton } from "@/components/ui/ActionButton";
import { Spinner } from "@/components/ui/Spinner";
import { AgentStatutBadge } from "@/components/admin/AgentStatutBadge";
import { GRADES } from "@/lib/constants";
import { UNITES, UNITE_LABELS } from "@/lib/permissions";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { btn, fieldClass, fieldCompactClass } from "@/lib/ui/styles";
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
      return [p.pseudo, p.grade, p.unite, UNITE_LABELS[p.unite] ?? ""]
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
          className={`${fieldClass} sm:max-w-xs`}
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-gtf-border">
        <table className="gtf-stack w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gtf-border bg-gtf-panel-alt font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
              <th className="px-4 py-3">Pseudo</th>
              <th className="px-4 py-3">Grade</th>
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
                  colSpan={canManageAgents ? 5 : 4}
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
  const run = useActionRunner();
  const [unite, setUnite] = useState(profile.unite);
  const [pending, startTransition] = useTransition();

  if (!editable) {
    return <span className="font-mono text-xs">{profile.unite}</span>;
  }

  function handleChange(next: string) {
    const previous = unite;
    setUnite(next as Profile["unite"]);

    const formData = new FormData();
    formData.set("id", profile.id);
    formData.set("unite", next);

    startTransition(async () => {
      const result = await run(() => updateAgentUnite(formData), {
        success: `Unité de ${profile.pseudo} : ${next}`,
      });
      // Échec (erreur affichée par le toast) : on rétablit l'ancienne valeur.
      if (result?.error) setUnite(previous);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={unite}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className={fieldCompactClass}
      >
        {UNITES.map((u) => (
          <option key={u} value={u} title={UNITE_LABELS[u]}>
            {u}
          </option>
        ))}
      </select>
      {pending && <Spinner className="h-3 w-3 text-gtf-blue-hover" />}
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
  const run = useActionRunner();
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
      const result = await run(() => updateAgent(formData), {
        success: "Agent mis à jour",
        inline: true,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
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
      const result = await run(() => resetAgentPassword(formData), {
        success: `Mot de passe de ${profile.pseudo} réinitialisé`,
        inline: true,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setNewPassword("");
      setResetting(false);
    });
  }

  const isActif = profile.statut === "actif";

  return (
    <tr className="border-b border-gtf-border last:border-0">
      <td data-label="Pseudo" className="px-4 py-3">
        {editing ? (
          <input
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            className={`w-full ${fieldCompactClass}`}
          />
        ) : (
          profile.pseudo
        )}
      </td>
      <td data-label="Grade" className="px-4 py-3">
        {editing ? (
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className={fieldCompactClass}
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
      <td data-label="Unité" className="px-4 py-3">
        <UniteCell profile={profile} editable={canManageUnite} />
      </td>
      <td data-label="Statut" className="px-4 py-3">
        <AgentStatutBadge statut={profile.statut} />
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
                className={`${fieldCompactClass} w-full sm:w-auto`}
              />
              <button
                onClick={handleResetPassword}
                disabled={pending}
                className={btn("primary", "sm")}
              >
                {pending && <Spinner className="h-3 w-3" />}
                Valider
              </button>
              <button
                onClick={() => {
                  setResetting(false);
                  setNewPassword("");
                  setError(null);
                }}
                className={btn("secondary", "sm")}
              >
                Annuler
              </button>
            </div>
          ) : (
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
                      setPseudo(profile.pseudo);
                      setGrade(profile.grade);
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
                  <button
                    onClick={() => setResetting(true)}
                    className={btn("secondary", "sm")}
                  >
                    Réinitialiser mdp
                  </button>
                  <ActionButton
                    action={toggleStatut}
                    fields={{ id: profile.id, statut: profile.statut }}
                    success={
                      isActif
                        ? `Compte de ${profile.pseudo} suspendu`
                        : `Compte de ${profile.pseudo} réactivé`
                    }
                    variant="warning"
                    size="sm"
                    disabled={isSelf}
                  >
                    {isActif ? "Suspendre" : "Réactiver"}
                  </ActionButton>
                  <ActionButton
                    action={deleteAgent}
                    fields={{ id: profile.id }}
                    confirm={`Supprimer définitivement le compte de "${profile.pseudo}" ? Cette action est irréversible.`}
                    success={`Compte de ${profile.pseudo} supprimé`}
                    variant="danger"
                    size="sm"
                    disabled={isSelf}
                  >
                    Supprimer
                  </ActionButton>
                </>
              )}
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="mt-1 text-right text-xs text-gtf-red sm:text-right"
            >
              {error}
            </p>
          )}
        </td>
      )}
    </tr>
  );
}
