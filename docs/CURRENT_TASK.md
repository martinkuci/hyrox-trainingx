# Aktuální úkol

## Feature větev

`agent/advanced-training-insights-4a`

## Cíl změny

Rozšířit výsledky o dlouhodobý, ale stále srozumitelný přehled skutečně uložených tréninků. Uživatel si zvolí období a uvidí změnu proti bezprostředně předcházejícímu stejně dlouhému období, rozložení podle typu tréninku a vývoj opakovaných jednotek.

## Rozsah fáze 4A

- nabídnout období 4, 8 a 12 týdnů,
- porovnat počet tréninků, celkový čas a průměrné RPE s předchozím stejně dlouhým obdobím,
- u každé metriky jasně rozlišit růst, pokles a nedostatek srovnávacích dat,
- zobrazit rozložení tréninků podle kategorie z uloženého metadata snapshotu nebo aktuální šablony,
- u kategorií uvést počet jednotek, celkový čas, průměrné RPE a soulad s cílovým RPE,
- zachovat dosavadní týdenní aktivitu a srovnání opakovaných tréninků,
- nepovažovat vyšší objem, nižší čas ani nižší RPE automaticky za lepší výsledek,
- zachovat výsledky bez metadat a starší uložená data.

## Akceptační kritéria

- výpočty jsou deterministické a testovatelné bez sítě,
- aktuální a předchozí období se nepřekrývají a mají stejnou délku,
- budoucí, neplatné a mimo období uložené výsledky neovlivní souhrn,
- chybějící nebo neplatné RPE se nezapočítá do průměru,
- výsledek bez kategorie zůstane v celkovém souhrnu a zobrazí se jako „Ostatní“,
- přepnutí období nezmění ani neuloží uživatelská data,
- rozhraní zůstane čitelné a ovladatelné na telefonu,
- lint, TypeScript, produkční build a cílené testy projdou.

## Mimo rozsah

- zdravotní hodnocení, diagnóza, predikce únavy nebo rizika zranění,
- automatická změna programu na základě statistik,
- nové ukládání biometrických údajů,
- strukturovaný model vah a opakování; ten patří do samostatné navazující fáze,
- sdílení výsledků, žebříčky a porovnávání s ostatními uživateli.
