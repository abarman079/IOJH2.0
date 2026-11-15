import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';
import { getPublicAuthConfig } from './features/auth/config';
const intl=createMiddleware(routing);
const localizedAuth=/^\/(?:en|bn)\/(?:account(?:\/|$)|sign-in(?:\/|$)|sign-up(?:\/|$)|verify-email(?:\/|$)|forgot-password(?:\/|$)|reset-password(?:\/|$)|auth(?:\/|$))/;
const adminAuth=/^\/admin(?:\/|$)/;
/** Preserve next-intl locale behavior; refresh Supabase cookies on protected and auth paths. */
export default async function proxy(request:NextRequest){
 const path=request.nextUrl.pathname,isAdmin=adminAuth.test(path),isAuth=localizedAuth.test(path);
 const cfg=getPublicAuthConfig();
 const writes:Array<(response:NextResponse)=>void>=[];
 if(cfg&&(isAdmin||isAuth)){
  const client=createServerClient(cfg.url,cfg.key,{cookies:{
    getAll(){return request.cookies.getAll();},
    setAll(items){items.forEach(({name,value,options})=>{
      request.cookies.set(name,value);
      writes.push(response=>response.cookies.set(name,value,options));
    });}
  }});
  try{await client.auth.getClaims();}catch{/* Auth checks fail closed in server gates */}
 }
 const response=isAdmin?NextResponse.next():intl(request);
 writes.forEach(apply=>apply(response));
 if(isAdmin||isAuth){response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');response.headers.set('X-Robots-Tag','noindex, nofollow');}
 return response;
}
export const config={matcher:'/((?!api|_next|_vercel|.*\\..*).*)'};
