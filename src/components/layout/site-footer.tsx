import {ArrowUpRight, ArrowUp, MoveUpRight} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import styles from './site-footer.module.css';

const groups = [
 {key:'iojh',links:[['about','/about'],['team','/team'],['projects','/projects'],['blog','/blog'],['careers','/careers']]},
 {key:'programs',links:[['services','/services'],['academy','/academy'],['yrdp','/yrdp'],['quotes','/services/request-quote']]},
 {key:'publishing',links:[['publisher','/publisher'],['journals','/journals'],['finder','/journal-finder'],['guide','/publish-with-us/guide']]},
 {key:'help',links:[['contact','/contact'],['faq','/contact'],['privacy','/legal/privacy'],['terms','/legal/terms'],['accessibility','/legal/accessibility']]}
] as const;

export async function SiteFooter() {
 const t=await getTranslations('Footer');
 return <footer className={styles.footer}>
  <div className={styles.atlasArc} aria-hidden="true"/>
  <div className="container">
    <div className={styles.top}>
      <div><div className={styles.smallLabel}><span/> IOJH / A CONTINUING CONVERSATION</div><h2>{t('sentence')}</h2></div>
      <div className={styles.newsletter}>
        <span className={styles.newsletterIcon} aria-hidden="true"><MoveUpRight size={27} strokeWidth={1.3}/></span>
        <h3>{t('newsletterTitle')}</h3>
        <p>{t('newsletterNote')}</p>
      </div>
    </div>
    <div className={styles.separator}/>
    <div className={styles.linksArea}>
      <div className={styles.identity}><Link href="/" className={styles.footerLogo}>IOJH<span>.</span></Link><p>{t('identity')}</p><p>{t('tagline')}</p><Link href="/contact" className={styles.contactLink}>{t('contact')} <ArrowUpRight size={16}/></Link></div>
      <div className={styles.linkGrid}>
       {groups.map((group)=><div className={styles.linkGroup} key={group.key}>
         <h3>{t(`groups.${group.key}`)}</h3>
         <div className={styles.desktopLinks}>{group.links.map(([label,path])=><Link key={path} href={path}>{t(label)}</Link>)}</div>
         <details className={styles.mobileLinks}><summary>{t(`groups.${group.key}`)}</summary><div>{group.links.map(([label,path])=><Link key={path} href={path}>{t(label)}</Link>)}</div></details>
       </div>)}
      </div>
    </div>
    <div className={styles.bottom}>
      <span>© {new Date().getFullYear()} IOJH. {t('rights')}</span>
      <span className={styles.previewDisclaimer}>{t('legal')}</span>
      <a href="#main-content" className={styles.backToTop}>{t('backTop')} <ArrowUp size={15}/></a>
    </div>
  </div>
 </footer>;
}
