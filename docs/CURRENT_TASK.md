# Aktuální úkol

## Feature větev

`agent/adaptive-programming-3c`

## Cíl změny

Připravit bezpečné adaptivní doporučení pro další jednotku programu podle skutečného RPE a hodnocení dokončených bloků. Aplikace smí změnit naplánovaný trénink pouze po výslovném potvrzení uživatele.

## Rozsah fáze 3C

- vyhodnotit poslední platné výsledky proti cílovému RPE uloženému u šablony,
- použít hodnocení bloků jako doplňující vysvětlení, nikoli jako skrytý automatický zásah,
- při příliš vysoké zátěži navrhnout nejbližší lehčí variantu stejné kategorie,
- vyšší obtížnost navrhnout až po dvou po sobě jdoucích lehčích výsledcích stejné kategorie,
- měnit nejvýše jeden stupeň obtížnosti a preferovat stejnou skupinu progrese,
- doporučení vztáhnout pouze k budoucí naplánované jednotce stejného programu a kategorie,
- zobrazit původní a navržený trénink, důvod a dopad změny,
- umožnit návrh potvrdit nebo odmítnout,
- uložit rozhodnutí k výsledku, aby se stejný návrh neopakoval,
- zachovat ručně upravené a zkrácené jednotky bez automatického přepsání.

## Akceptační kritéria

- doporučení je deterministické a lze ho otestovat bez přístupu k síti,
- jeden nadměrně těžký výsledek může vyvolat návrh na odlehčení,
- jeden lehký výsledek sám o sobě nezvýší obtížnost,
- doporučení nikdy nezmění datum, čas, frekvenci ani pořadí programu,
- bez vhodné alternativy aplikace vysvětlí doporučení, ale nenabídne neplatnou změnu,
- potvrzení změní pouze cílovou naplánovanou jednotku a zachová její původní šablonu pro obnovu,
- odmítnutí ponechá plán beze změny,
- starší výsledky bez adaptivního rozhodnutí zůstanou platné,
- ovládání je čitelné a dosažitelné na telefonu,
- lint, TypeScript, produkční build a cílené testy projdou.

## Mimo rozsah

- změna termínů, počtu tréninků nebo délky programu,
- zdravotní doporučení, diagnostika a práce s únavou podle biometrických údajů,
- automatické provedení změny bez potvrzení uživatele,
- generování nové šablony mimo existující knihovnu,
- více současně čekajících adaptivních návrhů.
