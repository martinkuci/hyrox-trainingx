# Aktuální úkol

## Feature větev

`feature/professional-ux-phase-1`

## Cíl změny

Zahájit první produktovou fázi profesionálního UX novým dashboardem „Dnes“ a jasnou pěti-sekční mobilní navigací. Uživatel má během několika sekund poznat, co má dnes trénovat, jak probíhá jeho týden a jak se dostane k nejbližší další akci.

## Rozsah prvního releasu

- přepracovat domovskou obrazovku na mobilní dashboard „Dnes“,
- zobrazit aktuální den, týdenní plán a stav jednotlivých dnů,
- zvýraznit dnešní naplánovaný trénink jednou dominantní akcí,
- zobrazit fázi a průběh aktivního programu, pokud existuje,
- zobrazit stručné doporučení podle posledního RPE bez zdravotních tvrzení,
- sjednotit hlavní navigaci na Dnes / Plán / Trénovat / Výsledky / Profil,
- nahradit emoji navigaci konzistentními vektorovými ikonami a viditelnými popisky,
- zavést základní vizuální tokeny pro plochy, linky, akcent a focus stav,
- zachovat existující URL, runner, plánování, historii a lokální data.

## Akceptační kritéria

- domovská obrazovka má jednu jednoznačnou primární akci,
- aktuální den je v týdenním přehledu rozpoznatelný i bez samotné barvy,
- dokončený, naplánovaný, vynechaný a volný den mají odlišný textový nebo ikonový stav,
- pokud dnes není trénink, dashboard nabídne nejbližší smysluplnou akci,
- navigace má pět pojmenovaných položek a dotykové cíle alespoň 44 px,
- na šířce 320 px nevzniká horizontální scroll ani překrytí navigací,
- načítání, prázdný stav a stav s daty jsou čitelné,
- uložené šablony, výsledky, programy a kalendář zůstanou beze změny,
- lint a produkční build projdou.

## Následující release v rámci fáze 1

- rychlé logování vah, kol, času a RPE během tréninku,
- automatické obnovení rozpracovaného tréninku,
- offline stav a srozumitelná synchronizační zpětná vazba,
- rozšíření kalendáře o rychlé přesuny a zkrácené varianty tréninku.

## Mimo rozsah tohoto releasu

- Apple Health, Health Connect, Garmin a Strava,
- readiness z biometrických dat,
- generování nového programu pomocí AI,
- placené funkce a sociální feed,
- sloučení do `main` bez uživatelského otestování.
