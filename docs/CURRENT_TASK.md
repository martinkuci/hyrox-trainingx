# Aktuální úkol

## Feature větev

`agent/workout-recovery-1a`

## Cíl změny

Zabránit ztrátě rozpracovaného tréninku při obnovení stránky, zavření aplikace nebo nečekaném pádu. Workout runner musí průběžně ukládat svůj stav do samostatného lokálního checkpointu a nabídnout bezpečné pokračování přesně od posledního potvrzeného kroku.

## Rozsah releasu 1A

- zavést verzovaný a validovaný checkpoint rozpracovaného tréninku mimo hlavní datový model,
- průběžně ukládat fázi runneru, aktuální krok, dokončené kroky, mezičasy, uplynulý čas a stav pauzy,
- po návratu ke stejnému tréninku nabídnout pokračování nebo zahájení od začátku,
- při pokračování správně dopočítat čas podle okamžiku uložení a zachovat vědomou pauzu,
- při dokončení nebo výslovném opuštění checkpoint odstranit,
- zabránit přepsání checkpointu jiným tréninkem bez jasného rozhodnutí uživatele,
- zobrazit srozumitelnou informaci o automatickém lokálním uložení,
- umožnit rozpracovaný trénink bezpečně minimalizovat; časovač se přitom vědomě pozastaví a checkpoint se uloží ještě před odchodem,
- na běžných obrazovkách zobrazit kompaktní návratovou lištu s názvem, uloženým časem a akcí „Pokračovat“,
- zachovat nerušený workout runner bez hlavní spodní navigace,
- zachovat současné ukládání výsledků, plánování, cloudovou synchronizaci a existující lokální data.

## Akceptační kritéria

- reload během countdownu, aktivního kroku i pauzy nevede ke ztrátě postupu,
- pokračování obnoví správný krok, dokončené kroky, mezičasy a celkový čas,
- čas během aktivního tréninku pokračuje i po zavření stránky; během vědomé pauzy neběží,
- neplatný, zastaralý nebo nekompatibilní checkpoint aplikaci nerozbije a lze jej bezpečně zahodit,
- dokončený nebo uživatelem zrušený trénink nezanechá aktivní checkpoint,
- v zařízení existuje nejvýše jeden aktivní checkpoint,
- minimalizace z countdownu, náhledu bloku i aktivního kroku otevře hlavní obrazovku a uchová pozastavený stav,
- návratová lišta se po minimalizaci objeví nad hlavní navigací, nepřekrývá fixní akce a vrátí uživatele ke správnému tréninku,
- rozhraní zůstane použitelné na šířce 320 px a ovladatelné klávesnicí,
- lint, TypeScript, produkční build a cílené scénáře obnovy projdou.

## Mimo rozsah 1A

- zadávání vah, opakování, kol, RPE a poznámek během jednotlivých kroků,
- změny schématu uložených výsledků,
- rychlé přesouvání nebo zkracování tréninků v kalendáři,
- vzdálená synchronizace aktivního checkpointu mezi zařízeními,
- Apple Health, Health Connect, Garmin a Strava.

## Následující release 1B

- rychlé logování vah, kol, času, RPE a poznámek během tréninku,
- výsledné porovnání plánu proti skutečnosti,
- rychlé přesuny tréninků v kalendáři,
- zkrácené varianty naplánovaného tréninku.
