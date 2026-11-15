import { NextResponse } from 'next/server';
import { getAdminAccess } from '@/features/admin/authorization';
export const dynamic = 'force-dynamic';
/** C05b diagnostic-only gate: no private membership or user details are returned. */
export async function GET(){
  const state=await getAdminAccess();
  const authorized=state==='authorized';
  return NextResponse.json(authorized?{authorized:true}:{authorized:false}, {
    status:authorized?200:state==='signed_out'?401:403,
    headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}
  });
}
