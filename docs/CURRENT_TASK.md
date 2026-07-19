# Aktuální úkol

## Feature větev

`feature/training-catalog-v1`

## Cíl změny

Naplnit aplikaci kompletním testovacím katalogem HYROX tréninků a upravit generátor tak, aby vytvářel smysluplné 4-, 8- a 12týdenní programy.

## Rozsah

- doplnit nejméně 18 škálovatelných tréninkových šablon,
- pokrýt všechny kategorie a úrovně obtížnosti používané aplikací,
- přidat cíle, RPE, očekávaný čas, běžecké zaměření a sledované metriky,
- zachovat stabilní identifikátory šablon pro kalendář, historii a cloudovou synchronizaci,
- jednorázově doplnit nový vestavěný katalog i uživatelům se stávajícími lokálními daty,
- zachovat uživatelské tréninky, výsledky, programy a naplánované jednotky,
- zlepšit výběr tréninků podle fáze programu, cíle a úrovně,
- omezit opakování stejné šablony v jednom týdnu,
- zajistit odlehčení v deload týdnech a snížení objemu v taper týdnu.

## Akceptační kritéria

- nová instalace zobrazí kompletní katalog bez ručního importu,
- stávající instalace katalog jednorázově doplní bez smazání uživatelských dat,
- generátor vytvoří 4-, 8- i 12týdenní program pro 1 až 5 tréninků týdně,
- všechny vygenerované jednotky mají existující šablonu,
- úroveň 1 nepoužije trénink obtížnosti 2 nebo 3,
- deload a taper mají nižší náročnost než hlavní specifická fáze,
- v jednom týdnu se stejná šablona neopakuje, pokud existuje vhodná alternativa,
- jednotlivé šablony lze otevřít a spustit v existujícím runneru,
- lint, produkční build a Vercel preview projdou,
- na mobilu nevzniknou duplicitní hlavičky ani kolize s pevnou navigací.

## Výchozí testovací scénář

- cíl: příprava na HYROX,
- úroveň: pokročilý,
- délka: 12 týdnů,
- frekvence: 3 tréninky týdně,
- dny: pondělí, středa a sobota.

## Mimo rozsah

- zdravotní nebo rehabilitační doporučení,
- automatické určování soutěžní váhy bez volby uživatele,
- placené nebo trenérské funkce,
- sloučení této feature větve do `main` bez uživatelského otestování.
