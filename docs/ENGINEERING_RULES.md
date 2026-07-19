# Engineering rules

## Rozsah práce

- Vždy pracuj pouze v repozitáři `martinkuci/hyrox-trainingx`.
- Změny prováděj pouze na feature větvi určené v `docs/CURRENT_TASK.md`.
- Nezahrnuj nesouvisející změny.

## Povinné čtení před úpravou

Před první úpravou v každém úkolu načti:

1. `AGENTS.md`
2. `docs/PROJECT.md`
3. `docs/CURRENT_TASK.md`
4. `docs/ENGINEERING_RULES.md`

Pokud některý soubor chybí, nezahajuj implementaci. Nejprve chybějící pravidla doplň nebo si vyžádej rozhodnutí.

## Bezpečný zápis přes GitHub

Před každým zápisem si explicitně urč:

- operaci `create_file` nebo `update_file`,
- cílovou cestu,
- feature větev,
- aktuální blob SHA pro `update_file`,
- celý nový obsah souboru,
- stručnou commit message.

Pravidla zápisu:

- nikdy neposílej zápis bez commit message,
- při `update_file` vždy používej SHA z bezprostředně předcházejícího načtení stejného souboru a stejné větve,
- po každém zápisu soubor znovu načti z cílové větve,
- změnu považuj za dokončenou až po ověření obsahu a nového SHA,
- neprováděj paralelní zápisy do stejného souboru.

## Commity

- Jeden commit představuje jeden malý logický krok.
- Commit message musí popsat výsledek, ne použitý nástroj.
- Mezi logické kroky patří například: dokumentace úkolu, datový typ, API endpoint, jedna UI obrazovka nebo propojení existující obrazovky.
- Nezapisuj tajné klíče, tokeny, osobní data ani screenshoty do historie Git.

## Kontrola kódu

- Respektuj `AGENTS.md` a dokumentaci verze Next.js použité v projektu.
- Zachovej zpětnou kompatibilitu uložených dat.
- Automaticky rozpoznaná data vždy validuj na serveru i před uložením.
- Chyby zobrazuj uživatelsky srozumitelně; citlivé detaily neposílej do klienta.
- API klíče smějí být pouze v serverových environment variables.

## Kontrola UI

Po každé změně UI ověř:

- zda nevznikla duplicitní hlavička,
- konzistenci horizontálního odsazení,
- bezpečné odsazení na telefonu,
- zda pevná nebo sticky navigace nepřekrývá obsah,
- ovládání dotykem a klávesnicí,
- čitelnost stavů načítání, chyby, prázdného stavu a úspěchu.

## Ověření a nasazení

Před dokončením spusť dostupné kontroly v tomto pořadí:

1. lint,
2. TypeScript nebo produkční build,
3. cílenou kontrolu změněného toku,
4. kontrolu rozdílu proti cílové větvi.

Po pushi nebo GitHub zápisu sleduj dostupné CI kontroly a stav Vercel nasazení. Nikdy netvrď, že změna nebo nasazení proběhly, dokud to není ověřeno.
