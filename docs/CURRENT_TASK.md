# Aktuální úkol

## Feature větev

`agent/workout-logging-1b`

## Cíl změny

Zjednodušit mobilní workout runner tak, aby aktivní krok včetně hlavních ovládacích prvků zůstal bez posouvání. Minimalizace se přesune do značky HYROX, trénink půjde kdykoli korektně dokončit a subjektivní zpětná vazba se zadá jedinou pětistupňovou volbou až po celém bloku.

## Rozsah releasu 1B

- odstranit formulář výkonu z jednotlivých úseků,
- po dokončení celého bloku nabídnout pět úrovní od „Příště ubrat“ po „Brnkačka“,
- ukládat hodnocení bloků do stejného lokálního checkpointu jako čas a postup,
- obnovit hodnocení po reloadu, návratu z minimalizace i po pádu,
- minimalizovat trénink kliknutím na středovou značku HYROX bez dalšího tlačítka,
- umožnit dokončit trénink z aktuální rozpracované části a uložit dosavadní čas i mezičasy,
- zkomprimovat aktivní runner pro běžnou mobilní výšku bez vertikálního scrollu,
- zjednodušit přehled bloku a výsledný souhrn do aktuálního vizuálního jazyka,
- přenést hodnocení bloků do dokončeného výsledku a zobrazit je v historii,
- v souhrnu ukázat základní porovnání plánovaného času a zátěže proti skutečnosti,
- ponechat dosavadní souhrnná pole RPE, váhy a poznámka pro staré výsledky a import screenshotu.

## Akceptační kritéria

- starý výsledek bez hodnocení bloků se načte beze změny,
- starý checkpoint bez hodnocení bloků lze obnovit,
- hodnocení je jednoznačně svázané s blokem a používá pouze úroveň 1–5,
- aktivní krok, časovač, pauza a hlavní akce se na běžném telefonu vejdou bez posunu,
- kliknutí na HYROX trénink pozastaví, uloží a minimalizuje,
- předčasné dokončení uloží dosavadní čas a hotové úseky a otevře souhrn,
- reload a minimalizace zachovají hodnocení dokončených bloků,
- historie zobrazí hodnocení u správných bloků,
- rozhraní zůstane použitelné na šířce 320 px a ovladatelné klávesnicí,
- lint, TypeScript, produkční build a cílené scénáře kompatibility projdou.

## Mimo rozsah 1B

- změna schématu hlavního uložiště z verze 1,
- podrobný zápis vah a opakování po jednotlivých úsecích,
- vzdálená synchronizace aktivního checkpointu mezi zařízeními,
- rychlé přesuny a zkrácené varianty tréninků v kalendáři,
- Apple Health, Health Connect, Garmin a Strava.
