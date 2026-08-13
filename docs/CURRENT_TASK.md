# Aktuální úkol

## Feature větev

`agent/training-insights-2b`

## Cíl změny

Proměnit uložené výsledky v jednoduchý a důvěryhodný přehled tréninkového vývoje. Sportovec má na obrazovce Výsledky rychle poznat pravidelnost, objem, vnímanou náročnost a změnu výkonu u skutečně opakovaných tréninků, aniž by aplikace vydávala zdravotní nebo trenérské diagnózy.

## Rozsah releasu 2B

- zobrazit souhrn posledních čtyř dokončených týdnů a aktuálního týdne,
- spočítat počet tréninků, celkový čas a průměrné RPE za posledních 28 dní,
- zobrazit týdenní aktivitu v čitelné textové i vizuální podobě,
- seskupit srovnatelné výsledky podle kódu tréninku nebo původní šablony,
- porovnat poslední dva výsledky stejného tréninku podle času a RPE,
- ukázat krátký časový trend nejvýše šesti posledních opakování,
- vyhodnotit soulad RPE s cílovým rozsahem pouze tam, kde jsou dostupná metadata,
- zachovat stávající chronologickou historii, detail mezičasů a import screenshotu,
- odvodit všechny insighty za běhu bez změny formátu `hyrox-data-v1`.

## Akceptační kritéria

- staré výsledky bez kódu, metadat, metrik nebo blokového hodnocení se zobrazí beze změny,
- dva různé tréninky se neporovnají jen kvůli podobnému názvu,
- procentní změna času se zobrazí pouze pro dva platné výsledky stejného tréninku,
- rychlejší a pomalejší čas je popsán textem a není rozlišen pouze barvou,
- průměry ignorují chybějící hodnoty a nevytvářejí `NaN` nebo nekonečno,
- týden bez tréninku zůstane v přehledu viditelný s nulovou hodnotou,
- zobrazení výslovně odděluje pozorovaná data od doporučení a neobsahuje zdravotní tvrzení,
- přehled je použitelný od šířky 320 px bez horizontálního scrollu,
- lint, TypeScript, produkční build a cílené testy analytické logiky projdou.

## Mimo rozsah 2B

- biometrická připravenost, zdravotní hodnocení a rehabilitační doporučení,
- automatické změny tréninkového programu podle výsledků,
- porovnávání různých tréninků pomocí odhadovaného skóre,
- predikce závodního času a AI coach,
- Apple Health, Health Connect, Garmin a Strava,
- změna ukládaného datového modelu výsledků.
