import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPublishedPage } from '@/features/content/public';
import { ContentRenderer } from '@/features/content/ui/content-renderer';

type Props={params:Promise<{locale:string;slug:string}>};
export const dynamic='force-dynamic';
export const revalidate=0;
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {locale,slug}=await params;const page=await getPublishedPage(locale,slug);
 if(!page)return {title:'Not found — IOJH',robots:{index:false,follow:false}};
 return {title:`${page.title} — IOJH`,description:page.summary,robots:{index:true,follow:true}};
}
export default async function PublishedResearchNote({params}:Props){
 const {locale,slug}=await params;const page=await getPublishedPage(locale,slug);
 if(!page)notFound();return <ContentRenderer page={page}/>;
}
