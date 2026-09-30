import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDispatchSnapshot } from "./actions";
import { DispatchBoard } from "@/components/dispatch/DispatchBoard";
import { serverNowMs } from "@/lib/time";

export default async function DispatchPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const snapshot = await getDispatchSnapshot();

  return (
    <DispatchBoard
      initialSnapshot={snapshot}
      initialNow={serverNowMs()}
      currentUserId={user!.id}
      isAdmin={profile?.role === "admin"}
    />
  );
}
