import type {ReactNode} from 'react';
import '@fontsource-variable/manrope/wght.css';
import '@/styles/globals.css';

// Isolated administration root; public shell and marketing scripts never load here.
// Only C05 may replace this closed placeholder with an authenticated admin shell.
export default function AdminLayout({children}: {children: ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
