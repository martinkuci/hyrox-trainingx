# Aktuální úkol

## Feature větev

`agent/enginn-3d1-strava-health`

## Fáze

Enginn 3D.1 — Strava + společná Health & Activity vrstva.

## Cíl změny

Připravit první skutečnou integraci externího fitness zdroje přes Strava OAuth 2.0 a současně vytvořit společný datový model, na který později naváže Apple HealthKit a Android Health Connect.

## Rozsah

- přidat obecný datový model pro externí health/activity zdroje a synchronizované aktivity,
- zachovat zpětnou kompatibilitu současných lokálních dat a záloh,
- přidat bezpečný serverový základ Strava OAuth bez ukládání Client Secret do klienta nebo repozitáře,
- připravit token exchange a refresh logiku pro krátkodobé access tokeny a rotující refresh tokeny,
- připravit načtení posledních Strava aktivit a jejich mapování do společného modelu,
- přidat uživatelské rozhraní v Profilu pro stav Strava integrace, připojení a odpojení,
- přidat obrazovku Health & Activity pro přehled dostupných zdrojů a posledních importovaných aktivit,
- doplnit environment-variable dokumentaci a cílené automatické testy.

## Akceptační kritéria

- aplikace se bez Strava environment variables stále normálně sestaví a zobrazí srozumitelný stav „integrace není nakonfigurována“,
- Client Secret ani refresh/access token se nikdy nedostanou do klientského JavaScriptu, localStorage, záloh ani Git historie,
- OAuth používá state ochranu a po callbacku validuje udělené scopes,
- refresh vždy ukládá nejnovější refresh token vrácený Stravou,
- importované aktivity používají jednotný provider-neutral model se zdrojem `strava`,
- datový model je připravený na budoucí `apple-health` a `health-connect`,
- stávající výsledky a health metriky z ručního/screenshot importu zůstávají kompatibilní,
- lint, automatické testy a produkční build projdou.

## Mimo rozsah

- HealthKit a nativní Capacitor plugin,
- Android Health Connect,
- automatické změny programu podle HRV/spánku/recovery,
- produkční webhook subscription bez reálných Strava credentials a veřejného callbacku,
- sloučení do `main` bez uživatelského otestování Preview.
