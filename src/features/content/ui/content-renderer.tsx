import Image from 'next/image';
import type { PublishedPage, ContentBlock } from '../schemas';
import { getPublishedMedia } from '../public';
import styles from './published.module.css';

async function Block({block,locale}:{block:ContentBlock;locale:'en'|'bn'}){
 if(!block.isVisible)return null;
 switch(block.type){
  case 'hero':{
   const c=block.content;
   const media=c.mediaId?await getPublishedMedia(c.mediaId):null;
   return <section className={`${styles.hero} ${block.variant==='split'?styles.heroSplit:''}`} aria-labelledby={`block-${block.id}`}>
    <div><span className={styles.overline}>IOJH / RESEARCH JOURNAL</span><h2 id={`block-${block.id}`}>{c.title}</h2>{c.body&&<p>{c.body}</p>}
    {c.href&&<a className={styles.action} href={c.href} rel="noopener noreferrer">{c.linkLabel||'Explore'} <span aria-hidden="true">↗</span></a>}</div>
    {media&&<Image className={styles.art} unoptimized src={`/api/cms/media/${c.mediaId}`} width={media.width} height={media.height} alt={locale==='bn'?(media.altBn||media.altEn):media.altEn}/>}
   </section>;
  }
  case 'intro':{const c=block.content;return <section className={styles.intro} aria-labelledby={`block-${block.id}`}><h2 id={`block-${block.id}`}>{c.title}</h2><p>{c.body}</p></section>;}
  case 'featureGrid':{const c=block.content;return <section className={styles.features} aria-label={c.title||'Research perspectives'}>{c.title&&<h2>{c.title}</h2>}<div className={styles.grid}>{c.items.map((item,i)=><article key={`${block.id}-${i}`}><span>0{i+1}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}</div></section>;}
  case 'richText':{const c=block.content;return <section className={styles.prose} aria-label="Article text">{c.paragraphs.map((p,i)=><p key={i}>{p.text}</p>)}</section>;}
  case 'faq':{const c=block.content;return <section className={styles.faq} aria-label="Frequently asked questions"><h2>{locale==='bn'?'সাধারণ প্রশ্ন':'Questions & answers'}</h2>{c.items.map((item,i)=><details key={i}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>;}
  case 'contactInvitation':{const c=block.content;return <section className={styles.invite}><div><h2>{c.title}</h2>{c.body&&<p>{c.body}</p>}</div>{c.href&&<a href={c.href} rel="noopener noreferrer">{c.linkLabel||'Contact'} ↗</a>}</section>;}
 }
}
export async function ContentRenderer({page}:{page:PublishedPage}){
 return <article className={styles.page}>
  <header className={styles.masthead}><div className="container"><p className={styles.overline}>INTERNATIONAL ONLINE JOURNAL HUB / PUBLICATION</p>
   <h1>{page.title}</h1>{page.summary&&<p className={styles.lede}>{page.summary}</p>}</div></header>
  <div className={styles.sections}>{page.blocks.map(b=><Block key={b.id} block={b} locale={page.locale}/>)}</div>
  <footer className={styles.foot}><span>IOJH / KNOWLEDGE IN CONTEXT</span><span>{page.locale==='bn'?'গবেষণা ও প্রকাশনা':'Research & publication'}</span></footer>
 </article>;
}
