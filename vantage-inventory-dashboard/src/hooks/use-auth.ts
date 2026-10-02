import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function displayNameOf(user: User | null | undefined) {
  if (!user) return null;
  const meta = user.user_metadata as { display_name?: string; full_name?: string } | undefined;
  return meta?.display_name || meta?.full_name || user.email?.split("@")[0] || "Team member";
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: got }) => {
      setSession(got.session);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  return { session, user, loading, isSignedIn: !!user, name: displayNameOf(user) };
}
