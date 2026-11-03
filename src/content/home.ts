/** Local content fixtures. Replace with approved CMS projections in C06–C08. */
import en from '@/content/fixtures/home.en.json';
import bn from '@/content/fixtures/home.bn.json';
import type {Locale} from '@/i18n/routing';

export type HomeContent = typeof en;
const fixtures: Record<Locale, HomeContent> = {en, bn};

export function getHomeFixture(locale: Locale): HomeContent {
  return fixtures[locale] || fixtures.en;
}
