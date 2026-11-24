import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminAal2 } from '@/features/admin/authorization';
import { AdminSignOut } from '@/features/admin/ui/admin-sign-out';
import { NotificationReviewPanel } from '@/features/notifications/notification-review-panel';
import styles from './review.module.css';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Notification obligations — IOJH Admin',robots:{index:false,follow:false}};
export default async function NotificationReviewPage(){
  await requireAdminAal2();
  return <main id="main-content" className="admin-workspace">
    <header className="admin-top"><Link href="/admin" className="admin-wordmark">IOJH<span>.</span></Link><span>SECURE / NOTIFICATION OPERATIONS</span><AdminSignOut/></header>
    <div className="admin-content">
      <p className="admin-eyebrow">OPERATIONS / C07c</p>
      <h1>Notification obligations.</h1>
      <p>Review durable delivery failures without exposing recipient addresses or message bodies. Requeued obligations await an enabled and authorized worker. Provider acceptance is not confirmed delivery.</p>
      <Link href="/admin" className="admin-text-link">Return to administrator desk</Link>
      <section className={styles.panel} aria-label="Notification failure review">
        <NotificationReviewPanel/>
      </section>
    </div>
  </main>;
}
