import type {ReactNode} from 'react';
import {Link} from '@/i18n/navigation';
export default function FocusedLayout({children}: {children: ReactNode}) {
  return <div className="focused-shell"><header className="focused-shell__header"><Link href="/" className="wordmark">IOJH<span className="wordmark__dot">.</span></Link><span>Account & checkout — in development</span></header><main id="main-content">{children}</main><footer className="focused-shell__footer">No payments or accounts are active in this preview.</footer></div>;
}
