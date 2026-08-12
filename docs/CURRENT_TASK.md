# Aktuální úkol

## Feature větev

`agent/professional-ux-all-screens`

## Cíl změny

Rozšířit vizuální jazyk schváleného dashboardu „Dnes“ do všech hlavních obrazovek aplikace. Uživatel má v celé aplikaci vnímat stejnou hierarchii, navigaci, povrchy, typografii, akce a stavové vzory, aniž by se změnilo chování nebo formát uložených dat.

## Rozsah releasu

- zavést sdílený mobilní shell, hlavičku, karty, sekční nadpisy, prázdné stavy a tlačítkové styly,
- sjednotit obrazovky Plán, Trénovat, Výsledky a Profil s dashboardem Dnes,
- sjednotit návazné obrazovky kalendáře, programů, editoru, importu a detailu tréninku,
- zachovat pěti-sekční dolní navigaci a správně zvýraznit aktivní sekci i na podstránkách,
- odstranit nekonzistentní emoji navigaci a nahodile použité barvy tam, kde vyjadřují pouze dekoraci,
- sjednotit formuláře, prázdné stavy, potvrzovací dialogy a pevné akční lišty,
- zachovat existující URL, runner, plánování, historii, synchronizaci a lokální data,
- upravit rozvržení mobile-first a zabránit překrytí obsahu sticky prvky.

## Akceptační kritéria

- všechny hlavní trasy používají stejný grafitový povrch, akcent, typografickou hierarchii a rozteče,
- každá obrazovka má jeden jasný název, stručný kontext a nejvýše jednu dominantní primární akci,
- spodní navigace správně mapuje podstránky na Dnes / Plán / Trénovat / Výsledky / Profil,
- karty, formuláře, štítky, prázdné stavy a dialogy mají jednotné interakční stavy,
- na šířce 320 px nevzniká horizontální scroll ani překrytí navigací,
- stav načítání, chyba, prázdný stav a úspěch jsou čitelné a nejsou rozlišeny pouze barvou,
- dotykové cíle hlavních akcí mají alespoň 44 px,
- existující uložená data a funkční toky zůstanou zpětně kompatibilní,
- lint, TypeScript a produkční build projdou.

## Mimo rozsah tohoto releasu

- změny datového modelu tréninku nebo výsledků,
- Apple Health, Health Connect, Garmin a Strava,
- biometrická připravenost a adaptivní plán,
- nové placené funkce, sociální feed nebo AI coach,
- automatické počítání opakování.

## Následující release v rámci fáze 1

- rychlé logování vah, kol, času a RPE během tréninku,
- automatické obnovení rozpracovaného tréninku,
- offline stav a srozumitelná synchronizační zpětná vazba,
- rozšíření kalendáře o rychlé přesuny a zkrácené varianty tréninku.
