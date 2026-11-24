'use client';
import {useCallback,useEffect,useState} from 'react';
import styles from '@/app/admin/notifications/review.module.css';

type RecordItem={notificationId:string;jobId:string;templateId:string;locale:'en'|'bn';status:string;jobState:string;errorCode:string|null;createdAt:string;updatedAt:string;retryEligible:boolean};
const reasons=[{value:'operator_reviewed',label:'Reviewed operational failure'}, {value:'provider_recovered',label:'Provider service recovered'}, {value:'incident_recovery',label:'Incident recovery approved'}] as const;
function localTime(input:string){const date=new Date(input);return Number.isNaN(date.getTime())?'Unavailable':date.toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});}
export function NotificationReviewPanel(){
 const [rows,setRows]=useState<RecordItem[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null),
  [error,setError]=useState(''),[message,setMessage]=useState(''),[reason,setReason]=useState<(typeof reasons)[number]['value']>('operator_reviewed');
 const [loadingOlder,setLoadingOlder]=useState(false);
 const reload=useCallback(async()=>{
  setLoading(true);setError('');
  try{const response=await fetch('/api/admin/notifications?limit=25',{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw new Error('Unable to retrieve the protected failure queue');
    const data:unknown=await response.json();
    if(!data||typeof data!=='object'||!('rows' in data)||!Array.isArray(data.rows))throw new Error('Unexpected response');
    setRows(data.rows as RecordItem[]);
  }catch{setError('Unable to load notifications. Confirm administrator MFA, then refresh.');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{
  let active=true;
  const controller=new AbortController();
  void fetch('/api/admin/notifications?limit=25',{
   cache:'no-store',credentials:'same-origin',signal:controller.signal
  })
   .then(async response=>{
    if(!response.ok)throw new Error('Unable to retrieve notifications');
    const data:unknown=await response.json();
    if(!data||typeof data!=='object'||!('rows' in data)||!Array.isArray(data.rows))
     throw new Error('Invalid response');
    return data.rows as RecordItem[];
   })
   .then(next=>{if(active)setRows(next);})
   .catch(()=>{if(active)setError('Unable to load notifications. Confirm administrator MFA, then refresh.');})
   .finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;controller.abort();};
 },[]);
 async function older(){
  if(rows.length===0)return;
  const last=rows[rows.length-1];setLoadingOlder(true);setError('');
  try{const url=new URL('/api/admin/notifications',window.location.origin);url.searchParams.set('limit','25');
   url.searchParams.set('before',last.updatedAt);url.searchParams.set('beforeId',last.notificationId);
   const response=await fetch(url.toString(),{cache:'no-store',credentials:'same-origin'});
   if(!response.ok)throw Error('Unavailable');
   const payload:unknown=await response.json();
   if(!payload||typeof payload!=='object'||!('rows' in payload)||!Array.isArray(payload.rows))throw Error('Malformed');
   setRows(old=>old.concat(payload.rows as RecordItem[]));
  }catch{setError('Could not load older failures. Refresh the list and try again.');}
  finally{setLoadingOlder(false);}
 }
 async function retry(id:string){
  if(!window.confirm('Requeue this reviewed obligation? Delivery requires an enabled, eligible and authorized worker.'))return;
  setBusy(id);setError('');setMessage('');
  try{
   const response=await fetch('/api/admin/notifications/retry',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({notificationId:id,reason})});
   if(!response.ok)throw new Error('Retry rejected');
   setMessage('Obligation requeued. Delivery is not confirmed.');await reload();
  }catch{setError('Requeue was not authorized or the obligation is no longer eligible. Refresh before retrying.');}
  finally{setBusy(null);}
 }
 return <>
  <div className={styles.header}><div><h2>Failures requiring review</h2><p className={styles.muted}>Most recent 25 only. Recipient identities and message bodies are never shown here.</p></div>
   <button type="button" className={styles.secondaryButton} onClick={()=>void reload()} disabled={loading||busy!==null}>Refresh list</button>
  </div>
  {loading&&<p role="status" className={styles.muted}>Loading protected notification state…</p>}
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  {message&&<p role="status" className={styles.success}>{message}</p>}
  {!loading&&!error&&rows.length===0&&<p role="status" className={styles.muted}>No failed notification obligations in the current page. This does not indicate that email delivery has been enabled.</p>}
  {!loading&&rows.length>0&&<div className={styles.tableScroll}><table className={styles.table}>
   <caption className={styles.muted}>Protected notification errors and recovery eligibility</caption>
   <thead><tr><th scope="col">Notification</th><th scope="col">State</th><th scope="col">Failure</th><th scope="col">Updated</th><th scope="col">Recovery</th></tr></thead>
   <tbody>{rows.map(row=><tr key={row.notificationId}>
    <td><strong>{row.templateId}</strong><p className={styles.muted}>{row.locale.toUpperCase()} / <code>{row.notificationId.slice(0,8)}</code></p></td>
    <td><span className={styles.state}>{row.status}</span><p className={styles.muted}>Job: {row.jobState}</p></td>
    <td><code>{row.errorCode??'No code reported'}</code></td><td><time dateTime={row.updatedAt}>{localTime(row.updatedAt)}</time></td>
    <td>{row.retryEligible?<div className={styles.form}><label><span className={styles.muted}>Reason</span><select value={reason} className={styles.select} onChange={e=>setReason(e.target.value as typeof reason)}>{reasons.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
     <button type="button" className={styles.button} disabled={busy!==null} onClick={()=>void retry(row.notificationId)}>{busy===row.notificationId?'Reviewing…':'Requeue'}</button></div>
    :<span className={styles.muted}>Manual investigation required</span>}</td>
   </tr>)}</tbody>
  </table>{rows.length>=25&&<button type="button" className={styles.secondaryButton} onClick={()=>void older()} disabled={loadingOlder||busy!==null}>{loadingOlder?'Loading…':'Load older failures'}</button>}</div>}
  <p className={styles.muted}>Accepted by provider is not the same as delivered. Suppressed, uncertain and already accepted notices cannot be requeued from this screen.</p>
 </>;
}
