"use client";

import { useTheme } from "@wrksz/themes/client";
import { useLocale } from "next-intl";
import { Sun, Moon } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import styles from "./auth.module.css";

/** Both icons always render. CSS data-theme handles visibility before hydration. */
export function AuthControls() {
  const { resolvedTheme, setTheme } = useTheme();
  const locale = useLocale();
  const pathname = usePathname();
  return <div className={styles.controls}>
    <div className={styles.localeSwitch} aria-label={locale === "bn" ? "ভাষা পরিবর্তন" : "Change language"}>
      <Link href={pathname} locale="en" aria-current={locale === "en" ? "page" : undefined}>EN</Link><span aria-hidden="true">/</span><Link href={pathname} locale="bn" aria-current={locale === "bn" ? "page" : undefined}>বাংলা</Link>
    </div>
    <button type="button" className={styles.themeButton} aria-label={locale === "bn" ? "রঙের থিম পরিবর্তন করুন" : "Switch color theme"} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
      <Sun size={18} className={styles.themeSun} aria-hidden="true"/><Moon size={18} className={styles.themeMoon} aria-hidden="true"/>
    </button>
  </div>;
}
