import type { ReactNode } from 'react';
import { ThemeProvider } from '@wrksz/themes/next';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource-variable/newsreader/wght.css';
import '@/styles/globals.css';
import './admin.css';

// Independent root layout. No public header/footer and no customer locale shell.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body>
    <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem
      disableTransitionOnChange storage="localStorage" storageKey="theme">
      {children}
    </ThemeProvider>
  </body></html>;
}
