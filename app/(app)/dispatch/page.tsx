import { createClient } from "@/lib/supabase/server";
import { getDispatchSnapshot } from "./actions";
import { DispatchBoard } from "@/components/dispatch/DispatchBoard";
import { serverNowMs } from "@/lib/time";

export default async function DispatchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
