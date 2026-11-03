import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {Link} from '@/i18n/navigation';
import {previewRoutes} from '@/content/preview-routes';
import type {Locale} from '@/i18n/routing';
import {getTranslations} from 'next-intl/server';
import {ArrowUpRight, ArrowLeft} from 'lucide-react';

type Props = {params: Promise<{locale: Locale; slug: string[]}>};
export async function generateMetadata({params}: Props): Promise<Metadata> {
 const {locale,slug}=await params;
 const route = previewRoutes.get('/'+slug.join('/'));
 return {title: route ? `${route[locale]} — IOJH 2.0 Preview` : 'Not found',robots:{index:false,follow:false}};
}
export default async function PlannedPage({params}: Props) {
 const {locale,slug}=await params;
 const path='/'+slug.join('/');
 const record=previewRoutes.get(path);
 if(!record) notFound();
 const t=await getTranslations('Preview');
 return <div className="preview-route">
   <div className="container preview-route__grid">
     <div><span className="eyebrow"><span className="eyebrow__dot"/>{t('eyebrow')}</span>
     <h1 className="preview-route__title">{record[locale]}</h1>
     <p className="preview-route__intro">{t('notice')}</p>
     <p className="preview-route__detail">{t('notActive')}</p>
     <Link href="/" className="button button--primary"><ArrowLeft size={18}/>{t('back')}</Link></div>
     <div className="preview-route__art" aria-hidden="true"><span>IOJH / 2.0</span><div className="preview-route__arc"/><ArrowUpRight size={54}/></div>
   </div>
 </div>;
}
