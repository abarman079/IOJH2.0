import type { ReactNode } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getAuthCopy } from "@/features/auth/copy";
import styles from "./auth.module.css";
import { AuthControls } from "./auth-controls";

export function AuthShell({ locale, title, intro, children }: { locale: Locale; title: string; intro: string; children: ReactNode }) {
  const t = getAuthCopy(locale);
  return (
    <div className={styles.canvas}>
      <div className={styles.panel}>
        <div className={styles.toolbar}><Link href="/" className={styles.back}><ArrowLeft size={16} aria-hidden="true" />{t.back}</Link><AuthControls/></div>
        <div className={styles.formArea}>
          <div className={styles.headingRule}><span className={styles.emblem} aria-hidden="true">✳</span><span>{t.eyebrow}</span><span className={styles.rule}/></div>
          <p className={styles.kicker}>{t.accountLabel}</p>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.intro}>{intro}</p>
          {children}
        </div>
        <div className={styles.panelBottom}><span>IOJH / IDENTITY</span><span>01 — 02</span></div>
      </div>
      <aside className={styles.art} aria-label={t.asideTitle}>
        <div className={styles.artHeader}><span className={styles.artMark}>IOJH<span>.</span></span><span>RESEARCH / PEOPLE / KNOWLEDGE</span></div>
        <div className={styles.orbits} aria-hidden="true"><span/><span/><span/><i/><b/><em/></div>
        <div className={styles.artText}><p className={styles.artEyebrow}>{t.asideMark}</p><h2>{t.asideTitle}</h2><p>{t.asideBody}</p></div>
        <div className={styles.artFooter}><span>{t.asideFoot}</span><ArrowUpRight aria-hidden="true" size={20}/></div>
      </aside>
    </div>
  );
}
