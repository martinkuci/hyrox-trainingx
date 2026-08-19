# Aktuální úkol

## Feature větev

`agent/enginn-brand-1b`

## Fáze

Enginn 1B — zapojení schválené identity do aplikace.

## Cíl změny

Zapojit schválený brand systém Enginn do veřejného rozhraní, metadat a instalované PWA. Odstranit veřejné odkazy na původní značku a současně zachovat kompatibilitu uložených dat, záloh a historických výsledků.

## Rozsah

- zobrazit symbol a wordmark Enginn v hlavní navigaci, onboardingu, aktivním tréninku a souhrnu,
- změnit metadata, manifest, favicon a PWA ikony na Enginn,
- přepsat veřejné texty podpory, programu, importu a vestavěného katalogu na obecný hybridní trénink,
- změnit veřejné kódy vestavěných tréninků z `HYX` na `EGN`,
- povýšit katalog tak, aby se nové veřejné názvy propsaly do neupravených vestavěných šablon,
- zachovat legacy storage keys, TypeScript názvy, ID šablon, Firebase konfiguraci a formát zálohy,
- aktualizovat dokumentaci a automatické testy.

## Akceptační kritéria

- veřejné rozhraní, metadata a PWA používají pouze značku Enginn,
- nové logo je čitelné v horní navigaci i aktivním tréninku a zachovává funkci minimalizace,
- noví uživatelé i neupravené vestavěné šablony dostanou obecné hybridní názvosloví,
- uživatelsky upravené šablony, historické výsledky a zálohy se nepřepisují,
- žádný existující storage key, typ, ID tréninku ani formát zálohy se nemění,
- lint, automatické testy a produkční build projdou.

## Mimo rozsah

- změna názvu Vercel nebo Firebase projektu,
- připojení nové domény,
- přejmenování legacy datových ID a historických výsledků,
- změna generátoru programu, knihovny cviků nebo onboardingového toku,
- změna verze aplikace,
- sloučení do `main` bez uživatelského otestování náhledu.
