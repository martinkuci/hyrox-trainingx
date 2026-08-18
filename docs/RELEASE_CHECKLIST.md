# Release checklist verze 1.0

Tento checklist je společná brána před vydáním. Zaškrtává se nad konkrétním kandidátem na vydání; samotná existence dokumentu neznamená, že je verze 1.0 připravená.

## 1. Automatická brána

Z čistého checkoutu spusť:

```bash
npm ci
npm run release:check
```

Výsledek je platný pouze tehdy, když bez chyby projdou všechny tři části:

- [ ] ESLint,
- [ ] všechny soubory `scripts/test-*.mjs`,
- [ ] produkční Next.js build.

Stejný příkaz musí zeleně projít také v GitHub CI na pull requestu určeném k vydání.

## 2. Příprava ručního testu

- [ ] Test probíhá na aktuálním Vercel Preview a následně na produkčním kandidátovi.
- [ ] Na iPhonu je použito Safari bez vynucené desktopové verze webu.
- [ ] Před testem obnovy je stažená záloha současných dat.
- [ ] Je připravený samostatný testovací program alespoň se dvěma plánovanými tréninky.
- [ ] Jeden trénink obsahuje časovaný interval nebo TABATU s automatickým odpočinkem.
- [ ] Jeden trénink lze opakovaně dokončit pro kontrolu trendu a osobního benchmarku.

## 3. Kritický tok tréninku

- [ ] Trénink lze vytvořit nebo vybrat z knihovny a vložit do programu.
- [ ] Program se zobrazí v kalendáři a naplánovaná jednotka jde otevřít.
- [ ] Při přesunu je vybraná jednotka viditelně označená a změna data se uloží.
- [ ] Trénink lze spustit a aktivní obrazovka je čitelná bez překrytých hlavních tlačítek.
- [ ] Kliknutí na značku HYROX minimalizuje aktivní trénink a návrat pokračuje ve stejném místě.
- [ ] Obnovení stránky nebo návrat do aplikace nabídne bezpečné pokračování rozpracovaného tréninku.
- [ ] Pauza zastaví čas a pokračování jej znovu spustí bez skoku.
- [ ] Interval nebo TABATA automaticky odpočítá odpočinek a nevyžaduje ruční potvrzení pauzy.
- [ ] Náhled následujícího cviku ukáže také počet opakování, vzdálenost nebo dobu práce.
- [ ] Zvukové upozornění posledních sekund je při běžné hlasitosti telefonu rozeznatelné i s hudbou.
- [ ] Hodnocení náročnosti se zadává až po dokončení celého bloku a uloží se zvolená úroveň.
- [ ] Trénink lze ukončit dříve bez odklikání zbývajících částí a uloží se pouze absolvovaný průběh.
- [ ] Běžně dokončený trénink uloží výsledek, čas, RPE, poznámku a dostupné mezičasy.

## 4. Výsledky a plán

- [ ] Uložený výsledek se zobrazí v historii se správným datem a délkou.
- [ ] Dokončená jednotka má v kalendáři správný stav a aktivní program nezmizí.
- [ ] Trendy používají pouze platné výsledky a prázdný stav je srozumitelný.
- [ ] Osobní benchmark vznikne jen ze srovnatelných dokončení stejného tréninku a verze.
- [ ] Adaptivní doporučení lze přijmout nebo odmítnout bez nečekané změny ostatních jednotek.

## 5. Data a obnova

- [ ] Profil stáhne čitelný JSON soubor se zálohou.
- [ ] Náhled vybrané zálohy ukáže počty tréninků, plánů a výsledků před jakoukoli změnou dat.
- [ ] Zrušení obnovy zachová všechna současná data.
- [ ] Obnova platné zálohy vrátí knihovnu, kalendář, programy i výsledky.
- [ ] Neplatný, neúplný nebo příliš velký soubor se odmítne bez přepsání současných dat.
- [ ] Obnova je zablokovaná během rozpracovaného tréninku.
- [ ] Bez přihlášení zůstane aplikace použitelná pouze s lokálními daty.
- [ ] Pokud je testována synchronizace, přihlášení ani odhlášení nesmaže lokální data bez potvrzeného řešení konfliktu.

## 6. Mobilní rozhraní a nasazení

- [ ] Na úzkém viewportu nejsou nadpisy ani hlavní akce oříznuté.
- [ ] Spodní navigace, sticky prvky a lišta Safari nepřekrývají dialogy ani tlačítka.
- [ ] Dialogy lze celé přečíst a ovládat bez uváznutí mimo viditelnou oblast.
- [ ] Dotykové cíle reagují spolehlivě a vybraný, načítací, chybový i úspěšný stav jsou rozlišitelné.
- [ ] Preview i produkční kandidát vrací úspěšnou odpověď pro hlavní stránku, plán, trénink a historii.
- [ ] GitHub CI a Vercel deployment jsou ve stavu úspěchu pro přesný commit kandidáta.
- [ ] Produkční konfigurace neobsahuje tajné klíče v klientském bundle ani v repozitáři.

## 7. Závažnost nálezů

| Úroveň | Význam | Dopad na vydání |
| --- | --- | --- |
| P0 kritická | Ztráta nebo poškození dat, bezpečnostní problém, pád aplikace nebo neproveditelný hlavní tok. | Vždy blokuje vydání. |
| P1 závažná | Důležitá funkce je chybná nebo na podporovaném telefonu prakticky nepoužitelná; existuje nanejvýš obtížná obezlička. | Blokuje vydání verze 1.0. |
| P2 běžná | Omezená chyba s bezpečnou a srozumitelnou obezličkou. | Musí být zapsaná; o vydání se rozhodne samostatně. |
| P3 kosmetická | Vizuální nebo textová odchylka bez dopadu na data a dokončení toku. | Neblokuje vydání. |

Neúspěšný `npm run release:check`, neúspěšné CI nebo neúspěšný produkční deployment se vždy považují za blokátor bez ohledu na uživatelskou závažnost.

## 8. Podpis kandidáta

| Položka | Hodnota |
| --- | --- |
| Commit |  |
| Preview URL |  |
| Testované zařízení a iOS |  |
| Datum testu |  |
| Tester |  |
| Otevřené P0 | 0 |
| Otevřené P1 | 0 |
| Rozhodnutí | připraveno / vrátit do 5B |
