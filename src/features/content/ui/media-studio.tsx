'use client';
import Image from 'next/image';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import styles from './media-studio.module.css';

type Asset={id:string;version:number;mime:string;bytes:number;width:number;height:number;status:string;altEn:string;altBn:string;rightsHolder:string;license:string;publicRights:boolean;createdAt:string};
async function loadMediaAssets(signal?: AbortSignal): Promise<Asset[]> {
 const response = await fetch('/api/admin/cms/media', { cache: 'no-store', signal });
 if (!response.ok) throw Error('Could not load media records');
 const body = await response.json() as { assets: Asset[] };
 return body.assets;
}
export function MediaStudio(){
 const [items,setItems]=useState<Asset[]>([]);
 const [loading,setLoading]=useState(true);
 const [submitting,setSubmitting]=useState(false);
 const [message,setMessage]=useState('');
 const [failure,setFailure]=useState(false);
 const refresh=useCallback(async()=>{
  try { setItems(await loadMediaAssets()); }
  catch { setFailure(true);setMessage('Could not load media records. Reverify your administrator session.'); }
  finally { setLoading(false); }
 },[]);
 useEffect(()=>{
  const controller = new AbortController();
  void loadMediaAssets(controller.signal)
   .then(assets => {
    if (!controller.signal.aborted) setItems(assets);
   })
   .catch(() => {
    if (!controller.signal.aborted) {
     setFailure(true);
     setMessage('Could not load media records. Reverify your administrator session.');
    }
   })
   .finally(() => {
    if (!controller.signal.aborted) setLoading(false);
   });
  return () => controller.abort();
 },[]);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(submitting)return;
  setFailure(false);setMessage('');setSubmitting(true);
  const form=e.currentTarget;const body=new FormData(form);
  try{const response=await fetch('/api/admin/cms/media',{method:'POST',body,cache:'no-store'});
   const result=await response.json() as {error?:string;id?:string;version?:number};
   if(!response.ok)throw Error(result.error||'Upload rejected');
   setMessage(`Asset v${result.version||1} registered. Its original object remains private until referenced by approved published content.`);
   form.reset();await refresh();
  }catch(err){setFailure(true);setMessage(err instanceof Error?err.message:'Upload failed');}
  finally{setSubmitting(false);}
 }
 async function retire(id:string){
  if(!window.confirm('Retire this unused media version? Referenced versions are protected and Storage objects are not automatically deleted.'))return;
  setMessage('');setFailure(false);
  try{const r=await fetch(`/api/admin/cms/media/${id}`,{method:'DELETE',cache:'no-store'});
   if(!r.ok)throw Error('This asset may be referenced by an immutable revision.');
   setMessage('Unused asset retired. Physical object remains for owner-reviewed cleanup.');await refresh();
  }catch(err){setFailure(true);setMessage(err instanceof Error?err.message:'Unable to retire');}
 }
 return <div className={styles.layout}>
  <section className={styles.formCard} aria-labelledby="media-upload-heading">
   <div className={styles.sectionHead}><span>01 / ASSET INTAKE</span><h2 id="media-upload-heading">Register research imagery</h2><p>Private object storage, documented rights and immutable versions. PNG, JPEG or WebP; 4 MB maximum. No SVG or PDFs in this stage.</p></div>
   <form onSubmit={submit} className={styles.form}>
    <label>Image file<input type="file" name="file" accept="image/png,image/jpeg,image/webp" required/></label>
    <label>Rights holder<input name="rightsHolder" maxLength={180} required minLength={3} placeholder="Photographer, author or IOJH"/></label>
    <label>License / written permission<input name="license" maxLength={120} required minLength={3} placeholder="Owned / licensed / permission reference"/></label>
    <label>English alternative text<input name="altEn" maxLength={240} required minLength={5} placeholder="Describe the image for readers"/></label>
    <label>Bangla alternative text<input name="altBn" maxLength={240} placeholder="ছবির সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)"/></label>
    <label>Replace existing media version<select name="previous" defaultValue=""><option value="">New asset series</option>{items.filter(a=>a.status==='ready').map(a=><option value={a.id} key={a.id}>{a.altEn.slice(0,48)} — v{a.version}</option>)}</select></label>
    <label className={styles.check}><input type="checkbox" name="publicRights" value="true"/> Rights permit appearance on the public website (publication still requires review)</label>
    <button type="submit" disabled={submitting} aria-busy={submitting} className={styles.primary}>{submitting?'Checking and uploading…':'Upload secure version'} <span aria-hidden="true">↗</span></button>
   </form>
  </section>
  <section className={styles.library} aria-labelledby="media-assets-heading">
   <div className={styles.sectionHead}><span>02 / RIGHTS & USAGE</span><h2 id="media-assets-heading">Media inventory</h2><p>Latest forty versions. Rights flags do not publish media by themselves. Referenced revisions cannot be retired.</p></div>
   {loading?<p role="status">Loading media registry…</p>:items.length===0?<p className={styles.empty}>No media registered yet. Upload an approved asset to start the catalogue.</p>:
    <ul className={styles.assets}>{items.map(a=><li key={a.id} className={styles.asset}>
     <div className={styles.thumbnail}>{a.status==='ready'?<Image unoptimized width={a.width} height={a.height} alt={a.altEn} src={`/api/admin/cms/media/${a.id}`}/>:<span>ARCHIVED</span>}</div>
     <div className={styles.assetInfo}><div className={styles.assetHeader}><strong>{a.altEn}</strong><span>{a.status.toUpperCase()} / V{a.version}</span></div><small>{a.mime} · {(a.bytes/1024).toFixed(0)} KB</small>
      <p>Rights: {a.rightsHolder} · {a.license}</p><p>{a.publicRights?'Public permission recorded':'Private / no public permission'}</p>
      <button disabled={a.status!=='ready'} type="button" onClick={()=>void retire(a.id)}>Retire if unreferenced</button>
     </div>
    </li>)}</ul>}
  </section>
  {message&&<div className={failure?styles.error:styles.notice} role={failure?'alert':'status'}>{message}</div>}
 </div>;
}
