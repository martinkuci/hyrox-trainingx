# HYROX Training 1.0.0

Status: release candidate

Technický výsledek kandidáta je zaznamenaný v [`RELEASE_VERIFICATION_1.0.0.md`](RELEASE_VERIFICATION_1.0.0.md).

Verze 1.0.0 uzavírá první stabilní rozsah aplikace od plánování tréninku po uložení a vyhodnocení výsledku. Kandidát nemění formát lokálních dat ani záloh; po finálním potvrzení bude možné aktualizovat stávající instalaci bez jejich smazání.

## Hlavní funkce

- mobilní přehled dne a týdenní plán,
- knihovna, editor a import vlastních tréninků,
- vícetýdenní programy a přesouvání jednotek v kalendáři,
- aktivní trénink s pauzou, minimalizací a bezpečným obnovením,
- strukturované režimy For Time, interval, TABATA, EMOM a AMRAP,
- automatické odpočinky a zvuková upozornění před koncem časovaného úseku,
- předčasné dokončení rozdělaného tréninku bez odklikání zbytku,
- jednoduché pětistupňové hodnocení po dokončení celého bloku,
- historie, dlouhodobé trendy, srovnání pokusů a osobní benchmarky,
- adaptivní doporučení obtížnosti s výslovným přijetím nebo odmítnutím,
- JSON záloha a bezpečná obnova s náhledem obsahu,
- volitelný účet a synchronizace přes Firebase,
- import výsledků ze screenshotu s kontrolou před uložením,
- úvod aplikace, FAQ, reset hesla a kontakt podpory.

## Stabilita a ochrana dat

- lokální režim funguje bez účtu a bez dostupného cloudu,
- rozpracovaný trénink se ukládá do zařízení,
- neplatná nebo neúplná záloha se odmítne před přepsáním dat,
- obnova dat je zablokovaná během aktivního tréninku,
- starší uložená data zůstávají zpětně kompatibilní,
- release gate kontroluje lint, všechny automatické testy a produkční build,
- číslo verze je viditelné v Nápovědě a připojuje se k e-mailu podpory.

## Známá omezení

- strukturované zapisování vah a opakování po jednotlivých cvicích není součástí verze 1.0.0,
- zvuk upozornění respektuje omezení hlasitosti, tichého režimu a přehrávání médií v iOS,
- cloudová synchronizace vyžaduje nakonfigurovaný Firebase projekt a připojení k internetu,
- rozpoznání screenshotu vyžaduje nakonfigurovaný serverový API klíč a uživatelskou kontrolu výsledku,
- aplikace neposkytuje zdravotní diagnózu ani predikci závodního výkonu.

## Bezpečná aktualizace

1. Před aktualizací stáhni v Profilu aktuální JSON zálohu.
2. Aktualizuj aplikaci nebo znovu načti produkční adresu; nemaž data webu v Safari.
3. Ověř, že zůstaly dostupné tréninky, kalendář a historie.
4. Pokud data chybí, v Profilu vyber zálohu, zkontroluj náhled a teprve potom potvrď obnovu.

## Postup finálního vydání

1. Dokončit release checklist a potvrdit nulový počet otevřených P0 a P1 chyb.
2. Ověřit úspěšný GitHub CI a Vercel Preview nad přesným commitem kandidáta.
3. Po schválení sloučit release pull request do `main`.
4. Ověřit produkční deployment a hlavní veřejné trasy.
5. Vytvořit tag `v1.0.0` a GitHub Release z těchto poznámek.
