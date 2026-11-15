"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import Image from "next/image";

type Factor = { id: string; status?: string };
type Enrollment = { id: string; qr: string; secret: string };
export function AdminMfa() {
  const [client] = useState(() => createBrowserSupabaseClient());
  const [factor, setFactor] = useState<Factor | null>(null),
    [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function check() {
      if (!client) {
        if (active) {
          setError("Authentication configuration is missing.");
          setLoading(false);
        }
        return;
      }
      try {
        const { data: assurance, error: aError } =
          await client.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aError) throw aError;
        if (assurance.currentLevel === "aal2") {
          window.location.replace("/admin");
          return;
        }
        const { data, error: fError } = await client.auth.mfa.listFactors();
        if (fError) throw fError;
        if (active)
          setFactor(
            (data.totp ?? []).find((f) => f.status === "verified") ?? null,
          );
      } catch {
        if (active) setError("Unable to load MFA. Sign in again or retry.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void check();
    return () => {
      active = false;
    };
  }, [client]);
  async function enroll() {
    if (!client || busy) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: enrollError } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "IOJH Admin Authenticator",
      });
      if (enrollError || !data?.totp)
        throw enrollError ?? new Error("No enrollment");
      setEnrollment({
        id: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch {
      setError(
        "Enrollment could not be started. Check your existing factors or retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget),
      code = String(form.get("code") ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code from your authenticator.");
      setBusy(false);
      return;
    }
    const factorId = enrollment?.id ?? factor?.id;
    if (!factorId) {
      setError("No valid factor selected. Reload this page.");
      setBusy(false);
      return;
    }
    try {
      const { data: challenge, error: challengeError } =
        await client.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge)
        throw challengeError ?? new Error("No challenge");
      const { error: verifyError } = await client.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;
      // Do not trust the client redirect as proof of admin access. /admin rechecks
      // fresh identity, membership, AAL2 and database-enforced AAL.
      window.location.replace("/admin");
    } catch {
      setError(
        "Verification failed or the code expired. Check your authenticator clock and retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">Checking multi-factor enrollment…</p>;
  if (!client)
    return (
      <p role="alert" className="admin-error">
        {error || "Authentication unavailable."}
      </p>
    );
  return (
    <div className="admin-mfa-panel">
      {!factor && !enrollment && (
        <>
          <p>
            No verified authenticator is enrolled for this identity. Enroll a
            TOTP authenticator to continue.
          </p>
          <button
            type="button"
            className="admin-primary"
            disabled={busy}
            onClick={() => void enroll()}
          >
            Set up an authenticator
          </button>
        </>
      )}
      {enrollment && (
        <div className="admin-enrollment">
          <p>
            Scan this QR code in an authenticator app. Keep the setup secret
            private; never send it to support.
          </p>
          {/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/.test(
            enrollment.qr,
          ) && (
            <Image
              unoptimized
              alt="Authenticator enrollment QR code"
              src={enrollment.qr}
              width={208}
              height={208}
            />
          )}
          <details>
            <summary>Manual setup code</summary>
            <code className="admin-secret">{enrollment.secret}</code>
          </details>
        </div>
      )}
      {(factor || enrollment) && (
        <form className="admin-form" onSubmit={verify}>
          <label htmlFor="admin-totp">Six-digit authenticator code</label>
          <input
            id="admin-totp"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            minLength={6}
            required
          />
          <button
            type="submit"
            className="admin-primary"
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? "Verifying…" : "Verify and enter workspace"}
          </button>
        </form>
      )}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <Link className="admin-text-link" href="/admin/sign-in">
        Return to sign-in
      </Link>
      <p className="admin-fine">
        Lost your authenticator? Contact the designated IOJH account owner
        through the offline recovery procedure. Email recovery alone does not
        bypass MFA.
      </p>
    </div>
  );
}
