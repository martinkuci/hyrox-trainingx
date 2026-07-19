# Aktuální úkol

## Feature větev

`feature/screenshot-result-import`

## Cíl změny

Doplnit první produkčně použitelný import výsledku ze screenshotu z Apple Watch nebo jiné fitness aplikace.

## Rozsah

- nahrání PNG, JPEG nebo WebP screenshotu,
- zmenšení obrázku v prohlížeči před odesláním,
- serverové rozpoznání údajů pomocí vision modelu,
- předvyplnění názvu tréninku, data, času, RPE a dostupných metrik,
- povinná kontrola a možnost opravy před uložením,
- uložení přes existující datovou vrstvu,
- zobrazení importovaných metrik v historii,
- jasný vstup do importu z historie výsledků.

## Akceptační kritéria

- API klíč je dostupný pouze na serveru přes `OPENAI_API_KEY`.
- Model lze změnit přes `OPENAI_VISION_MODEL`.
- Bez nakonfigurovaného klíče aplikace zobrazí srozumitelnou chybu a neuloží neúplný výsledek.
- Obrázek se neukládá do `localStorage`, Firestore ani repozitáře.
- Uživatel může upravit všechny rozpoznané hodnoty.
- Importovaný výsledek se objeví v historii a funguje s cloudovou synchronizací.
- TypeScript, lint a produkční build projdou.
- Na mobilním rozhraní nejsou duplicitní hlavičky ani kolize s navigací.

## Mimo rozsah

- dlouhodobé ukládání screenshotů,
- automatické párování všech typů obrazovek bez kontroly uživatele,
- dávkový import,
- zdravotní doporučení založená na tepu nebo kaloriích.
