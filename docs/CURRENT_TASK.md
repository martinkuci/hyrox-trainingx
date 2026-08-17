# Aktuální úkol

## Feature větev

`agent/release-fixes-3a`

## Cíl změny

Odstranit dvě chyby nalezené při ověření fáze 3A: ruční potvrzování časovaného odpočinku ve vícekolových blocích a chybný prázdný stav kalendáře programu. Současně musí být v kalendáři na první pohled zřejmé, který trénink je vybraný pro přesun.

## Rozsah opravy 3A

- rozpoznat časovaný odpočinek v manuálním vícekolovém bloku,
- odpočinek automaticky odpočítat a po vypršení přejít na další kolo,
- zachovat možnost odpočinek přeskočit, pozastavit a bezpečně obnovit,
- nevkládat automatický odpočinek za poslední kolo,
- ponechat běžné manuální kroky beze změny,
- považovat naplánované jednotky s `programId` za existující program i při chybějícím nebo zastaralém záznamu programu,
- nezobrazovat falešnou hlášku „Zatím nemáš program“, pokud jsou jednotky programu v kalendáři,
- přidat jasný a přístupný stav vybraného tréninku v měsíčním kalendáři.

## Akceptační kritéria

- krok typu „60 s odpočinek“ se spustí jako automatický odpočet a nevyžaduje ruční potvrzení po doběhnutí,
- délka odpočinku se načte z údaje uloženého v kroku tréninku,
- po posledním pracovním kole se pokračuje hodnocením nebo dalším blokem bez dodatečného odpočinku,
- pauza, minimalizace a obnovení tréninku zachovají aktuální odpočet,
- starší tréninky bez časovaného odpočinku se chovají stejně jako dosud,
- kalendář nehlásí chybějící program, pokud obsahuje naplánované programové jednotky,
- vybraný trénink má viditelné označení, stav `aria-pressed` a srozumitelný popis pro čtečku,
- lint, TypeScript, produkční build a cílené testy projdou.

## Mimo rozsah

- obecný intervalový editor a nové typy bloků,
- automatické časování pracovních cviků v manuálním bloku,
- změna pořadí nebo obsahu existujících tréninkových programů,
- další funkce plánované po fázi 3A.
