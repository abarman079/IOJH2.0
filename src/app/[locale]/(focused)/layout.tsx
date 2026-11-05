import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/** Focused shell: identity and checkout share minimal chrome, never public marketing. */
export default function FocusedLayout({ children }: { children: ReactNode }) {
  return <div className="focused-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="focused-shell__header">
      <Link href="/" className="wordmark">IOJH<span className="wordmark__dot">.</span></Link>
      <span>International Online Journal Hub</span>
    </header>
    <main id="main-content" tabIndex={-1}>{children}</main>
    <footer className="focused-shell__footer">IOJH 2.0 · Book purchases and enrollment are not enabled in this development stage.</footer>
  </div>;
}
