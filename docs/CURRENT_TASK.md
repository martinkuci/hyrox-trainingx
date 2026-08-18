# Aktuální úkol

## Feature větev

`agent/release-1-0`

## Cíl změny

Připravit finálního kandidáta verze 1.0.0 po dokončené release bráně 5A. Závěrečná fáze spojí regresní ověření 5B s přípravou vydání 5C, aniž by měnila formát uložených dat nebo přidávala nový produktový rozsah.

## Rozsah závěrečné fáze 5B–5C

- spustit kompletní release gate a automatizovanou regresi hlavních veřejných tras,
- ověřit mobilní vykreslení, navigaci, formuláře a absenci frameworkového chybového překryvu,
- znovu ověřit bezpečný export a import dat automatickými testy,
- nastavit aplikační verzi na `1.0.0` v balíčku a sdílené konstantě,
- zobrazit číslo verze v nápovědě a připojit jej k připravenému e-mailu podpory,
- připravit release notes s rozsahem, známými omezeními a postupem bezpečné aktualizace,
- označit roadmapu jako release candidate; finální stav „released“ přijde až po sloučení a tagu,
- připravit draft pull request a Vercel Preview k poslednímu potvrzení.

## Akceptační kritéria

- `package.json`, `package-lock.json` a zobrazená verze se shodují na `1.0.0`,
- e-mail podpory obsahuje verzi aplikace bez změny uživatelovy zprávy,
- hlavní trasy `/`, `/plan`, `/workouts`, `/history`, `/account` a `/help` se načtou na mobilním viewportu,
- prohlížečová kontrola nenajde prázdnou stránku ani Next.js chybový překryv,
- všech 57 stávajících testů a nové testy verze projdou,
- produkční build a GitHub CI projdou bez chyby,
- Vercel Preview je `READY` a odpovídá přesnému commitu kandidáta,
- nejsou nalezené otevřené P0 ani P1 blokátory,
- stávající lokální data, zálohy a checkpointy zůstávají zpětně kompatibilní,
- verze není označena tagem ani vydána do produkce bez potvrzení uživatele.

## Mimo rozsah

- nové funkce mimo schválený rozsah verze 1.0,
- změna tréninkové logiky nebo schématu uložených dat,
- tvrzení, že automatizovaný prohlížeč nahrazuje kontrolu na fyzickém iPhonu,
- automatické sloučení do `main`, vytvoření tagu nebo GitHub Release,
- strukturovaný model vah a opakování z přeskočené fáze 4B,
- nové účty, sociální funkce, předplatné nebo veřejné žebříčky.
