# Aktuální úkol

## Feature větev

`feature/screenshot-result-import-rebase`

## Cíl změny

Přenést otestovaný import výsledků ze screenshotu na aktuální `main` po dokončení společné horní a spodní navigace.

## Rozsah

- zachovat společnou pevnou hlavičku a spodní navigaci z `main`,
- přenést lokální OCR a volitelnou analýzu přes OpenAI,
- zachovat kontrolu a ruční opravu rozpoznaných hodnot,
- ukládat pouze potvrzená strukturovaná data, nikoli screenshot,
- zachovat zobrazení importovaných metrik v historii,
- zachovat mobilní opravy včetně formulářů bez automatického zoomu v Safari.

## Akceptační kritéria

- dodaný Apple Fitness screenshot načte čas, aktivní kalorie a průměrný tep 151 BPM,
- hodnota osy grafu se neuloží jako maximální tep,
- import je dostupný z historie výsledků,
- existující lokální i cloudová data zůstanou kompatibilní,
- na mobilu nejsou duplicitní hlavičky ani kolize s pevnou navigací,
- lint, TypeScript nebo produkční build a Vercel preview projdou.

## Mimo rozsah

- změny tréninkového katalogu a generátoru programu,
- automatické ukládání obrázků,
- dávkový import.
