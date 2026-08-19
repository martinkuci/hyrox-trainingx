# Enginn — brand systém

## 1. Pozice produktu

**Enginn** je mobilní tréninkový plán, časovač a deník pro hybridní trénink. Pomáhá sportovci převést záměr do konkrétního programu, bezpečně projít tréninkem a porovnat výsledky bez zbytečné administrativy.

### Hlavní popis

> Tréninkový plán, časovač a deník pro tvůj hybridní trénink.

### Krátká produktová věta

> Plán. Trénink. Výsledky.

### Interní pozice značky

> Hybridní trénink bez chaosu.

Poslední věta vyjadřuje produktovou strategii. Nemusí být trvale zobrazena v navigaci ani v každé marketingové ploše.

## 2. Název

| Použití | Správně | Nepoužívat |
| --- | --- | --- |
| Název v textu a metadatech | `Enginn` | `ENGIN`, `Engine`, `Enginn Training` |
| Kompaktní wordmark v navigaci | `ENGINN` | `HYROX`, samotné `E` bez přístupného názvu |
| Název aplikace v obchodě/PWA | `Enginn` | `Enginn HYROX Training` |
| Popis kategorie | `hybridní trénink` | tvrzení, že Enginn je oficiální aplikace závodu |

Název se neskloňuje. V českém textu se používá například „v aplikaci Enginn“ nebo „odesláno z Enginn“.

## 3. Vizuální princip

Značka navazuje na současné rozhraní, aby aktualizace nepůsobila jako cizí produkt. Symbol **E-rail** tvoří tři dopředné dráhy spojené do písmene E. Vyjadřuje tři části hlavního toku: plán, trénink a výsledek. Zkosené konce naznačují pohyb bez použití závodního nebo sportovního loga třetí strany.

### Povinné vlastnosti

- jednoduchá geometrie čitelná od 20 px,
- žádné prvky, názvosloví ani kompozice odvozené od loga HYROX,
- výchozí limetková značka na uhlově černém pozadí,
- bez stínů uvnitř samotného symbolu,
- animace je povolená pouze jako krátké postupné rozsvícení tří drah; nesmí rušit při aktivním tréninku.

### Ochranná zóna

Kolem symbolu musí zůstat volný prostor alespoň ve velikosti tloušťky jedné vodorovné dráhy. Symbol se nesmí deformovat, naklánět, obkreslovat ani kombinovat s jiným logem.

## 4. Barvy

| Token | Hodnota | Použití |
| --- | --- | --- |
| Enginn Lime | `#BEF264` | značka, hlavní akce, aktivní stav |
| Lime Strong | `#A3E635` | stisk, zvýraznění a jemný gradient |
| Carbon | `#090A0C` | hlavní pozadí |
| Graphite | `#14171A` | karty a plochy |
| Steel | `#202429` | formuláře a zvýšené prvky |
| Signal White | `#F7F8F4` | hlavní text |
| Muted | `#9CA3AF` | doprovodný text |

Stavové barvy úspěchu, varování, chyby a informace zůstávají oddělené od značky. Limetková nesmí být jediným nositelem významu.

## 5. Typografie

- Rozhraní: `Inter`, následně systémové písmo zařízení.
- Čas a číselné výsledky: systémové monospace písmo.
- Wordmark: velká písmena, vysoká váha, prostrkání přibližně `0.16em`.
- Nadpisy mají být krátké a úderné. Běžný text používá větnou kapitalizaci, ne souvislá velká písmena.

## 6. Tón komunikace

Enginn komunikuje jako klidný trenér: stručně, konkrétně a bez ponižování začátečníka.

### Používat

- přímé akce: „Spustit trénink“, „Dokončit blok“, „Uložit výsledek“,
- měřitelné informace: čas, vzdálenost, opakování, váha a intenzita,
- jasné následky: „Rozpracovaný trénink zůstane uložený v tomto zařízení.“,
- škálování bez hodnocení uživatele: „Lehčí varianta“ a „Náročnější varianta“.

### Nepoužívat

- militaristický nebo ponižující tón,
- neověřené zdravotní, výkonnostní či výsledkové sliby,
- motoristické slovní hříčky v každém textu jen kvůli názvu Enginn,
- označení „oficiální“, „certifikovaný“ nebo „HYROX aplikace“.

## 7. Terminologická mapa

| Současný veřejný výraz | Enginn varianta | Poznámka |
| --- | --- | --- |
| HYROX Training | Enginn | značka produktu |
| HYROX v kostce | Hybridní trénink v kostce | onboarding |
| HYROX trénink | hybridní trénink | obecný obsah |
| HYROX tempo | cílové závodní tempo | podle kontextu lze použít „tempo simulace“ |
| 8 HYROX stanic | funkční disciplíny | neomezovat knihovnu na osm položek |
| stanoviště | cvik nebo disciplína | „stanoviště“ lze ponechat v konkrétním intervalovém formátu |
| Roxzone | přechodová zóna | obecný sportovní termín |
| HYROX 02 · Mixed Foundation | Hybrid 02 · Mixed Foundation | veřejný titul; interní ID se zatím nemění |
| Full HYROX | plná závodní simulace | bez tvrzení o oficiálním formátu |
| Odesláno z aplikace HYROX Training | Odesláno z aplikace Enginn | e-mail podpory |

## 8. Legacy technické názvy

Následující názvy se v technickém rebrandingu nesmějí mechanicky přepsat. Jsou součástí uložených dat nebo kompatibility a mohou zůstat interně, dokud nevznikne řízená migrace:

- `hyrox-data-v1`, `hyrox-results` a další klíče `localStorage`,
- `hyrox-training-backup` a existující názvy exportovaných záloh,
- typy a funkce jako `HyroxData`, `useHyroxData` a `saveHyroxData`,
- existující ID šablon jako `hyrox-02`,
- Firebase Project ID a databázové cesty,
- historické názvy tréninků uložené ve výsledcích.

Tyto řetězce nesmějí být nově zobrazovány uživateli. Budoucí formát může používat názvy Enginn, ale import musí dál přijímat verzi 1.

## 9. Assety

| Soubor | Účel |
| --- | --- |
| `public/brand/enginn-mark.svg` | samostatný symbol na průhledném pozadí |
| `public/brand/enginn-wordmark.svg` | horizontální značka pro dokumentaci a marketing |
| `public/brand/enginn-app-icon.svg` | vektorový zdroj app ikony |
| `public/brand/enginn-icon-180.png` | Apple touch icon |
| `public/brand/enginn-icon-192.png` | PWA ikona |
| `public/brand/enginn-icon-512.png` | PWA a store podklad |

V technické fázi se symbol použije v domovské hlavičce, wordmark `ENGINN` ve střední navigaci a kompaktní značka v aktivním tréninku zůstane tlačítkem pro minimalizaci.

## 10. Kontrolní pravidlo pro technický rebranding

Každý výskyt `hyrox` se musí před změnou zařadit do jedné ze tří skupin:

1. **veřejná značka** — změnit na Enginn,
2. **sportovní obsah** — přepsat na přesný obecný termín,
3. **legacy identifikátor** — zachovat nebo migrovat se zpětnou kompatibilitou.

Mechanické nahrazení celého repozitáře není bezpečný postup.
