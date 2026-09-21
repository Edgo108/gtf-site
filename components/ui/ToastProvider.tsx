"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Notifications toast : une seule implémentation pour tout le site.
//   const toast = useToast();
//   toast.success("Enquête créée");   toast.error("Connexion perdue…");
// Le provider vit dans le layout racine : il survit aux navigations, donc
// un toast déclenché juste avant une redirection s'affiche sur la page
// d'arrivée.

type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const MAX_TOASTS = 4;
const DURATIONS: Record<ToastType, number> = {
  success: 3500,
  info: 4000,
  // Une erreur se lit moins vite qu'une confirmation : elle reste plus
  // longtemps à l'écran.
  error: 7000,
};

const STYLES: Record<ToastType, { border: string; icon: string; label: string }> =
  {
    success: {
      border: "border-gtf-green",
      icon: "text-gtf-green",
      label: "Succès",
    },
    error: { border: "border-gtf-red", icon: "text-gtf-red", label: "Erreur" },
    info: {
      border: "border-gtf-blue",
      icon: "text-gtf-blue-hover",
      label: "Information",
    },
  };

function ToastIcon({ type }: { type: ToastType }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (type === "success") {
    return (
      <svg {...common}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.01" />
    </svg>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;

      setToasts((current) => {
        // Même message déjà affiché (ex: erreur répétée) : on ne l'empile
        // pas une seconde fois, on remplace l'ancien par le nouveau pour
        // relancer sa durée d'affichage.
        const duplicate = current.find(
          (t) => t.type === type && t.message === message,
        );
        if (duplicate) {
          const timer = timers.current.get(duplicate.id);
          if (timer) clearTimeout(timer);
          timers.current.delete(duplicate.id);
        }
        const kept = current.filter((t) => t !== duplicate);
        return [...kept, { id, type, message }].slice(-MAX_TOASTS);
      });

      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATIONS[type]),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[2000] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end"
      >
        {toasts.map((t) => {
          const style = STYLES[t.type];
          return (
            <div
              key={t.id}
              role={t.type === "error" ? "alert" : "status"}
              className={`gtf-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-l-4 bg-gtf-panel p-3 shadow-lg ${style.border}`}
            >
              <span className={`mt-0.5 shrink-0 ${style.icon}`}>
                <ToastIcon type={t.type} />
              </span>
              <p className="min-w-0 flex-1 break-words text-sm text-gtf-text">
                <span className="sr-only">{style.label} : </span>
                {t.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Fermer la notification"
                className="-mr-1 -mt-1 shrink-0 rounded px-2 py-1 text-lg leading-none text-gtf-text-muted transition-colors hover:text-gtf-text"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast doit être utilisé dans un <ToastProvider>.");
  }
  return context;
}
