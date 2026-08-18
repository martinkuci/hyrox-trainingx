# Aktuální úkol

## Feature větev

`agent/release-readiness-5a`

## Cíl změny

Připravit jednoznačnou a opakovatelnou release kontrolu před verzí 1.0. Vývojář i GitHub CI musí jedním příkazem ověřit lint, všechny automatické testy a produkční build; ruční mobilní kontrola musí mít společný checklist a jasná pravidla pro blokování vydání.

## Rozsah fáze 5A

- zavést společný `npm test`, který spustí všechny testovací soubory projektu,
- zavést jediný příkaz `npm run release:check` pro lint, testy a produkční build,
- používat stejný release příkaz v GitHub CI na pull requestech i podporovaných větvích,
- sepsat ruční mobilní checklist celého toku od naplánování po historii výsledku,
- zahrnout obnovu rozpracovaného tréninku, časované režimy, dřívější dokončení, kalendář, zálohu a obnovu dat,
- definovat závažnost chyb a podmínky, které vydání verze 1.0 blokují,
- aktualizovat roadmapu o navazující kroky 5B a 5C.

## Akceptační kritéria

- `npm test` spustí každý soubor `scripts/test-*.mjs` právě jednou,
- `npm run release:check` skončí chybou při selhání lintu, testu nebo produkčního buildu,
- GitHub CI používá stejný příkaz jako lokální release kontrola,
- CI se spouští pro pull request do `main` a pro změny na `main`, `feature/**` a `agent/**`,
- checklist rozlišuje automatické kontroly, ruční mobilní scénáře a kontrolu nasazení,
- kritická chyba, ztráta dat, bezpečnostní problém nebo neúspěšná automatická kontrola jednoznačně blokují vydání,
- dokumentace neprohlašuje verzi 1.0 za vydanou před dokončením ručního ověření,
- stávající data ani chování aplikace se touto fází nemění.

## Mimo rozsah

- samotné označení a vydání verze 1.0,
- změna uživatelského rozhraní nebo tréninkové logiky,
- automatizované end-to-end ovládání Safari na fyzickém iPhonu,
- opravy nově nalezených produktových chyb; ty budou řešeny samostatně ve fázi 5B,
- strukturovaný model vah a opakování z přeskočené fáze 4B,
- nové účty, sociální funkce, předplatné nebo veřejné žebříčky.
