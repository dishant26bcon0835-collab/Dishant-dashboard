import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Team sign-in — Vantage Inventory" },
      {
        name: "description",
        content:
          "Sign in to edit inventory levels and purchase orders on the Vantage operations board.",
      },
      { property: "og:title", content: "Team sign-in — Vantage Inventory" },
      {
        property: "og:description",
        content: "Only signed-in team members can edit stock and purchase orders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const inputCls =
  "w-full rounded-md bg-surface-raised px-3 py-2 font-mono text-[13px] text-foreground outline-none ring-1 ring-border focus:ring-amber/60";
const fieldLabel = "label-cond mb-1 block text-[10px] text-mist";

function AuthPage() {
  const navigate = useNavigate();
  const { isSignedIn, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isSignedIn) navigate({ to: "/", replace: true });
  }, [loading, isSignedIn, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name.trim() || email.split("@")[0] },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice("Check your email to confirm the account, then sign in.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5">
        <h1 className="font-cond text-[15px] uppercase tracking-[0.18em]">
          {mode === "signin" ? "Team sign-in" : "Create team account"}
        </h1>
        <p className="mt-1 text-[12px] text-mist">
          Anyone can view the board. Only signed-in team members can edit stock and orders.
        </p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          {mode === "signup" && (
            <div>
              <label className={fieldLabel} htmlFor="auth-name">
                Your name
              </label>
              <input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="Dishant S."
              />
            </div>
          )}
          <div>
            <label className={fieldLabel} htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={fieldLabel} htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>

          {error && <p className="text-[11px] text-rose">{error}</p>}
          {notice && <p className="text-[11px] text-teal">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-[11px] text-mist">
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setNotice(null);
            }}
            className="underline underline-offset-2"
          >
            {mode === "signin" ? "Create a team account" : "I already have an account"}
          </button>
          <Link to="/" className="underline underline-offset-2">
            Back to board
          </Link>
        </div>
      </div>
    </div>
  );
}
