export type ResetNoticeState = 'changed' | 'cleanup_unconfirmed';
export declare function createResetNotice(
  locale: 'en' | 'bn', state: ResetNoticeState, secret: string, now?: number
): string;
export declare function readResetNotice(
  value: unknown, locale: 'en' | 'bn', secret: string, now?: number
): ResetNoticeState | null;
