# Aktuální úkol

## Feature větev

`agent/offline-sync-2a`

## Cíl změny

Zajistit, aby lokálně uložené tréninkové změny zůstaly bezpečné při výpadku připojení a aby přihlášený uživatel vždy rozuměl stavu cloudové synchronizace. Neodeslaná lokální data se po návratu internetu bezpečně nahrají a nesmí je přepsat starší cloudová kopie.

## Rozsah releasu 2A

- trvale evidovat, že po lokální změně čekají data na cloudovou synchronizaci,
- rozlišit stav pouze v zařízení, synchronizaci, úspěšné uložení, čekání bez připojení a chybu,
- při ztrátě internetu ponechat aplikaci a lokální ukládání funkční,
- po návratu připojení automaticky odeslat nejnovější lokální data,
- po obnovení stránky zachovat informaci o neodeslaných změnách,
- před stažením cloudových dat upřednostnit lokální kopii označenou jako neodeslanou,
- zobrazit stav synchronizace v globálním nerušivém indikátoru a v obrazovce Účet a cloud,
- umožnit ruční opakování synchronizace po chybě,
- zachovat stávající formát `hyrox-data-v1` a současné přihlášení přes Firebase.

## Akceptační kritéria

- každá úspěšná lokální změna se uloží i bez internetu,
- neodeslaná změna zůstane označená i po zavření nebo obnovení aplikace,
- návrat internetu automaticky spustí právě jednu synchronizaci nejnovější lokální kopie,
- starší cloudová data nepřepíšou lokální kopii, která čeká na odeslání,
- při úspěšném odeslání se čekající stav zruší a uloží se čas poslední synchronizace,
- síťová nebo serverová chyba nezpůsobí odhlášení ani ztrátu lokálních dat,
- odhlášený uživatel vidí, že data zůstávají pouze v tomto zařízení,
- stav není rozlišen pouze barvou a změny jsou oznámené přístupným textem,
- globální indikátor nepřekrývá spodní navigaci ani hlavní akce od šířky 320 px,
- lint, TypeScript, produkční build a cílené scénáře synchronizační logiky projdou.

## Mimo rozsah 2A

- plná instalovatelná PWA a offline cache aplikačních souborů,
- slučování dvou současně upravených datových sad po jednotlivých položkách,
- vzdálené zamykání úprav na více zařízeních,
- změna poskytovatele autentizace nebo databáze,
- Apple Health, Health Connect, Garmin a Strava,
- statistiky výkonu a adaptivní úprava tréninkového programu.
