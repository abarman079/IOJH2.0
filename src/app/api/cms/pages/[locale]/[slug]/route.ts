import { NextResponse } from 'next/server';
import { getPublishedPage } from '@/features/content/public';
export const dynamic='force-dynamic';
export const revalidate=0;
const headers={'Cache-Control':'public, no-store, max-age=0','X-Content-Type-Options':'nosniff'};
export async function GET(_req:Request,{params}:{params:Promise<{locale:string;slug:string}>}){
 const {locale,slug}=await params;const record=await getPublishedPage(locale,slug);
 if(!record)return NextResponse.json({error:'Not found'},{status:404,headers});
 return NextResponse.json(record,{headers});
}
