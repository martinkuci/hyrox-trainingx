# Strava setup pro Enginn 3D.1

Tento dokument neobsahuje žádné skutečné credentials. `STRAVA_CLIENT_SECRET` patří pouze do serverového prostředí Vercelu a nikdy do Git historie, klientského JavaScriptu ani uživatelské zálohy.

## 1. Strava API application

Ve Strava API settings vytvoř aplikaci pro Enginn a poznamenej si:

- Client ID
- Client Secret
- Authorization Callback Domain

Enginn žádá pouze scopes `read` a `activity:read_all`, protože cílem 3D.1 je načíst uživatelovy tréninkové aktivity včetně soukromých aktivit.

## 2. Produkční callback

Pro produkční Enginn použij:

`https://enginn.app/api/strava/callback`

V produkčním Vercel prostředí nastav server-only proměnné:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REDIRECT_URI=https://enginn.app/api/strava/callback`

Firebase proměnné musí zůstat nastavené stejně jako dnes, protože server před zahájením Strava OAuth ověřuje Firebase ID token přihlášeného uživatele.

## 3. Preview test

Branch alias 3D.1 je:

`https://enginn-git-agent-enginn-3d1-strava-health-martinkucis-projects.vercel.app`

Pro skutečný OAuth test na Preview musí Strava povolit callback doménu tohoto preview aliasu a Preview prostředí musí použít odpovídající `STRAVA_REDIRECT_URI`:

`https://enginn-git-agent-enginn-3d1-strava-health-martinkucis-projects.vercel.app/api/strava/callback`

Pokud nechceme během vývoje měnit Strava callback doménu, lze bezpečně otestovat celé UI a server build bez credentials; skutečné OAuth připojení se aktivuje až po konfiguraci.

## 4. Bezpečnostní model 3D.1

- OAuth `state` je krátkodobý, šifrovaný a HttpOnly.
- Strava access/refresh token bundle je AES-256-GCM šifrovaný v HttpOnly cookie a je svázaný s Firebase UID.
- Client Secret se používá pouze na serveru.
- Access token ani refresh token se neposílají do klientské aplikace.
- Tokeny nejsou součástí `HyroxData`, localStorage zálohy ani cloudového payloadu Enginnu.
- Při refreshi se vždy uloží nejnovější refresh token vrácený Stravou.
- Odpojení používá Strava revocation endpoint a lokální token cookie se odstraní až po úspěšném odpojení.

## 5. Co se ukládá do Enginnu

Do provider-neutral Health & Activity modelu se ukládají pouze importovaná data, například:

- název a typ aktivity,
- datum a délka,
- vzdálenost,
- převýšení,
- průměrný a maximální tep, pokud je Strava poskytne,
- výkon ve wattech, pokud je dostupný,
- další bezpečné metriky podporované společným modelem.

Stejný datový model je připravený pro budoucí Apple HealthKit a Android Health Connect.
