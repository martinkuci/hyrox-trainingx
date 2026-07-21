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
- přidat kontaktní a zpětnovazební formulář bez ukládání rozepsaného textu do cloudu,
- doplnit přehledné FAQ,
- zachovat existující přihlášení, synchronizaci a všechna tréninková data.

## Akceptační kritéria

- první návštěva automaticky otevře průvodce a po dokončení jej znovu sama neotevře,
- zavření průvodce se zapamatuje pouze v daném prohlížeči a nemaže žádná tréninková data,
- průvodce lze z účtu kdykoli spustit znovu,
- průvodce je čitelný na telefonu a respektuje safe-area,
- přihlášený i odhlášený uživatel se dostane k nápovědě a FAQ,
- reset hesla odešle bezpečný Firebase e-mail a zobrazí srozumitelný stav,
- zpětná vazba umožní připravit kontakt bez zveřejnění neověřené adresy v kódu,
- formulářová pole mají nejméně 16px a na iPhonu se při psaní nezvětšují,
- stránka nemá duplicitní hlavičku ani kolizi se spodní navigací,
- lint, produkční build a Vercel Preview projdou.

## Mimo rozsah

- ukládání zpětné vazby do databáze,
- administrace podnětů přímo v aplikaci,
- trenérská nebo zdravotní doporučení,
- změny závodních pravidel či automatický výběr soutěžní kategorie,
- sloučení do `main` bez uživatelského otestování.
