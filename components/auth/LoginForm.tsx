"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { pseudoToEmail } from "@/lib/auth/pseudo";

export function LoginForm() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: pseudoToEmail(pseudo),
      password,
    });

    setLoading(false);

    if (signInError) {
      if (signInError.message.toLowerCase().includes("banned")) {
        setError("Compte suspendu, contactez un administrateur.");
      } else {
        setError("Identifiant ou mot de passe incorrect.");
      }
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative z-10 flex w-64 flex-col items-center gap-6"
    >
      <input
        type="text"
        name="identifiant"
        aria-label="Identifiant"
        placeholder="Identifiant"
        autoComplete="username"
        required
        value={pseudo}
        onChange={(e) => setPseudo(e.target.value)}
        className="w-full border-0 border-b border-[#3A362C]/30 bg-transparent px-1 py-2 text-center text-sm text-[#3A362C] placeholder:text-[#3A362C]/40 focus:border-[#3A362C] focus:outline-none"
      />

      <input
        type="password"
        name="password"
        aria-label="Mot de passe"
        placeholder="Mot de passe"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full border-0 border-b border-[#3A362C]/30 bg-transparent px-1 py-2 text-center text-sm text-[#3A362C] placeholder:text-[#3A362C]/40 focus:border-[#3A362C] focus:outline-none"
      />

      <button
        type="submit"
        disabled={loading}
        className="mt-2 bg-[#3A362C] px-6 py-2 text-xs font-medium uppercase tracking-[0.2em] text-[#F4F0E6] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "..." : "Connexion"}
      </button>

      {error && (
        <p role="alert" className="text-center text-xs text-[#B23A32]">
          {error}
        </p>
      )}
    </form>
  );
}
