# Aktuální úkol

## Feature větev

`agent/calendar-program-changes-1c`

## Cíl změny

Umožnit bezpečně upravovat rozběhnutý tréninkový plán přímo v kalendáři. Sportovec může přesunout jednu jednotku nebo celý zbývající program, vynechat trénink a zvolit kratší příbuznou variantu bez ztráty vazby na program.

## Rozsah releasu 1C

- přesunout jednu plánovanou jednotku na jiné datum,
- přesunout vybranou jednotku a všechny následující plánované jednotky stejného programu,
- provést hromadný posun atomicky a zachovat pořadí i rozestupy programu,
- před uložením odhalit kolize s jinými naplánovanými tréninky,
- při kolizi nabídnout bezpečný nejbližší volný termín,
- označit jednotku jako vynechanou a umožnit její návrat do plánu,
- nabídnout kratší trénink ze stejné progresní řady nebo stejné kategorie,
- zachovat informaci o původně naplánované šabloně při použití kratší varianty,
- zobrazit plánované, dokončené i vynechané jednotky v jednom programovém kalendáři,
- sjednotit mobilní detail jednotky, stavy a zpětnou vazbu s aktuálním designem aplikace.

## Akceptační kritéria

- změna jednoho tréninku nepřepíše jinou jednotku bez výslovného rozhodnutí,
- hromadný posun se uloží jedním zápisem a nemůže zůstat napůl provedený,
- hromadný posun zachová relativní rozestupy a pořadí všech přesouvaných jednotek,
- dokončené jednotky se hromadným posunem nemění,
- při kolizi aplikace změnu nejdřív zastaví a srozumitelně vysvětlí další možnost,
- vynechaná jednotka zůstane viditelná a započítaná ve statistikách programu,
- kratší varianta je vždy kratší než původní a tematicky příbuzná,
- původní varianta se dá jedním krokem obnovit,
- stará uložená data bez informace o původní šabloně se načtou beze změny,
- kalendář je použitelný od šířky 320 px a všechny akce mají dotykově bezpečnou velikost,
- lint, TypeScript, produkční build a cílené scénáře plánovací logiky projdou.

## Mimo rozsah 1C

- editace struktury už uloženého tréninkového programu,
- automatická regenerace programu podle vynechaných výsledků,
- vzdálené zamykání souběžných úprav na více zařízeních,
- integrace externích kalendářů,
- Apple Health, Health Connect, Garmin a Strava.
