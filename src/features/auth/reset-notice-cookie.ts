import 'server-only';
import { cookies } from 'next/headers';
import type { Locale } from '@/i18n/routing';
import { createResetNotice, readResetNotice } from '@/features/auth/reset-notice.mjs';
import type { ResetNoticeState } from '@/features/auth/reset-notice.mjs';

const NAME = 'iojh_reset_notice';
const SECRET = () => process.env.IOJH_AUTH_RECOVERY_SECRET ?? '';

/** Only a successful password-update Server Action can issue this notice. */
export async function setResetNotice(locale: Locale, state: ResetNoticeState) {
  const store = await cookies();
  store.set(NAME, createResetNotice(locale, state, SECRET()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/${locale}/sign-in`,
    maxAge: 120,
  });
}

/** For presentation only: signed notice is not login, MFA, or recovery authorization. */
export async function getResetNotice(locale: Locale): Promise<ResetNoticeState | null> {
  const store = await cookies();
  return readResetNotice(store.get(NAME)?.value, locale, SECRET());
}
