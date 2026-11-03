# IOJH homepage browser acceptance matrix

Recommended screen widths: **320, 390, 768, 1024, 1440px**. Repeat every distinctive layout in **EN and BN** under **light and dark** themes.

1. Desktop: two-row masthead at sufficient width; no collision, all six destinations visible; menu toggles separate from destination links.
2. Compact: 64px brand/cart/menu, dialog scroll is isolated, Escape/Close restores focus, submenus accessible without hover.
3. Hero H1 and CTAs fully visible; illustration has no fabricated statistics; mobile copy comes before artwork.
4. Four services remain readable without hover. Selection updates the detail panel on desktop. Linked detail pages explicitly disclose preview state.
5. Work contains exactly two **illustrative practice areas**, no fake case studies or metric counters.
6. Academy, YRDP, Finder, Publisher and editorial teasers are explicitly not live transactional features.
7. Footer includes Blog, Careers, Contact, four group navigations and an honest disabled newsletter explanation.
8. EN/BN translated copy is readable; mix of Bangla text and English source titles keeps proper shaping. No accidental clipping at 200% zoom.
9. Tab order matches visible order. Focus ring is visible on the deep green footer and in both themes.
10. Device setting Reduce Motion makes all transitions instant; no hidden main content without JavaScript.
11. `document.documentElement.scrollWidth <= window.innerWidth` at all widths.
12. Verify locale switch retains the current *route*. Future filters/unsaved forms require additional handling at their implementation packet.
13. Inspect Lighthouse & Web Vitals only after running the production build. No performance score is asserted in this ZIP.
