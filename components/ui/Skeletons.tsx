import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/Spinner";

// Squelettes de chargement (loading.tsx) : mêmes gabarits que les vraies
// pages pour éviter les sauts de mise en page à l'arrivée des données.

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-gtf-panel-alt ${className}`}
    />
  );
}

function SkeletonFrame({
  children,
  label = "Chargement en cours…",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      {children}
    </div>
  );
}

function PageTitleSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-9 w-40" />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-md border border-gtf-border bg-gtf-panel p-4">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="mt-3 h-3 w-1/2" />
      <Skeleton className="mt-2 h-3 w-2/3" />
      <Skeleton className="mt-4 h-5 w-20" />
    </div>
  );
}

// Liste de fiches (enquêtes, B.D.D, mandats, annonces…).
export function ListPageSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <SkeletonFrame>
      <div className="mx-auto max-w-6xl">
        <PageTitleSkeleton />
        <Skeleton className="mt-4 h-10 w-full" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: cards }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </SkeletonFrame>
  );
}

// Page de détail / formulaire.
export function DetailPageSkeleton() {
  return (
    <SkeletonFrame>
      <div className="mx-auto max-w-3xl">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-3 h-5 w-24" />
        <div className="mt-6 flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    </SkeletonFrame>
  );
}

export function DashboardSkeleton() {
  return (
    <SkeletonFrame>
      <div className="mx-auto max-w-5xl">
        <Skeleton className="h-8 w-80 max-w-full" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:max-w-md">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="rounded-md border border-gtf-border bg-gtf-panel p-4"
            >
              <Skeleton className="h-4 w-48" />
              <div className="mt-4 flex flex-col gap-3">
                {[0, 1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-9 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-md border border-gtf-border bg-gtf-panel p-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-20 w-full" />
        </div>
      </div>
    </SkeletonFrame>
  );
}

// Tableau (gestion des agents, corbeilles).
export function TablePageSkeleton() {
  return (
    <SkeletonFrame>
      <div className="mx-auto max-w-5xl">
        <PageTitleSkeleton />
        <div className="mt-6 flex flex-col gap-2 rounded-md border border-gtf-border bg-gtf-panel p-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </SkeletonFrame>
  );
}

export function MapPageSkeleton() {
  return (
    <SkeletonFrame label="Chargement de la carte…">
      <div className="mx-auto max-w-6xl">
        <Skeleton className="h-8 w-56" />
        <div className="mt-4 flex h-[75dvh] min-h-[28rem] flex-col items-center justify-center gap-3 rounded-md border border-gtf-border bg-gtf-panel text-sm text-gtf-text-muted">
          <Spinner className="h-6 w-6 text-gtf-blue-hover" />
          Chargement de la carte…
        </div>
      </div>
    </SkeletonFrame>
  );
}
