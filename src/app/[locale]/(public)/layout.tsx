import type {ReactNode} from 'react';
import {SiteHeader} from '@/components/layout/site-header';
import {SiteFooter} from '@/components/layout/site-footer';

export default function PublicLayout({children}: {children: ReactNode}) {
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <SiteHeader />
    <main id="main-content" tabIndex={-1}>{children}</main>
    <SiteFooter />
  </>;
}
