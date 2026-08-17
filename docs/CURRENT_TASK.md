# Aktuální úkol

## Feature větev

`agent/structured-workout-modes-3b`

## Cíl změny

Převést hlavní intervalové formáty na nativní režimy tréninku. Délka práce, odpočinku a počet kol mají být uložené přímo v datech bloku, aby přehrávač nemusel jejich význam odvozovat z volného textu. Starší manuální a EMOM tréninky musí zůstat funkční.

## Rozsah fáze 3B

- přidat nativní bloky `For Time`, interval, `TABATA` a `AMRAP`,
- zachovat existující manuální a EMOM bloky,
- ukládat počet kol a délku práce/odpočinku jako samostatná číselná pole,
- ve `For Time` ponechat pracovní cviky na ruční potvrzení a odpočinek mezi koly odpočítávat automaticky,
- v intervalu a TABATĚ automaticky střídat čas práce a odpočinku bez odpočinku po posledním kole,
- v AMRAP odpočítat celý blok a zobrazit sestavu, která se opakuje dokola,
- doplnit režimy do mobilního editoru, importu a zálohy dat,
- zachovat pauzu, minimalizaci, obnovení a historii výkonu,
- ponechat rozpoznání časovaného odpočinku z textu pouze jako kompatibilní zálohu pro starší manuální tréninky.

## Akceptační kritéria

- staré bloky `manual` a `emom` se přehrají beze změny,
- nové režimy nepoužívají textový odhad délky práce ani odpočinku,
- `For Time` vloží automatický odpočinek pouze mezi koly,
- interval a TABATA střídají pracovní a odpočinkové úseky a samy postupují,
- EMOM dál střídá cviky po minutách,
- AMRAP má jeden odpočet celého bloku a přehled opakované sestavy,
- karta „Následuje“ zobrazuje název i cílový počet opakování, vzdálenost, váhu nebo tempo,
- editor je použitelný na mobilu a u časových údajů vždy uvádí jednotku,
- import a obnova zálohy validují všechny podporované režimy,
- pauza, minimalizace a obnovení zachovají stav časovaných režimů,
- historie použije uložený název a detail i pro systémové kroky režimů,
- lint, TypeScript, produkční build a cílené testy projdou.

## Mimo rozsah

- samostatné počítadlo dokončených kol uvnitř AMRAP,
- vnořené nebo kombinované režimy uvnitř jednoho bloku,
- automatická změna programu podle výkonu; ta patří do fáze 3C,
- přepisování již uložených starších tréninků.
