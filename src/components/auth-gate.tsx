"use client";

import { motion } from "framer-motion";
import { ArrowRight, Gauge, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { createClient } from "@/lib/supabase/client";

type Client = NonNullable<ReturnType<typeof createClient>>;
type AuthMode = "sign-in" | "register" | "reset";

export default function AuthGate({ client }: { client: Client }) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("authError") === "confirmation" ? "That confirmation link is invalid or expired. Request a new confirmation email and try again." : "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("authError")) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (mode === "register") {
        const { data, error: authError } = await client.auth.signUp({ email, password, options: { data: { display_name: displayName.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback?next=/` } });
        if (authError) throw authError;
        if (!data.session) setMessage("Check your inbox to confirm your email, then sign in.");
      } else if (mode === "reset") {
        const { error: authError } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/` });
        if (authError) throw authError;
        setMessage("If an account exists for that email, a reset link is on its way.");
      } else {
        const { error: authError } = await client.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Unable to complete that request.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "register" ? "Make it yours." : mode === "reset" ? "Back in the driver's seat." : "Welcome back.";

  return <main className="auth-screen"><div className="auth-art"><span className="auth-art-grid" /><span className="auth-art-glow" /><div className="auth-brand"><span className="brand-mark"><Gauge size={21} /></span><span className="brand-type">DIECAST<span>VAULT</span></span></div><div className="auth-art-copy"><span className="eyebrow eyebrow-red"><span className="eyebrow-rule" /> A HOME FOR YOUR COLLECTION</span><h1>Every casting<br />has a <em>story.</em></h1><p>Keep the good ones close.</p><div className="auth-car-art"><div className="auth-car-roof" /><div className="auth-car-window" /><div className="auth-car-body" /><div className="auth-car-wheel left" /><div className="auth-car-wheel right" /><div className="auth-car-line" /></div><div className="auth-art-footer"><span>PRIVATE BY DESIGN</span><span><ShieldCheck size={14} /> YOUR COLLECTION, YOURS</span></div></div></div>
    <motion.section className="auth-panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}><div className="auth-form-wrap"><span className="eyebrow">COLLECTOR ACCESS</span><h2>{title}</h2><p>{mode === "register" ? "Start a private vault for your diecast collection." : mode === "reset" ? "We’ll send a reset link to your email." : "Sign in to pick up where you left off."}</p><form onSubmit={submit} className="auth-form">{mode === "register" && <label><span>Display name</span><div><Gauge size={16} /><input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="How collectors know you" required maxLength={60} /></div></label>}<label><span>Email address</span><div><Mail size={16} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></div></label>{mode !== "reset" && <label><span>Password</span><div><LockKeyhole size={16} /><input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} required /></div></label>}{error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-message" role="status">{message}</p>}<button className="button button-primary auth-submit" disabled={busy}>{busy ? "Please wait..." : mode === "register" ? "Create your vault" : mode === "reset" ? "Send reset link" : "Sign in"}<ArrowRight size={16} /></button></form><div className="auth-switches">{mode === "sign-in" && <button onClick={() => { setMode("reset"); setError(""); setMessage(""); }}>Forgot password?</button>}{mode === "reset" && <button onClick={() => { setMode("sign-in"); setError(""); setMessage(""); }}>Back to sign in</button>}<span>{mode === "register" ? "Already have a vault?" : "New to the vault?"} <button onClick={() => { setMode(mode === "register" ? "sign-in" : "register"); setError(""); setMessage(""); }}>{mode === "register" ? "Sign in" : "Create account"}</button></span></div><div className="auth-security"><ShieldCheck size={15} /><span>Your collection is private and protected by database-level access controls.</span></div></div></motion.section></main>;
}