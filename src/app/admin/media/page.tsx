import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdminAal2 } from '@/features/admin/authorization';
import { MediaStudio } from '@/features/content/ui/media-studio';
import { AdminSignOut } from '@/features/admin/ui/admin-sign-out';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Media rights desk — IOJH',robots:{index:false,follow:false}};
export default async function AdminMediaPage(){
 await requireAdminAal2();
 return <main id="main-content" className="admin-workspace"><header className="admin-top"><Link href="/admin" className="admin-wordmark">IOJH<span>.</span></Link><span>MEDIA / CONTROLLED STORAGE</span><AdminSignOut/></header>
  <div className="admin-content"><Link href="/admin" className="admin-text-link">← Administrative desk</Link><p className="admin-eyebrow">C06 / DIGITAL ASSET MANAGEMENT</p><h1>Media rights, clearly documented.</h1>
   <p>Asset originals remain private in Storage. Content publication and full editorial workflows follow their approved development packets.</p></div><MediaStudio/></main>;
}
