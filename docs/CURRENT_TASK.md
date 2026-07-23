# Aktuální úkol

## Feature větev

`feature/onboarding-help-feedback`

## Cíl změny

Usnadnit první použití aplikace a soustředit účet, cloud, nápovědu a zpětnou vazbu do jednoho srozumitelného místa.

## Rozsah

- zobrazit novému uživateli jednorázový mobilní úvod do aplikace,
- stručně vysvětlit princip HYROX a hlavní možnosti aplikace,
- umožnit průvodce kdykoli znovu otevřít ze sekce účtu,
- rozšířit sekci Cloud na „Účet, cloud a pomoc“,
- doplnit funkční obnovu hesla přes stávající Firebase Authentication,
- odesílat kontaktní a zpětnovazební formulář přímo tvůrci aplikace,
- označit předmět e-mailu podle typu podnětu,
- doplnit přehledné FAQ,
- zachovat existující přihlášení, synchronizaci a všechna tréninková data.

## Akceptační kritéria

- první návštěva automaticky otevře průvodce a po dokončení jej znovu sama neotevře,
- zavření průvodce se zapamatuje pouze v daném prohlížeči a nemaže žádná tréninková data,
- průvodce lze z účtu kdykoli spustit znovu,
- průvodce je čitelný na telefonu a respektuje safe-area,
- přihlášený i odhlášený uživatel se dostane k nápovědě a FAQ,
- reset hesla odešle bezpečný Firebase e-mail a zobrazí srozumitelný stav,
- zpětná vazba se odešle bez otevření e-mailového klienta,
- Resend a cílový e-mail jsou nastavené pro Preview i Production a testovací podnět se úspěšně doručí,
- příjemce a API klíč nejsou dostupné v klientském JavaScriptu,
- předmět rozlišuje nápad, chybu, dotaz a jinou připomínku,
- endpoint neumožňuje změnit příjemce, validuje délku a e-mail a omezuje opakované odesílání,
- formulářová pole mají nejméně 16px a na iPhonu se při psaní nezvětšují,
- stránka nemá duplicitní hlavičku ani kolizi se spodní navigací,
- lint, produkční build a Vercel Preview projdou.

## Mimo rozsah

- ukládání zpětné vazby do databáze,
- administrace podnětů přímo v aplikaci,
- trenérská nebo zdravotní doporučení,
- změny závodních pravidel či automatický výběr soutěžní kategorie,
- sloučení do `main` bez uživatelského otestování.
