import {Link} from '@/i18n/navigation';
export default function NotFoundPage() {
  return <section className="container page-state"><p className="eyebrow">404 / Not found</p><h1>We could not find this page.</h1><p>This resource is not available in the current preview.</p><Link href="/">Return to homepage ↗</Link></section>;
}
