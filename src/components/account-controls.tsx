import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function AccountControls() {
  const { isSignedIn, name } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!isSignedIn) {
    return (
      <Link
        to="/auth"
        className="rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-medium text-primary-foreground"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden font-mono text-[11px] text-mist sm:inline">{name}</span>
      <button
        aria-label="Sign out"
        onClick={async () => {
          await queryClient.cancelQueries();
          queryClient.clear();
          await supabase.auth.signOut();
          navigate({ to: "/auth", replace: true });
        }}
        className="grid size-9 place-items-center rounded-md text-mist ring-1 ring-border transition-colors hover:bg-secondary"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
