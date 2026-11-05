"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, ArrowRight, LockKeyhole } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getAuthCopy } from "@/features/auth/copy";
import { changePasswordAction, requestRecoveryAction, signInAction, signUpAction } from "@/features/auth/actions";
import type { AuthErrorCode, AuthSuccessCode, AuthState } from "@/features/auth/actions";
const initialAuthState: AuthState = { status: "idle" };
import styles from "./auth.module.css";

type Mode = "sign-in" | "sign-up" | "forgot" | "reset";
const actions = { "sign-in": signInAction, "sign-up": signUpAction, forgot: requestRecoveryAction, reset: changePasswordAction };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className={styles.submit} type="submit" disabled={pending} aria-busy={pending}>{label}<ArrowRight size={19} aria-hidden="true" /></button>;
}

export function AuthForm({ locale, mode, next = "" }: { locale: Locale; mode: Mode; next?: string }) {
  const t = getAuthCopy(locale);
  const [state, formAction] = useActionState(actions[mode], initialAuthState);
  const [showPassword, setShowPassword] = useState(false);
  const needsEmail = mode !== "reset";
  const needsPassword = mode !== "forgot";
  const needsConfirm = mode === "sign-up" || mode === "reset";
  const buttonLabel = { "sign-in": t.signIn, "sign-up": t.signUp, forgot: t.recover, reset: t.update }[mode];
  const statusMessage = state.status === "error" && state.code ? t.errors[state.code as AuthErrorCode] :
    state.status === "success" && state.code ? t.success[state.code as AuthSuccessCode] : null;
  const passwordType = showPassword ? "text" : "password";
  return <div className={styles.formWrap}>
    <form action={formAction} className={styles.form} noValidate={false}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      {needsEmail && <div className={styles.field}><label htmlFor={`auth-${mode}-email`}>{t.email}</label><input id={`auth-${mode}-email`} name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} required placeholder="name@example.com" /></div>}
      {needsPassword && <div className={styles.field}>
        <label htmlFor={`auth-${mode}-password`}>{t.password}</label>
        <div className={styles.passwordField}><input id={`auth-${mode}-password`} name="password" type={passwordType} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={mode === "sign-in" ? 1 : 10} maxLength={128} required />
          <button type="button" className={styles.reveal} aria-label={showPassword ? t.hide : t.show} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
        </div>
        {mode !== "sign-in" && <span className={styles.hint}>{t.passwordHint}</span>}
      </div>}
      {needsConfirm && <div className={styles.field}><label htmlFor={`auth-${mode}-confirm`}>{t.confirm}</label><input id={`auth-${mode}-confirm`} name="confirmPassword" type={passwordType} autoComplete="new-password" minLength={10} maxLength={128} required /></div>}
      {mode === "sign-in" && <Link className={styles.forgot} href="/forgot-password">{t.forgotLink}</Link>}
      {statusMessage && <p role={state.status === "error" ? "alert" : "status"} className={`${styles.feedback} ${state.status === "error" ? styles.error : styles.success}`}>{statusMessage}</p>}
      {state.status !== "success" && <Submit label={buttonLabel} />}
    </form>
    <div className={styles.secondary}>
      {mode === "sign-in" && <Link href="/sign-up">{t.signUpLink} <ArrowRight aria-hidden="true" size={16}/></Link>}
      {mode === "sign-up" && <Link href="/sign-in">{t.signInLink} <ArrowRight aria-hidden="true" size={16}/></Link>}
      {(mode === "forgot" || mode === "reset") && <Link href="/sign-in">{t.verifyBack} <ArrowRight aria-hidden="true" size={16}/></Link>}
    </div>
    <p className={styles.privacy}><LockKeyhole size={14} aria-hidden="true" />{t.privacy}</p>
  </div>;
}
