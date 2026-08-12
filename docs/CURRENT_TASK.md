# Aktuální úkol

## Feature větev

`agent/workout-logging-1b`

## Cíl změny

Umožnit během tréninku rychle zaznamenat skutečný výkon k právě prováděnému kroku a po dokončení jej bezpečně uložit spolu s automatickým časem. Zápis musí být použitelný jednou rukou, přežít reload i minimalizaci a zachovat kompatibilitu se všemi dosavadními checkpointy a výsledky.

## Rozsah releasu 1B

- přidat volitelný strukturovaný záznam výkonu pro konkrétní blok, krok a kolo,
- zapisovat váhu v kg, počet opakování, dokončená kola, RPE 1–10 a krátkou poznámku,
- čas kroku nadále snímat automaticky do mezičasů,
- nabídnout rychlý zápis přímo v aktivním runneru bez opuštění obrazovky,
- průběžné záznamy ukládat do stejného lokálního checkpointu jako čas a postup,
- obnovit záznamy po reloadu, návratu z minimalizace i po pádu,
- přenést záznamy do dokončeného výsledku a zobrazit je v historii,
- v souhrnu ukázat základní porovnání plánovaného zadání a skutečnosti,
- ponechat dosavadní souhrnná pole RPE, váhy a poznámka pro staré výsledky a import screenshotu.

## Akceptační kritéria

- starý výsledek bez strukturovaných záznamů se načte beze změny,
- starý checkpoint bez strukturovaných záznamů lze obnovit,
- záznam je jednoznačně svázaný s blokem, krokem a kolem,
- prázdný záznam se neukládá a neplatné hodnoty checkpoint nerozbijí,
- reload a minimalizace zachovají vyplněné hodnoty,
- dokončený výsledek obsahuje automatické mezičasy i ručně zadaný výkon,
- historie zobrazí výkon čitelně i u opakovaných cviků,
- rozhraní zůstane použitelné na šířce 320 px a ovladatelné klávesnicí,
- lint, TypeScript, produkční build a cílené scénáře kompatibility projdou.

## Mimo rozsah 1B

- změna schématu hlavního uložiště z verze 1,
- automatické rozpoznání použitého náčiní nebo jednotek,
- vzdálená synchronizace aktivního checkpointu mezi zařízeními,
- rychlé přesuny a zkrácené varianty tréninků v kalendáři,
- Apple Health, Health Connect, Garmin a Strava.
