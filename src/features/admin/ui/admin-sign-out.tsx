'use client';
import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
export function AdminSignOut(){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function signOut(){
    if(busy)return;setBusy(true);setError('');
    const client=createBrowserSupabaseClient();
    if(!client){setError('Authentication is unavailable.');setBusy(false);return;}
    try{
      const {error}=await client.auth.signOut({scope:'local'});
      if(error)throw error;
      window.location.replace('/admin/sign-in');
    }catch{setError('Sign-out failed. Please retry.');setBusy(false);}
  }
  return <div className="admin-signout"><button onClick={()=>void signOut()} disabled={busy}>{busy?'Signing out…':'Sign out'}</button>{error&&<span role="alert">{error}</span>}</div>;
}
