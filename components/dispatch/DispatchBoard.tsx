"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type ReactNode,
} from "react";
import { GripVertical, Radio } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  assignAgentUnit,
  finService,
  getDispatchSnapshot,
  heartbeatDispatch,
  lacherDispatch,
  prendreDispatch,
  prendreService,
  setAgentStatut,
  setUnitCategorie,
} from "@/app/(app)/dispatch/actions";
import {
  AGENT_STATUTS,
  AGENT_STATUT_LABELS,
  CATEGORIES_PATROUILLE,
  CATEGORIE_PATROUILLE_LABELS,
  DISPATCH_TIMEOUT_MS,
  SELF_STATUTS,
  isDispatchExpired,
  type DispatchAgent,
  type DispatchSnapshot,
  type DispatchUnit,
} from "@/lib/supabase/dispatch-types";
import { Panel } from "@/components/ui/Panel";
import { Spinner } from "@/components/ui/Spinner";
import { useActionRunner } from "@/lib/ui/use-action-runner";
import { btn, fieldCompactClass } from "@/lib/ui/styles";
import { AgentStatutBadge, CategorieIcon } from "./DispatchBadges";

// Au plus un signal d'activité du dispatcheur par minute.
const HEARTBEAT_INTERVAL_MS = 60 * 1000;
// Rafraîchissement de l'horloge locale (expiration du rôle).
const CLOCK_TICK_MS = 15 * 1000;
const DRAG_MIME = "application/x-gtf-agent";
// Cible de dépôt « retour en attente de dispatch ».
const WAITING_DROP_ID = "__attente__";

type PanelView = "agents" | "unites";

export function DispatchBoard({
  initialSnapshot,
  initialNow,
  currentUserId,
  isAdmin,
}: {
  initialSnapshot: DispatchSnapshot;
  // Heure serveur au rendu de la page (évite Date.now() dans le rendu).
  initialNow: number;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const run = useActionRunner();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [now, setNow] = useState(initialNow);
  const [view, setView] = useState<PanelView>("unites");
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [pending, startTransition] = useTransition();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHeartbeat = useRef(0);

  const refresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    // Regroupe les rafales d'événements (ex. dépôt = update + heartbeat).
    refreshTimer.current = setTimeout(async () => {
      try {
        setSnapshot(await getDispatchSnapshot());
        setNow(Date.now());
      } catch {
        // Réseau coupé : on garde l'état affiché, le prochain événement
        // relancera la lecture.
      }
    }, 150);
  }, []);

  // Temps réel : tout changement sur les 3 tables relit l'état complet
  // (quelques dizaines de lignes au plus), ce qui couvre aussi les
  // suppressions dont Realtime ne transmet que la clé.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel("dispatch-board")
        .on("postgres_changes", { event: "*", schema: "public", table: "agent_status" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "dispatch_units" }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "dispatch_role" }, refresh)
        .subscribe((status) => {
          setLive(status === "SUBSCRIBED");
          // (Re)connexion : on rattrape ce qui a pu être manqué.
          if (status === "SUBSCRIBED") refresh();
        });
    })();

    return () => {
      cancelled = true;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  // Horloge locale : l'expiration du rôle de dispatcheur se vérifie côté
  // client par comparaison de timestamps.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const { agents, units, dispatcher } = snapshot;
  const dispatcherActive =
    dispatcher !== null && !isDispatchExpired(dispatcher.last_active_at, now);
  const isDispatcher =
    dispatcherActive && dispatcher?.agent_id === currentUserId;
  const canDispatch = isDispatcher || isAdmin;
  const me = agents.find((a) => a.agent_id === currentUserId) ?? null;

  // Activité du dispatcheur : tant qu'il interagit avec la page, le rôle
  // est renouvelé (au plus une fois par minute).
  useEffect(() => {
    if (!isDispatcher) return;
    function onActivity() {
      const t = Date.now();
      if (t - lastHeartbeat.current < HEARTBEAT_INTERVAL_MS) return;
      lastHeartbeat.current = t;
      heartbeatDispatch().catch(() => {});
    }
    const events = ["pointerdown", "keydown", "pointermove", "wheel"] as const;
    for (const e of events) window.addEventListener(e, onActivity, { passive: true });
    return () => {
      for (const e of events) window.removeEventListener(e, onActivity);
    };
  }, [isDispatcher]);

  function act(action: () => Promise<{ error?: string } | void>, success?: string) {
    startTransition(async () => {
      await run(action, { success });
      refresh();
    });
  }

  // --- glisser-déposer (dispatcheur actif / admin uniquement) ----------

  function onDragStart(event: DragEvent, agentId: string) {
    event.dataTransfer.setData(DRAG_MIME, agentId);
    event.dataTransfer.effectAllowed = "move";
    setView("unites");
  }

  function dropProps(targetId: string) {
    if (!canDispatch) return {};
    return {
      onDragOver: (event: DragEvent) => {
        if (!event.dataTransfer.types.includes(DRAG_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (dragOverId !== targetId) setDragOverId(targetId);
      },
      onDragLeave: (event: DragEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragOverId(null);
        }
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        setDragOverId(null);
        const agentId = event.dataTransfer.getData(DRAG_MIME);
        const agent = agents.find((a) => a.agent_id === agentId);
        if (!agent) return;
        const uniteId = targetId === WAITING_DROP_ID ? null : targetId;
        if (agent.unite_id === uniteId) return;
        act(() => assignAgentUnit(agentId, uniteId));
      },
    };
  }

  const unitName = (id: string | null) =>
    units.find((u) => u.id === id)?.nom ?? null;
  const waiting = agents.filter((a) => a.statut === "en_attente_dispatch");
  const sortedAgents = [
    ...waiting,
    ...agents.filter((a) => a.statut !== "en_attente_dispatch"),
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Dispatch
        </h1>
        <span
          className={`inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider ${
            live ? "text-gtf-green" : "text-gtf-text-muted"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              live ? "animate-pulse bg-gtf-green" : "bg-gtf-text-muted"
            }`}
          />
          {live ? "En direct" : "Connexion…"}
          {pending && <Spinner className="h-3 w-3" />}
        </span>
      </div>

      {/* --- Barre de contrôle : mon service + rôle de dispatcheur --- */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title="Mon service">
          {me ? (
            <div className="flex flex-wrap items-center gap-3">
              <AgentStatutBadge statut={me.statut} />
              {me.unite_id && (
                <span className="font-mono text-xs text-gtf-text-muted">
                  Unité {unitName(me.unite_id)}
                </span>
              )}
              {me.statut === "en_attente_dispatch" ? (
                <span className="text-xs text-gtf-text-muted">
                  En attente d&apos;affectation par le dispatcheur.
                </span>
              ) : (
                <select
                  aria-label="Mon statut"
                  value={me.statut}
                  disabled={pending}
                  onChange={(e) =>
                    act(() => setAgentStatut(currentUserId, e.target.value))
                  }
                  className={fieldCompactClass}
                >
                  {(canDispatch ? AGENT_STATUTS : SELF_STATUTS).map((s) => (
                    <option key={s} value={s}>
                      {AGENT_STATUT_LABELS[s]}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  act(() => finService(), "Fin de service enregistrée")
                }
                className={btn("secondary", "sm", "ml-auto")}
              >
                Fin de service
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-gtf-text-muted">
                Vous n&apos;êtes pas en service.
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => act(() => prendreService(), "Service pris")}
                className={btn("primary", "md")}
              >
                Prendre son service
              </button>
            </div>
          )}
        </Panel>

        <Panel title="Dispatcheur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Radio
                className={`h-4 w-4 ${dispatcherActive ? "text-gtf-blue-hover" : "text-gtf-text-muted"}`}
                aria-hidden="true"
              />
              {dispatcherActive && dispatcher ? (
                <span className="text-sm">
                  {isDispatcher ? "Vous êtes le dispatcheur" : dispatcher.pseudo}
                  <span className="ml-2 font-mono text-xs text-gtf-text-muted">
                    depuis{" "}
                    {new Date(dispatcher.taken_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              ) : (
                <span className="text-sm text-gtf-text-muted">
                  Aucun dispatcheur
                  {dispatcher &&
                    ` (${dispatcher.pseudo} inactif depuis plus de ${DISPATCH_TIMEOUT_MS / 60000} min)`}
                </span>
              )}
            </div>
            {isDispatcher || (isAdmin && dispatcherActive) ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => act(() => lacherDispatch(), "Dispatch libéré")}
                className={btn("warning", "sm")}
              >
                {isDispatcher ? "Lâcher le dispatch" : "Libérer le dispatch"}
              </button>
            ) : (
              !dispatcherActive && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => act(() => prendreDispatch(), "Vous êtes dispatcheur")}
                  className={btn("info", "sm")}
                >
                  Prendre le dispatch
                </button>
              )
            )}
          </div>
          {canDispatch && (
            <p className="mt-2 font-mono text-[11px] text-gtf-text-muted">
              Glissez un agent (<GripVertical className="inline h-3 w-3" />) sur
              une unité pour l&apos;affecter.
              {isDispatcher &&
                ` Rôle libéré automatiquement après ${DISPATCH_TIMEOUT_MS / 60000} min d'inactivité.`}
            </p>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* --- Zone principale : tous les agents en service --- */}
        <section>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-gtf-text-muted">
            Agents en service — {agents.length}
          </h2>
          <div className="mt-3 overflow-x-auto rounded-md border border-gtf-border bg-gtf-panel">
            <table className="gtf-stack w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gtf-border bg-gtf-panel-alt font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Unité</th>
                  <th className="px-4 py-3">Statut</th>
                  {canDispatch && (
                    <th className="px-4 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedAgents.map((agent) => (
                  <tr
                    key={agent.agent_id}
                    draggable={canDispatch}
                    onDragStart={(e) => onDragStart(e, agent.agent_id)}
                    className={`border-b border-gtf-border last:border-0 ${
                      canDispatch ? "cursor-grab active:cursor-grabbing" : ""
                    } ${agent.agent_id === currentUserId ? "bg-gtf-blue/5" : ""}`}
                  >
                    <td data-label="Agent" className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        {canDispatch && (
                          <GripVertical
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 text-gtf-text-muted"
                          />
                        )}
                        {agent.pseudo}
                      </span>
                    </td>
                    <td
                      data-label="Grade"
                      className="px-4 py-3 font-mono text-xs text-gtf-text-muted"
                    >
                      {agent.grade || "—"}
                    </td>
                    <td data-label="Unité" className="px-4 py-3">
                      {canDispatch ? (
                        // Alternative au glisser-déposer (écrans tactiles).
                        <select
                          aria-label={`Unité de ${agent.pseudo}`}
                          value={agent.unite_id ?? ""}
                          disabled={pending}
                          onChange={(e) =>
                            act(() =>
                              assignAgentUnit(agent.agent_id, e.target.value || null),
                            )
                          }
                          className={fieldCompactClass}
                        >
                          <option value="">— En attente —</option>
                          {units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.nom}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-mono text-xs">
                          {unitName(agent.unite_id) ?? "—"}
                        </span>
                      )}
                    </td>
                    <td data-label="Statut" className="px-4 py-3">
                      {canDispatch ? (
                        <StatutSelect
                          agent={agent}
                          disabled={pending}
                          onChange={(statut) =>
                            act(() => setAgentStatut(agent.agent_id, statut))
                          }
                        />
                      ) : (
                        <AgentStatutBadge statut={agent.statut} />
                      )}
                    </td>
                    {canDispatch && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            act(
                              () => finService(agent.agent_id),
                              `${agent.pseudo} retiré du service`,
                            )
                          }
                          className={btn("danger", "sm")}
                        >
                          Retirer
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {agents.length === 0 && (
                  <tr>
                    <td
                      colSpan={canDispatch ? 5 : 4}
                      className="px-4 py-6 text-center text-gtf-text-muted"
                    >
                      Aucun agent en service.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* --- Panneau de droite : Agents en service / Unités --- */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div
            role="tablist"
            aria-label="Vue du panneau"
            className="grid grid-cols-2 gap-1 rounded-md border border-gtf-border bg-gtf-panel p-1"
          >
            {(
              [
                ["agents", "Agents en service"],
                ["unites", "Unités"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                onClick={() => setView(value)}
                className={`rounded px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                  view === value
                    ? "bg-gtf-blue text-gtf-text"
                    : "text-gtf-text-muted hover:text-gtf-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex max-h-[calc(100vh-8rem)] flex-col gap-3 overflow-y-auto pr-1">
            {view === "agents" ? (
              <ul className="rounded-md border border-gtf-border bg-gtf-panel">
                {sortedAgents.map((agent) => (
                  <li
                    key={agent.agent_id}
                    className="flex items-center justify-between gap-3 border-b border-gtf-border px-3 py-2 last:border-0"
                  >
                    <span className="min-w-0 truncate text-sm">
                      {agent.pseudo}
                      {agent.unite_id && (
                        <span className="ml-2 font-mono text-xs text-gtf-text-muted">
                          {unitName(agent.unite_id)}
                        </span>
                      )}
                    </span>
                    <AgentStatutBadge statut={agent.statut} />
                  </li>
                ))}
                {agents.length === 0 && (
                  <li className="px-3 py-4 text-center text-sm text-gtf-text-muted">
                    Aucun agent en service.
                  </li>
                )}
              </ul>
            ) : (
              <>
                <DropBox
                  highlighted={dragOverId === WAITING_DROP_ID}
                  {...dropProps(WAITING_DROP_ID)}
                >
                  <p className="font-display text-sm font-semibold uppercase tracking-wide text-gtf-text-muted">
                    En attente de dispatch — {waiting.length}
                  </p>
                  <AgentChips
                    agents={waiting}
                    draggable={canDispatch}
                    onDragStart={onDragStart}
                    empty="Personne en attente."
                  />
                </DropBox>

                {units.map((unit) => (
                  <UnitCard
                    key={unit.id}
                    unit={unit}
                    agents={agents.filter((a) => a.unite_id === unit.id)}
                    canDrag={canDispatch}
                    canEditCategorie={canDispatch || me?.unite_id === unit.id}
                    highlighted={dragOverId === unit.id}
                    disabled={pending}
                    dropProps={dropProps(unit.id)}
                    onDragStart={onDragStart}
                    onCategorie={(categorie) =>
                      act(() => setUnitCategorie(unit.id, categorie))
                    }
                  />
                ))}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatutSelect({
  agent,
  disabled,
  onChange,
}: {
  agent: DispatchAgent;
  disabled: boolean;
  onChange: (statut: string) => void;
}) {
  return (
    <select
      aria-label={`Statut de ${agent.pseudo}`}
      value={agent.statut}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={fieldCompactClass}
    >
      {AGENT_STATUTS.map((s) => (
        <option key={s} value={s}>
          {AGENT_STATUT_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

function DropBox({
  highlighted,
  children,
  ...handlers
}: {
  highlighted: boolean;
  children: ReactNode;
  onDragOver?: (event: DragEvent) => void;
  onDragLeave?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
}) {
  return (
    <div
      {...handlers}
      className={`rounded-md border bg-gtf-panel p-3 transition-colors ${
        highlighted
          ? "border-gtf-blue bg-gtf-blue/10"
          : "border-gtf-border"
      }`}
    >
      {children}
    </div>
  );
}

function AgentChips({
  agents,
  draggable,
  onDragStart,
  empty,
}: {
  agents: DispatchAgent[];
  draggable: boolean;
  onDragStart: (event: DragEvent, agentId: string) => void;
  empty: string;
}) {
  if (agents.length === 0) {
    return <p className="mt-1 text-xs text-gtf-text-muted">{empty}</p>;
  }
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {agents.map((agent) => (
        <li
          key={agent.agent_id}
          draggable={draggable}
          onDragStart={(e) => onDragStart(e, agent.agent_id)}
          className={`flex items-center justify-between gap-2 rounded border border-gtf-border bg-gtf-panel-alt px-2 py-1.5 ${
            draggable ? "cursor-grab active:cursor-grabbing" : ""
          }`}
        >
          <span className="flex min-w-0 items-center gap-1.5 text-sm">
            {draggable && (
              <GripVertical
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-gtf-text-muted"
              />
            )}
            <span className="truncate">{agent.pseudo}</span>
          </span>
          <AgentStatutBadge statut={agent.statut} />
        </li>
      ))}
    </ul>
  );
}

function UnitCard({
  unit,
  agents,
  canDrag,
  canEditCategorie,
  highlighted,
  disabled,
  dropProps,
  onDragStart,
  onCategorie,
}: {
  unit: DispatchUnit;
  agents: DispatchAgent[];
  canDrag: boolean;
  canEditCategorie: boolean;
  highlighted: boolean;
  disabled: boolean;
  dropProps: {
    onDragOver?: (event: DragEvent) => void;
    onDragLeave?: (event: DragEvent) => void;
    onDrop?: (event: DragEvent) => void;
  };
  onDragStart: (event: DragEvent, agentId: string) => void;
  onCategorie: (categorie: string) => void;
}) {
  return (
    <DropBox highlighted={highlighted} {...dropProps}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide text-gtf-text">
          <CategorieIcon
            categorie={unit.categorie_patrouille}
            className="h-4 w-4 text-gtf-blue-hover"
          />
          {unit.nom}
          <span className="font-mono text-xs font-normal text-gtf-text-muted">
            {agents.length}
          </span>
        </p>
        {canEditCategorie ? (
          <select
            aria-label={`Catégorie de patrouille de l'unité ${unit.nom}`}
            value={unit.categorie_patrouille ?? ""}
            disabled={disabled}
            onChange={(e) => onCategorie(e.target.value)}
            className={fieldCompactClass}
          >
            <option value="">— Catégorie —</option>
            {CATEGORIES_PATROUILLE.map((c) => (
              <option key={c} value={c}>
                {CATEGORIE_PATROUILLE_LABELS[c]}
              </option>
            ))}
          </select>
        ) : (
          <span className="font-mono text-xs uppercase tracking-wider text-gtf-text-muted">
            {unit.categorie_patrouille
              ? CATEGORIE_PATROUILLE_LABELS[unit.categorie_patrouille]
              : "—"}
          </span>
        )}
      </div>
      {agents.length > 0 && (
        <AgentChips
          agents={agents}
          draggable={canDrag}
          onDragStart={onDragStart}
          empty=""
        />
      )}
    </DropBox>
  );
}
