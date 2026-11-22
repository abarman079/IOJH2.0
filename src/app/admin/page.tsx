import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminAal2 } from '@/features/admin/authorization';
import { AdminSignOut } from '@/features/admin/ui/admin-sign-out';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Administrator workspace — IOJH', robots: {index:false,follow:false} };
export default async function AdminHome() {
  await requireAdminAal2();
  return <main className="admin-workspace" id="main-content">
    <header className="admin-top"><Link href="/en" className="admin-wordmark">IOJH<span>.</span></Link><span>SECURE ADMINISTRATIVE DESK</span><AdminSignOut /></header>
    <div className="admin-content"><p className="admin-eyebrow">IDENTITY VERIFIED / C05b</p>
      <h1>Administrative access is protected.</h1>
      <p>This workspace is available only to the currently authorized IOJH website administrator after multi-factor verification.</p>
      <section className="admin-note"><h2>Foundation ready for editorial operations</h2>
        <p>Content, orders, Academy, publishing, and journal services are not yet administered here. Their workflows will be implemented in their approved development packets.</p></section>
    </div>
  </main>;
}
