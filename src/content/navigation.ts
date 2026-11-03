export type MenuEntry = {label: string; href: string; hint?: string};
export type MenuGroup = {key: string; href: string; entries: MenuEntry[]};
// Labels here are message keys; all URLs use locale-neutral approved English slugs.
export const navigation: MenuGroup[] = [
 {key: 'services', href: '/services', entries: [
  {label:'overview',href:'/services'}, {label:'publicationSupport',href:'/services/publication-support'},
  {label:'journalDevelopment',href:'/services/journal-development'},
  {label:'sectoralResearch',href:'/services/sectoral-research-knowledge'},
  {label:'dataAnalysis',href:'/services/data-analysis-manuscript'}
 ]},
 {key:'academy',href:'/academy',entries:[
  {label:'overview',href:'/academy'}, {label:'courses',href:'/academy/courses'},
  {label:'liveCourses',href:'/academy/courses?format=live'},
  {label:'recordedCourses',href:'/academy/courses?format=recorded'},
  {label:'mentorship',href:'/academy/mentorship'}
 ]},
 {key:'publisher',href:'/publisher',entries:[{label:'books',href:'/publisher'}]},
 {key:'yrdp',href:'/yrdp',entries:[{label:'eligibility',href:'/yrdp'},{label:'apply',href:'/yrdp/apply'}]},
 {key:'publish',href:'/publish-with-us',entries:[
  {label:'overview',href:'/publish-with-us'}, {label:'journals',href:'/journals'},
  {label:'guide',href:'/publish-with-us/guide'}, {label:'finder',href:'/journal-finder'}
 ]},
 {key:'about',href:'/about',entries:[
  {label:'overview',href:'/about'}, {label:'team',href:'/team'},
  {label:'projects',href:'/projects'}, {label:'blog',href:'/blog'}
 ]}
];
