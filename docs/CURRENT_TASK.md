# Aktuální úkol

## Feature větev

`agent/enginn-brand-1b`

## Fáze

Enginn 1B — vizuální identita, ikony a terminologie.

## Cíl změny

Připravit schválený brand systém pro přechod z HYROX Training na Enginn, aniž by se v této fázi měnila produkční metadata, tréninková logika nebo uložená data. Výstup musí být použitelný jako jednoznačný podklad pro technický rebranding v následující fázi.

## Rozsah

- definovat správný zápis názvu, pozici značky, tón komunikace a hlavní produktový popis,
- navrhnout vektorovou značku a varianty pro navigaci, favicon, PWA a dokumentaci,
- zachovat současný tmavý vizuální základ a limetkovou akcentní barvu kvůli kontinuitě produktu,
- vytvořit terminologickou mapu pro nahrazení viditelných odkazů na HYROX,
- oddělit veřejné názvy od legacy technických identifikátorů, které musí zůstat kompatibilní,
- připravit mapu použití assetů pro následnou fázi technického rebrandingu,
- aktualizovat roadmapu po vydání stabilní verze 1.0.0.

## Akceptační kritéria

- existuje jednoznačný brand dokument s pravidly názvu, barev, loga a textového tónu,
- existuje samostatná vektorová značka, app ikona a horizontální wordmark,
- jsou připravené rastrové ikony 180, 192 a 512 px,
- značka je čitelná na tmavém i průhledném pozadí a nepoužívá chráněné prvky HYROX,
- terminologická mapa rozlišuje značku, obecný sportovní obsah a legacy datové identifikátory,
- žádný existující storage key, typ, ID tréninku ani formát zálohy se v této fázi nemění,
- lint, automatické testy a produkční build zůstávají beze změny funkční.

## Mimo rozsah

- změna viditelných textů a metadat produkční aplikace,
- změna názvu Vercel nebo Firebase projektu,
- připojení nové domény,
- přejmenování existujících tréninků a datových ID,
- změna generátoru programu, knihovny cviků nebo onboardingového toku,
- změna verze aplikace,
- sloučení do `main` bez uživatelského schválení návrhu identity.
