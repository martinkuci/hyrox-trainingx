# Aktuální úkol

## Feature větev

`agent/release-1-0`

## Cíl změny

Připravit finálního kandidáta verze 1.0.0 po dokončené release bráně 5A. Závěrečná fáze spojí regresní ověření 5B s přípravou vydání 5C a doplní poslední schválenou úpravu nápovědy: přímé odeslání dotazu nebo hlášení chyby včetně volitelného screenshotu či PDF na podporu. Adresa podpory ani přístupový klíč e-mailové služby nesmí být součástí klientské aplikace. Formát uložených tréninkových dat se nemění.

## Rozsah závěrečné fáze 5B–5C

- spustit kompletní release gate a automatizovanou regresi hlavních veřejných tras,
- ověřit mobilní vykreslení, navigaci, formuláře a absenci frameworkového chybového překryvu,
- znovu ověřit bezpečný export a import dat automatickými testy,
- nastavit aplikační verzi na `1.0.0` v balíčku a sdílené konstantě,
- zobrazit číslo verze v nápovědě a připojit jej k hlášení podpory,
- připravit release notes s rozsahem, známými omezeními a postupem bezpečné aktualizace,
- označit roadmapu jako release candidate; finální stav „released“ přijde až po sloučení a tagu,
- připravit draft pull request a Vercel Preview k poslednímu potvrzení.
- v nápovědě umožnit vybrat jeden screenshot nebo PDF do 4 MB,
- hlášení odeslat přímo přes serverovou trasu `/api/support` bez otevření systémové e-mailové aplikace,
- přidat volitelný kontaktní e-mail pro odpověď podpory,
- příjemce, odesílatele a klíč služby Resend číst pouze ze serverových proměnných prostředí,
- serverově ověřit typ, velikost a skutečnou signaturu přílohy,
- omezit opakované odesílání kombinací jednorázového identifikátoru, honeypotu a základního omezení požadavků,
- přílohu neukládat do profilu, historie, `localStorage`, Firestore ani aplikační databáze a v rozhraní transparentně uvést, že je odeslána externí e-mailovou službou.

## Akceptační kritéria

- `package.json`, `package-lock.json` a zobrazená verze se shodují na `1.0.0`,
- hlášení podpory obsahuje verzi aplikace a nezměněný text uživatelovy zprávy,
- podporované obrázky a PDF do 4 MB lze odeslat přímo z aplikace bez otevření Mailu nebo nabídky Sdílet,
- nepodporovaný typ, příliš velký soubor, neplatná signatura a chyba poskytovatele mají čitelnou chybu,
- při neúspěšném odeslání zůstane rozepsaná zpráva i vybraná příloha zachována,
- po úspěchu se zobrazí potvrzení a stejné hlášení nelze nechtěně odeslat dvakrát,
- adresa příjemce ani serverové přístupové údaje nejsou v klientském balíčku nebo uživatelském rozhraní,
- nevyplněný honeypot a základní omezení četnosti brání nejjednoduššímu automatizovanému spamu,
- chybějící serverová konfigurace vrátí obecnou chybu dostupnosti bez úniku interních údajů,
- příloha se neukládá do `localStorage`, Firestore ani aplikační databáze,
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
- ukládání příloh do aplikační databáze nebo objektového úložiště,
- vlastní systém ticketů a administrační rozhraní podpory,
- přílohy větší než 4 MB vyžadující samostatné privátní úložiště,
- správa DNS a ověření produkční odesílací domény mimo konfiguraci nasazení,
- změna tréninkové logiky nebo schématu uložených dat,
- tvrzení, že automatizovaný prohlížeč nahrazuje kontrolu na fyzickém iPhonu,
- automatické sloučení do `main`, vytvoření tagu nebo GitHub Release,
- strukturovaný model vah a opakování z přeskočené fáze 4B,
- nové účty, sociální funkce, předplatné nebo veřejné žebříčky.
