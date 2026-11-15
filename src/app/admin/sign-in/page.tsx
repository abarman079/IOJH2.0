import Link from "next/link";
import type { Metadata } from "next";
import { AdminSignIn } from "@/features/admin/ui/admin-sign-in";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Administrator sign-in — IOJH",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main id="main-content" className="admin-auth-layout">
      <section className="admin-auth-panel">
        <Link href="/en" className="admin-wordmark">
          IOJH<span>.</span>
        </Link>
        <p className="admin-eyebrow">ADMINISTRATIVE IDENTITY</p>
        <h1>Secure administrator sign-in.</h1>
        <p>
          Use your verified IOJH website account. Membership and multi-factor
          assurance are checked separately on the server.
        </p>
        <AdminSignIn />
        <p className="admin-fine">
          Administrative access is provisioned by the IOJH owner. Customer
          accounts do not receive administrative privileges.
        </p>
      </section>
      <aside className="admin-auth-aside" aria-hidden="true">
        <span>IOJH / RESEARCH OPERATIONS</span>
        <div className="admin-arc" />
        <p>Evidence, responsibility, and access.</p>
      </aside>
    </main>
  );
}
