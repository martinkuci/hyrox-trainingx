# Aktuální úkol

## Feature větev

`agent/onboarding-help-2d`

## Cíl změny

Připravit aplikaci pro nové uživatele a dát jim jedno srozumitelné místo pro nápovědu, obnovení hesla a kontakt s tvůrcem. První spuštění musí rychle vysvětlit, co je HYROX Training a jak se aplikace používá, bez blokování samotného tréninku.

## Rozsah releasu 2D

- zobrazit při prvním běžném otevření krátký tříkrokový úvod,
- stručně vysvětlit HYROX, hlavní funkce aplikace a základní tok plán → trénink → výsledek,
- zapamatovat dokončení nebo přeskočení úvodu pouze v daném zařízení,
- nezobrazovat úvod automaticky na obrazovce aktivního tréninku,
- umožnit úvod kdykoliv znovu otevřít z centra nápovědy,
- přidat mobilní stránku Nápověda a kontakt s FAQ,
- přidat bezpečné odeslání odkazu pro reset hesla přes Firebase,
- připravit e-mail na `martin.kuci@gmail.com` s předmětem podle typu: technická pomoc, nápad na zlepšení nebo obecný dotaz,
- zpřístupnit centrum nápovědy z obrazovky Profil / Účet a cloud.

## Akceptační kritéria

- úvod se po dokončení nebo přeskočení znovu automaticky neotevře,
- úvod lze ručně otevřít z nápovědy bez mazání tréninkových dat,
- dialog je ovladatelný klávesnicí, respektuje safe area a vejde se na úzký telefon,
- reset hesla neprozrazuje, zda konkrétní e-mail existuje,
- e-mailová adresa se před resetem validuje a chyba Firebase je popsána srozumitelně,
- kontakt otevře e-mailového klienta s vybraným typem v předmětu a zprávou v těle,
- FAQ používá nativní přístupné ovládání a nevyžaduje JavaScript pro otevření odpovědi,
- aktivní trénink, lokální data ani cloudová synchronizace se nemění,
- lint, TypeScript, produkční build a cílené testy podpůrných funkcí projdou.

## Mimo rozsah 2D

- chat v reálném čase a ticketovací systém,
- automatické odesílání e-mailů ze serveru bez potvrzení uživatele,
- změna Firebase projektu nebo přihlašovacího modelu,
- ukládání obsahu zpětné vazby do databáze,
- právní a zdravotní poradenství.
