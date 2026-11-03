'use client';
import {useState} from 'react';
import {ArrowUpRight, ArrowRight} from 'lucide-react';
import {Link} from '@/i18n/navigation';
import type {HomeContent} from '@/content/home';
import styles from './home.module.css';

export function ServiceLedger({content}: {content: HomeContent['capabilities']}) {
 const [selected,setSelected]=useState(0);
 const current=content.items[selected];
 return <div className={styles.servicesGrid}>
  <div className={styles.serviceRows}>
    {content.items.map((item,index)=><article key={item.href} className={`${styles.serviceRow} ${selected===index?styles.serviceRowActive:''}`}>
      <button type="button" className={styles.serviceSelect} onClick={()=>setSelected(index)} aria-pressed={selected===index} aria-controls="selected-service-panel">
       <span className={styles.serviceIndex}>{item.id}</span>
       <span className={styles.serviceText}><span className={styles.serviceTag}>{item.tag}</span><strong>{item.title}</strong><span className={styles.serviceDescription}>{item.desc}</span></span>
      </button>
      <Link href={item.href} className={styles.serviceArrow} aria-label={`${item.title} — details`}><ArrowUpRight size={23} strokeWidth={1.4}/></Link>
    </article>)}
  </div>
  <aside id="selected-service-panel" className={styles.servicePanel} aria-live="polite">
   <div className={styles.servicePanelTop}><span>{content.panelEyebrow}</span><span>{current.id} / 04</span></div>
   <div className={styles.servicePanelArt} aria-hidden="true"><span className={styles.servicePanelRing}/><span className={styles.servicePanelOrbit}/><span className={styles.servicePanelDot}/><span className={styles.servicePanelCross}>+</span><span className={styles.servicePanelTiny}>IOJH / PRACTICE NOTE</span></div>
   <div className={styles.servicePanelBottom}><span className={styles.servicePanelTag}>{current.tag}</span><h3>{current.title}</h3><p>{current.for}</p><p>{current.result}</p><Link href={current.href} className={styles.textArrow}>{content.panelEnd} <ArrowRight size={17}/></Link></div>
  </aside>
 </div>;
}
