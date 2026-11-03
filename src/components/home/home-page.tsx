import {ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, CornerDownRight, MoveUpRight, Search, Sparkle} from 'lucide-react';
import Image from 'next/image';
import type {HomeContent} from '@/content/home';
import type {Locale} from '@/i18n/routing';
import {Link} from '@/i18n/navigation';
import {ServiceLedger} from './service-ledger';
import styles from './home.module.css';

type Props={content:HomeContent;locale:Locale};

function Eyebrow({children}: {children:React.ReactNode}) {return <p className={styles.eyebrow}><span className={styles.eyebrowRule}/>{children}</p>}
function ActionLink({href,children,primary=false}: {href:string;children:React.ReactNode;primary?:boolean}) {
 return <Link href={href} className={primary?`${styles.action} ${styles.actionPrimary}`:styles.action}>{children}<ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.6}/></Link>;
}

function AtlasPlate({content}: {content:HomeContent['hero']}) {
 return <figure className={styles.atlasFigure}>
  <div className={styles.atlasTopLine}><span><span className={styles.atlasPulse}/> IOJH / RESEARCH ATLAS</span><span>FIG. 001 — CONCEPTUAL</span></div>
  <div className={styles.atlasBody}>
   <Image src="/illustrations/atlas-map.svg" alt="" fill priority sizes="(max-width: 768px) 100vw, 520px" className={styles.atlasMap}/>
   <div className={`${styles.atlasMarker} ${styles.atlasMarkerOne}`}><small>01 /</small><strong>{content.pathQuestion}</strong></div>
   <div className={`${styles.atlasMarker} ${styles.atlasMarkerTwo}`}><small>02 /</small><strong>{content.pathMethod}</strong></div>
   <div className={`${styles.atlasMarker} ${styles.atlasMarkerThree}`}><small>03 /</small><strong>{content.pathEvidence}</strong></div>
   <div className={`${styles.atlasMarker} ${styles.atlasMarkerFour}`}><small>04 /</small><strong>{content.pathReach}</strong></div>
   <div className={styles.atlasCornerText} aria-hidden="true">RESEARCH / PUBLICATION / KNOWLEDGE</div>
  </div>
  <figcaption><span>{content.label}</span><span>{content.sideNote}</span></figcaption>
 </figure>;
}

export function HomePage({content:c,locale}:Props) {
 return <div className={`${styles.home} ${locale==='bn'?styles.bengali:''}`}>
  {/* ACT 1 — Identity */}
  <section className={`${styles.hero} container`} aria-labelledby="home-hero-title">
   <div className={styles.heroCopy}>
     <Eyebrow>{c.hero.eyebrow}</Eyebrow>
     <h1 id="home-hero-title"><span>{c.hero.titleLead}</span><em>{c.hero.titleAccent}</em></h1>
     <p className={styles.heroDescription}>{c.hero.description}</p>
     <div className={styles.heroActions}><ActionLink href="/services" primary>{c.hero.primary}</ActionLink><ActionLink href="/academy">{c.hero.secondary}</ActionLink></div>
     <div className={styles.heroShortcuts}>{c.hero.shortcuts.map((item)=><Link key={item.href} href={item.href}>{item.label}<ArrowUpRight size={13}/></Link>)}</div>
   </div>
   <div className={styles.heroArt}><AtlasPlate content={c.hero}/></div>
   <div className={styles.heroFootnote}><span>INTERNATIONAL ONLINE JOURNAL HUB</span><span>SCROLL TO EXPLORE <ArrowDownRight size={15}/></span></div>
  </section>
  {/* ACT 2 — Capabilities */}
  <section className={`${styles.section} ${styles.capabilities}`} id="capabilities" aria-labelledby="capabilities-title">
   <div className="container">
    <div className={styles.sectionIntro}><div><Eyebrow>{c.capabilities.eyebrow}</Eyebrow><h2 id="capabilities-title">{c.capabilities.title}</h2></div><p>{c.capabilities.intro}</p></div>
    <ServiceLedger content={c.capabilities}/>
   </div>
  </section>
  {/* ACT 3 — Work and evidence */}
  <section className={`${styles.section} ${styles.work}`} id="work" aria-labelledby="work-title">
   <div className="container">
    <div className={styles.sectionIntro}><div><Eyebrow>{c.work.eyebrow}</Eyebrow><h2 id="work-title">{c.work.title}</h2></div><p>{c.work.intro}</p></div>
    <div className={styles.workGrid}>
     {c.work.items.map((item,index)=><article className={`${styles.workCard} ${index?styles.workCardSecondary:''}`} key={item.number}>
      <div className={`${styles.workArt} ${index?styles.workArtSecondary:''}`} aria-hidden="true">
       <span className={styles.workArtTop}>FIELD NOTE / {item.number}</span>
       <span className={styles.workArtOrb}/><span className={styles.workArtOrbTwo}/><span className={styles.workArtGlyph}>{index?'↗':'?'}</span>
       <span className={styles.workArtBottom}>IOJH / METHODS &amp; EVIDENCE</span>
      </div>
      <div className={styles.workCardMeta}><span>{c.work.label}</span><span>{item.type}</span></div>
      <h3>{item.title}</h3><p>{item.desc}</p>
     </article>)}
    </div>
    <div className={styles.principles}><div><p className={styles.principlesKicker}>IOJH / EVIDENCE STANDARD</p><h3>{c.work.principlesTitle}</h3></div>{c.work.principles.map((item,index)=><div className={styles.principle} key={item.title}><span>0{index+1}</span><strong>{item.title}</strong><p>{item.desc}</p></div>)}</div>
    <div className={styles.sectionTail}><ActionLink href="/projects">{c.work.action}</ActionLink></div>
   </div>
  </section>
  {/* ACT 4 — Learn and participate */}
  <section className={`${styles.section} ${styles.learn}`} id="learn" aria-labelledby="learn-title">
   <div className="container">
    <div className={styles.sectionIntro}><div><Eyebrow>{c.learn.eyebrow}</Eyebrow><h2 id="learn-title">{c.learn.title}</h2></div><p>{c.learn.intro}</p></div>
    <div className={styles.learnGrid}>
     <article className={styles.academyPanel}><div className={styles.learningSymbol} aria-hidden="true">A<span>+</span></div><div className={styles.learningContents}><p className={styles.learningKicker}><span/> {c.learn.academyTag}</p><h3>{c.learn.academyTitle}</h3><p>{c.learn.academyDesc}</p><div className={styles.learningRows}>{c.learn.learnTypes.map((item,index)=><div key={item.title}><span>0{index+1}</span><strong>{item.title}</strong><small>{item.detail}</small><ArrowUpRight size={17}/></div>)}</div><ActionLink href="/academy">{c.learn.academyAction}</ActionLink></div></article>
     <article className={styles.yrdpPanel}><div className={styles.yrdpGraphic} aria-hidden="true"><span className={styles.yrdpPath}/><span className={styles.yrdpPointOne}/><span className={styles.yrdpPointTwo}/><span className={styles.yrdpPointThree}/><span className={styles.yrdpLetter}>Y</span></div><p className={styles.yrdpKicker}>{c.learn.yrdpTag}</p><h3>{c.learn.yrdpTitle}</h3><p>{c.learn.yrdpDesc}</p><ActionLink href="/yrdp">{c.learn.yrdpAction}</ActionLink></article>
    </div>
   </div>
  </section>
  {/* ACT 5 — Publishing and discovery */}
  <section className={`${styles.section} ${styles.publishing}`} id="publishing" aria-labelledby="publishing-title">
   <div className="container"><div className={styles.publishGrid}>
    <div className={styles.publishCopy}><Eyebrow>{c.publishing.eyebrow}</Eyebrow><h2 id="publishing-title">{c.publishing.title}</h2><p>{c.publishing.intro}</p><div className={styles.publishPath}><span>01</span><div><strong>{c.publishing.pathOne}</strong><p>{c.publishing.pathOneDesc}</p></div><Link href="/publish-with-us" aria-label={c.publishing.pathOne}><ArrowUpRight size={21}/></Link></div><ActionLink href="/publish-with-us/guide">{c.publishing.guideAction}</ActionLink></div>
    <div className={styles.finderCard}><div className={styles.finderTop}><span>RESEARCH MATCH STUDIO / PROTOTYPE</span><span className={styles.finderStars}><Sparkle size={16}/> 02</span></div><div className={styles.finderGraphic} aria-hidden="true"><div className={styles.finderDiagram}><span/><span/><span/><span/><span/><span/></div><span className={styles.finderDotted}/></div><p className={styles.finderEyebrow}>{c.publishing.pathTwo}</p><h3>{c.publishing.searchLabel}</h3><p>{c.publishing.pathTwoDesc}</p><label className={styles.finderLabel} htmlFor="finder-preview">{c.publishing.searchLabel}</label><div className={styles.finderInput}><Search size={21}/><input id="finder-preview" type="text" disabled placeholder={c.publishing.searchPlaceholder}/><span aria-hidden="true"><ArrowRight size={18}/></span></div><p className={styles.finderDisabled}>{c.publishing.searchDisabled}</p><div className={styles.finderPipeline}>{c.publishing.pipeline.map((x,index)=><span key={x}>{x}{index<2&&<ArrowRight size={13}/>}</span>)}</div><ActionLink href="/journal-finder">{c.publishing.finderAction}</ActionLink></div>
   </div></div>
  </section>
  {/* ACT 6 — Publisher */}
  <section className={`${styles.section} ${styles.publisher}`} id="publisher" aria-labelledby="publisher-title">
   <div className="container"><div className={styles.publisherGrid}>
    <div className={styles.publisherCopy}><Eyebrow>{c.publisher.eyebrow}</Eyebrow><h2 id="publisher-title">{c.publisher.title}</h2><p className={styles.publisherLead}>{c.publisher.intro}</p><div className={styles.publisherCitation}><BookOpen size={19}/><span>{c.publisher.shelfCaption}</span></div><ActionLink href="/publisher" primary>{c.publisher.bookAction}</ActionLink></div>
    <div className={styles.bookStage}><div className={styles.bookStageHeader}><span>IOJH / EDITORIAL SHELF</span><span>01 / 01</span></div><div className={styles.booksScene} aria-label="Temporary illustration of an academic book cover"><span className={styles.bookShadow}/><div className={styles.bookSecondary} aria-hidden="true"/><div className={styles.bookPrimary}><div className={styles.bookSpine}/><div className={styles.bookFace} lang="en"><span className={styles.bookImprint}>IOJH <span>PUBLISHER</span></span><span className={styles.bookCoverRule}/><span className={styles.bookCoverTitle}>RESEARCH<br/>METHOD<span> / </span><br/>MANUSCRIPT<br/>PREPARATION<br/><i>&amp;</i> PUBLICATION</span><span className={styles.bookCoverOrb}/><span className={styles.bookCoverFooter}>ACADEMIC RESEARCH &amp; PUBLISHING</span></div></div></div><div className={styles.bookStageFooter}><span>{c.publisher.bookTag}</span><h3 lang="en">{c.publisher.bookTitle}</h3><p>{c.publisher.bookSub}</p><small>{c.publisher.bookNote}</small></div></div>
   </div></div>
  </section>
  {/* ACT 7 — Insights and invitation */}
  <section className={`${styles.section} ${styles.insights}`} id="insights" aria-labelledby="insights-title">
   <div className="container"><div className={styles.sectionIntro}><div><Eyebrow>{c.insights.eyebrow}</Eyebrow><h2 id="insights-title">{c.insights.title}</h2></div><p>{c.insights.intro}</p></div>
    <div className={styles.insightGrid}><div className={styles.insightLead}><span className={styles.insightLeadTop}>IOJH / EDITORIAL DESK</span><div className={styles.insightDesign} aria-hidden="true"><span>i</span><span className={styles.insightCircle}/><span className={styles.insightLine}/></div><p>{c.insights.topicsEyebrow}</p></div><div className={styles.insightRows}>{c.insights.topics.map((topic)=><div className={styles.insightRow} key={topic.id}><span>{topic.id}</span><div><h3>{topic.title}</h3><p>{topic.desc}</p></div><CornerDownRight size={23} strokeWidth={1.3} aria-hidden="true"/></div>)}<Link href="/blog" className={styles.insightAction}>{c.insights.action}<ArrowUpRight size={19}/></Link></div></div>
    <div className={styles.closing}><p className={styles.closingEyebrow}><span/> {c.insights.endEyebrow}</p><div><h2>{c.insights.endTitle}</h2><div><p>{c.insights.endCopy}</p><Link href="/contact" className={styles.closingLink}>{c.insights.endAction}<MoveUpRight size={24}/></Link></div></div></div>
   </div>
  </section>
 </div>;
}
