# Aktuální úkol

## Feature větev

`agent/personal-benchmarks-4c`

## Cíl změny

Zpřehlednit osobní benchmarky u opakovaných tréninků. Aplikace ukáže nejkratší zaznamenaný čas, poslední pokus a počet platných pokusů pouze tehdy, když jsou výsledky skutečně srovnatelné.

## Rozsah fáze 4C

- seskupit výsledky podle kódu a verze tréninku; bez těchto údajů použít pouze stejnou šablonu,
- vytvořit benchmark až po nejméně dvou platných dokončeních stejné jednotky,
- zobrazit nejkratší zaznamenaný čas, datum, poslední čas a počet pokusů,
- rozlišit nový nejkratší čas, vyrovnání nejkratšího času a výsledek nad osobním minimem,
- zvýraznit benchmarkový výsledek také v příslušné kartě historie,
- zachovat stávající trendy 4A a srovnání posledních pokusů,
- vysvětlit, že čas nezohledňuje změnu zátěže, podmínek ani provedení,
- nic nezapisovat do výsledků ani programu.

## Akceptační kritéria

- benchmark je deterministický a testovatelný bez sítě,
- různé verze stejného kódu se nespojí,
- stejný název bez shodného identifikátoru výsledky nespojí,
- neplatný čas nebo datum se do benchmarku nezapočítá,
- při shodném čase se zobrazí vyrovnání, nikoli nový rekord,
- starší výsledky bez kódu a verze lze porovnat jen v rámci stejného ID šablony,
- pořadí benchmarků vychází z data posledního platného pokusu,
- rozhraní zůstane čitelné a ovladatelné na telefonu,
- lint, TypeScript, produkční build a cílené testy projdou.

## Mimo rozsah

- zdravotní nebo výkonnostní diagnóza a predikce výsledku závodu,
- automatická změna programu,
- porovnávání rozdílných verzí, zátěží nebo pouze podobně pojmenovaných tréninků,
- strukturovaný model vah a opakování z přeskočené fáze 4B,
- sdílení benchmarků, veřejné žebříčky a porovnávání s ostatními uživateli.
