"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function AdminSignIn() {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    const client = createBrowserSupabaseClient();
    if (!client) {
      setError("Authentication is not configured.");
      setBusy(false);
      return;
    }
    const form = new FormData(e.currentTarget);
    try {
      const { error: loginError } = await client.auth.signInWithPassword({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      if (loginError) {
        setError("Could not sign in. Check your account and try again.");
        return;
      }
      router.push("/admin/mfa");
      router.refresh();
    } catch {
      setError("Sign-in service is temporarily unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-form" onSubmit={submit}>
      <label htmlFor="admin-email">Email address</label>
      <input
        id="admin-email"
        type="email"
        name="email"
        autoComplete="username"
        required
        maxLength={254}
      />
      <label htmlFor="admin-password">Password</label>
      <input
        id="admin-password"
        type="password"
        name="password"
        autoComplete="current-password"
        required
      />
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      <button
        className="admin-primary"
        disabled={busy}
        aria-busy={busy}
        type="submit"
      >
        {busy ? "Checking identity…" : "Continue securely"}
      </button>
      <Link className="admin-text-link" href="/en/forgot-password">
        Reset password
      </Link>
    </form>
  );
}
