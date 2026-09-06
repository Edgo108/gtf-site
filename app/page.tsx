import { GlitchLogo } from "@/components/auth/GlitchLogo";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F0E6]">
      <GlitchLogo />
      <LoginForm />
    </main>
  );
}
