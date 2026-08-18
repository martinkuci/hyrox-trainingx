# Aktuální úkol

## Feature větev

`agent/release-1-0`

## Cíl změny

Připravit finálního kandidáta verze 1.0.0 po dokončené release bráně 5A. Závěrečná fáze spojí regresní ověření 5B s přípravou vydání 5C a doplní poslední schválenou úpravu nápovědy: možnost přiložit screenshot nebo PDF k dotazu či hlášení chyby. Formát uložených dat se nemění.

## Rozsah závěrečné fáze 5B–5C

- spustit kompletní release gate a automatizovanou regresi hlavních veřejných tras,
- ověřit mobilní vykreslení, navigaci, formuláře a absenci frameworkového chybového překryvu,
- znovu ověřit bezpečný export a import dat automatickými testy,
- nastavit aplikační verzi na `1.0.0` v balíčku a sdílené konstantě,
- zobrazit číslo verze v nápovědě a připojit jej k připravenému e-mailu podpory,
- připravit release notes s rozsahem, známými omezeními a postupem bezpečné aktualizace,
- označit roadmapu jako release candidate; finální stav „released“ přijde až po sloučení a tagu,
- připravit draft pull request a Vercel Preview k poslednímu potvrzení.
- v nápovědě umožnit vybrat jeden screenshot nebo PDF do 10 MB,
- přílohu předat pouze systémové nabídce Sdílet bez nahrávání do aplikace nebo na server,
- bez přílohy zachovat současný předvyplněný e-mail,
- na zařízení bez podpory sdílení souboru zobrazit srozumitelný ruční postup a přílohu nikdy potichu nevynechat.

## Akceptační kritéria

- `package.json`, `package-lock.json` a zobrazená verze se shodují na `1.0.0`,
- e-mail podpory obsahuje verzi aplikace bez změny uživatelovy zprávy,
- podporované obrázky a PDF do 10 MB lze po klepnutí předat systémové nabídce Sdílet,
- nepodporovaný typ, příliš velký soubor a nepodporované zařízení mají čitelnou chybu,
- zrušení systémového sdílení nezpůsobí chybu ani ztrátu rozepsané zprávy,
- příloha se neukládá do `localStorage`, Firestore ani na aplikační server,
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
- serverové ukládání příloh nebo integrace služby pro odesílání e-mailů,
- automatický výběr cílové e-mailové aplikace v systémové nabídce Sdílet,
- změna tréninkové logiky nebo schématu uložených dat,
- tvrzení, že automatizovaný prohlížeč nahrazuje kontrolu na fyzickém iPhonu,
- automatické sloučení do `main`, vytvoření tagu nebo GitHub Release,
- strukturovaný model vah a opakování z přeskočené fáze 4B,
- nové účty, sociální funkce, předplatné nebo veřejné žebříčky.
