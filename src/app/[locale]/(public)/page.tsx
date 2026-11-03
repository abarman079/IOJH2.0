import {HomePage} from '@/components/home/home-page';
import {getHomeFixture} from '@/content/home';
import type {Locale} from '@/i18n/routing';
import type {Metadata} from 'next';

export async function generateMetadata({params}: {params: Promise<{locale: Locale}>}): Promise<Metadata> {
  const {locale} = await params;
  const content = getHomeFixture(locale);
  return {
    title: locale === 'bn' ? 'আইওজেএইচ — গবেষণাকে এগিয়ে নিতে' : 'IOJH — Advancing Research. Connecting Knowledge.',
    description: content.hero.description,
    alternates: {canonical: `/${locale}`, languages: {en: '/en', bn: '/bn'}},
    robots: {index: false, follow: false} // Local preview content: must not be indexed.
  };
}

export default async function Home({params}: {params: Promise<{locale: Locale}>}) {
  const {locale} = await params;
  return <HomePage content={getHomeFixture(locale)} locale={locale} />;
}
