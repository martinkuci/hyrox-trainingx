# HYROX Training

Mobilně orientovaná webová aplikace pro plánování HYROX tréninků, programový kalendář, časovač, historii výsledků a import údajů ze screenshotů.

## Funkce první verze

- knihovna a JSON import tréninků,
- tvorba vícetýdenních programů,
- kalendář s přesouváním jedné jednotky nebo zbytku programu,
- časovač a mezičasy,
- ukládání výsledků a RPE,
- import screenshotu z hodinek nebo fitness aplikace,
- volitelný účet a cloudová synchronizace přes Firebase.

Screenshot se používá pouze jako dočasný vstup. Aplikace uloží až hodnoty, které uživatel zkontroluje; samotný obrázek se neukládá do aplikace ani do Firestore.

## Technologie

- Next.js 16 App Router,
- React 19 a TypeScript,
- Tailwind CSS 4,
- lokální úložiště v prohlížeči,
- Firebase Authentication a Firestore REST API,
- OpenAI Responses API pro rozpoznání screenshotu,
- GitHub a Vercel.

## Lokální spuštění

1. Nainstaluj Node.js a závislosti:

   ```bash
   npm install
   ```

2. Zkopíruj `.env.example` do `.env.local` a doplň skutečné hodnoty.

3. Spusť aplikaci:

   ```bash
   npm run dev
   ```

4. Otevři `http://localhost:3000`.

## Environment variables

| Proměnná | Kde se používá | Povinná |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | přihlášení, synchronizace a ověření importu | ano pro cloud a AI import |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firestore synchronizace | ano pro cloud |
| `OPENAI_API_KEY` | serverové rozpoznání screenshotu | ano pro AI import |
| `OPENAI_VISION_MODEL` | model pro rozpoznání; výchozí `gpt-5.6-luna` | ne |

`OPENAI_API_KEY` nikdy nevkládej do proměnné začínající `NEXT_PUBLIC_` ani do repozitáře.

## Kontroly před odesláním

```bash
npm run lint
npm run build
```

Po změně UI zkontroluj mobilní odsazení, jedinou hlavičku stránky a případnou kolizi se sticky nebo fixed navigací.

## GitHub workflow

Aktuální práce probíhá na větvi `feature/screenshot-result-import`.

1. Každý commit obsahuje jeden malý logický krok.
2. Otevři draft pull request do `main`.
3. Zkontroluj změny, stav Vercel Preview a případné GitHub Actions.
4. Po úspěšné kontrole změň pull request na ready a merge do `main`.

Pravidla projektu jsou v `AGENTS.md` a složce `docs`.

## Nasazení na Vercel

1. Ve Vercelu zvol **Add New → Project**.
2. Importuj GitHub repozitář `martinkuci/hyrox-trainingx`.
3. Framework nech rozpoznat jako **Next.js** a ponech výchozí build command `npm run build`.
4. V **Settings → Environment Variables** vlož proměnné z tabulky výše. Skutečné klíče vlož alespoň pro Production; pro plné testování také pro Preview.
5. Spusť deployment.
6. Každý pull request následně získá vlastní Preview deployment. Merge do `main` spustí produkční deployment.

Po změně environment variables spusť nový deployment; staré nasazení je automaticky nepřevezme.
