'use client';

import {useEffect, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useTheme} from 'next-themes';
import {ArrowUpRight, ChevronDown, Globe2, Menu, Moon, ShoppingBag, Sun, UserRound, X} from 'lucide-react';
import {Link, usePathname} from '@/i18n/navigation';
import {navigation} from '@/content/navigation';
import styles from './site-header.module.css';

function Brand() {
 const t=useTranslations('Nav');
 return <Link href="/" className={styles.brand} aria-label={`IOJH — ${t('home')}`}>
  <span className={styles.brandSymbol} aria-hidden="true"><span/><span/><span/><span/></span>
  <span className={styles.brandWords}><strong>IOJH<span className={styles.brandPeriod}>.</span></strong><small>INTERNATIONAL ONLINE JOURNAL HUB</small></span>
 </Link>;
}


function ThemeToggle({compact = false}: {compact?: boolean}) {
  const {resolvedTheme, setTheme} = useTheme();
  const t = useTranslations('Nav');

  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={t('theme')}
      title={t('theme')}
      onClick={() =>
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
      }
    >
      <span className={styles.themeIcon} aria-hidden="true">
        <Sun
          className={styles.themeSun}
          size={19}
          strokeWidth={1.65}
        />
        <Moon
          className={styles.themeMoon}
          size={19}
          strokeWidth={1.65}
        />
      </span>

      {compact && (
        <span className={styles.mobileUtilityLabel}>
          {t('theme')}
        </span>
      )}
    </button>
  );
}


function LanguageToggle({mobile=false}: {mobile?: boolean}) {
 const locale=useLocale();const pathname=usePathname();const t=useTranslations('Nav');
 return <div className={mobile?styles.languagesMobile:styles.languages} aria-label={t('language')}>
  <Globe2 size={mobile?19:16} aria-hidden="true" strokeWidth={1.8}/>
  <Link href={pathname} locale="en" aria-current={locale==='en'?'page':undefined} className={locale==='en'?styles.languageActive:undefined}>EN</Link>
  <span aria-hidden="true">/</span>
  <Link href={pathname} locale="bn" aria-current={locale==='bn'?'page':undefined} className={locale==='bn'?styles.languageActive:undefined}>বাংলা</Link>
 </div>;
}

export function SiteHeader() {
 const t=useTranslations('Nav');
 const [openMenu,setOpenMenu]=useState<string|null>(null);
 const [drawerOpen,setDrawerOpen]=useState(false);
 const [drawerSubmenu,setDrawerSubmenu]=useState<string|null>(null);
 const rootRef=useRef<HTMLElement|null>(null);
 const dialogRef=useRef<HTMLDialogElement|null>(null);
 const menuButtonRef=useRef<HTMLButtonElement|null>(null);
 const dropdownTriggers=useRef<Record<string,HTMLButtonElement|null>>({});
 useEffect(()=>{
  function outside(e: PointerEvent){if(rootRef.current && !rootRef.current.contains(e.target as Node))setOpenMenu(null);}
  function key(e:KeyboardEvent){if(e.key==='Escape'&&openMenu){const old=openMenu;setOpenMenu(null);dropdownTriggers.current[old]?.focus();}}
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
  return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};
 },[openMenu]);
 useEffect(()=>{
  const dialog=dialogRef.current;
  if(!dialog)return;
  if(drawerOpen&&!dialog.open)dialog.showModal();
  if(!drawerOpen&&dialog.open)dialog.close();
  document.body.style.overflow=drawerOpen?'hidden':'';
  return ()=>{document.body.style.overflow='';};
 },[drawerOpen]);
 const closeDrawer=()=>{setDrawerOpen(false);setDrawerSubmenu(null);};
 const dropdowns=navigation.map((group)=>{
  const expanded=openMenu===group.key;
  return <div className={styles.navGroup} key={group.key}>
    <div className={styles.navGroupHead}>
      <Link href={group.href} onClick={()=>setOpenMenu(null)} className={styles.mainNavLink}>{t(group.key)}</Link>
      <button ref={el=>{dropdownTriggers.current[group.key]=el}} type="button" className={styles.chevronButton} aria-label={`${t(expanded?'collapse':'expand')}: ${t(group.key)}`} aria-expanded={expanded} aria-controls={`nav-${group.key}`} onClick={()=>setOpenMenu(expanded?null:group.key)}>
       <ChevronDown size={14} strokeWidth={1.8}/>
      </button>
    </div>
    <div id={`nav-${group.key}`} className={`${styles.dropdown} ${expanded?styles.dropdownOpen:''}`} aria-hidden={!expanded}>
      <div className={styles.dropdownEyebrow}>{t(group.key)} <span> / IOJH</span></div>
      {group.entries.map((entry)=><Link key={`${entry.href}-${entry.label}`} href={entry.href} tabIndex={expanded?0:-1} className={styles.dropdownItem} onClick={()=>setOpenMenu(null)}><span>{t(entry.label)}</span><ArrowUpRight size={15}/></Link>)}
    </div>
  </div>;
 });
 return <header ref={rootRef} className={styles.header}>
  <div className={`${styles.desktopMasthead} container`}>
   <div className={styles.mastheadTop}>
     <Brand/>
     <div className={styles.utilities}>
       <Link href="/contact" className={styles.contactLink}>{t('contact')} <ArrowUpRight size={13}/></Link>
       <span className={styles.utilityDivider}/>
       <LanguageToggle/>
       <span className={styles.utilityDivider}/>
       <ThemeToggle/>
       <Link href="/sign-in" className={styles.iconButton} aria-label={t('account')} title={t('account')}><UserRound size={19} strokeWidth={1.65}/></Link>
       <Link href="/cart" className={styles.iconButton} aria-label={t('cart')} title={t('cart')}><ShoppingBag size={19} strokeWidth={1.65}/></Link>
     </div>
   </div>
   <nav className={styles.navRow} aria-label="Primary navigation">{dropdowns}</nav>
  </div>
  <div className={`${styles.compactMasthead} container`}>
   <Brand/>
   <div className={styles.compactActions}>
      <Link href="/cart" className={styles.iconButton} aria-label={t('cart')}><ShoppingBag size={21}/></Link>
      <button type="button" ref={menuButtonRef} className={styles.menuButton} aria-label={t('menu')} aria-haspopup="dialog" onClick={()=>setDrawerOpen(true)}><Menu size={22}/><span className={styles.menuLabel}>{t('menu')}</span></button>
   </div>
  </div>
  <dialog ref={dialogRef} className={styles.mobileDialog} aria-label="IOJH navigation" onClose={()=>{setDrawerOpen(false);menuButtonRef.current?.focus();}}>
   <div className={styles.drawerTop}><span className={styles.drawerTitle}>IOJH <span>/ MENU</span></span><button type="button" className={styles.drawerClose} aria-label={t('closeMenu')} onClick={closeDrawer}><X size={23}/></button></div>
   <nav aria-label="Mobile navigation" className={styles.drawerNav}>
    {navigation.map((group)=>{
     const expanded=drawerSubmenu===group.key;
     return <div className={styles.drawerGroup} key={group.key}>
       <div className={styles.drawerGroupHead}><Link href={group.href} onClick={closeDrawer}>{t(group.key)}</Link><button type="button" aria-label={`${t(expanded?'collapse':'expand')}: ${t(group.key)}`} aria-expanded={expanded} aria-controls={`drawer-${group.key}`} onClick={()=>setDrawerSubmenu(expanded?null:group.key)}><ChevronDown size={19}/></button></div>
       {expanded && <div id={`drawer-${group.key}`} className={styles.drawerSubmenu}>{group.entries.map((entry)=><Link key={`${entry.href}-${entry.label}`} href={entry.href} onClick={closeDrawer}>{t(entry.label)}<ArrowUpRight size={15}/></Link>)}</div>}
      </div>;
    })}
   </nav>
   <div className={styles.drawerUtilities}><LanguageToggle mobile/><ThemeToggle compact/><Link href="/contact" onClick={closeDrawer}>{t('contact')} <ArrowUpRight size={16}/></Link><Link href="/sign-in" onClick={closeDrawer}>{t('account')} <UserRound size={16}/></Link></div>
   <div className={styles.drawerBottom}>IOJH / INTERNATIONAL ONLINE JOURNAL HUB</div>
  </dialog>
 </header>;
}
