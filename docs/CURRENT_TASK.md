# Aktuální úkol

## Feature větev

`agent/data-backup-2c`

## Cíl změny

Umožnit sportovci stáhnout úplnou zálohu lokálních tréninkových dat a bezpečně ji obnovit na stejném nebo jiném zařízení. Obnova musí být srozumitelná na telefonu, před zápisem ukázat obsah souboru a nikdy nepřepsat data po chybě validace.

## Rozsah releasu 2C

- exportovat jeden verzovaný JSON soubor se šablonami, kalendářem, programy, týdenními plány a výsledky,
- přijmout novou obálku zálohy i starší přímý export objektu `hyrox-data-v1`,
- před obnovou ověřit formát, podporovanou verzi a základní strukturu všech kolekcí,
- před potvrzením zobrazit datum zálohy a počty uložených položek,
- data nahradit až po výslovném potvrzení uživatele,
- po obnově vyvolat běžný datový event, aby se UI i volitelný cloud aktualizovaly stejnou cestou jako po jiné lokální změně,
- umístit export a obnovu na obrazovku Profil / Účet a cloud,
- zachovat formát lokálního úložiště `hyrox-data-v1` a zpětnou kompatibilitu starších dat.

## Akceptační kritéria

- export neobsahuje přihlašovací tokeny, hesla, cloudový stav ani obrázky importovaných výsledků,
- prázdná i naplněná data lze exportovat a znovu obnovit,
- poškozený JSON, cizí formát, nepodporovaná verze nebo chybějící kolekce nezmění aktuální data,
- soubor větší než 5 MB je odmítnut před načtením,
- obnova nepokračuje bez samostatného potvrzení nahrazení aktuálních dat,
- stav úspěchu a chyby je čitelný a oznámený přes `aria-live`,
- ovládání je použitelné od šířky 320 px bez horizontálního scrollu,
- lint, TypeScript, produkční build a cílené testy zálohovací logiky projdou.

## Mimo rozsah 2C

- slučování dvou rozdílných záloh po jednotlivých položkách,
- export aktivně rozpracovaného tréninku,
- automatické plánované zálohy a historie více obnov,
- migrace na nový datový model,
- biometrická data a integrace třetích stran.
