import type { WorkoutBlock, WorkoutCategory, WorkoutTemplate } from "./types";

export const TRAINING_CATALOG_VERSION = 2;

const seedTimestamp = "2026-07-19T00:00:00.000Z";

type StepInput = readonly [name: string, detail: string];

type CatalogTemplateInput = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  tags: string[];
  code: string;
  category: WorkoutCategory;
  goal: string;
  rpe: readonly [number, number];
  expectedDuration: readonly [number, number];
  runningTarget: string;
  primaryMetric: string;
  secondaryMetrics: string[];
  progressionGroup: string;
  difficultyLevel: 1 | 2 | 3;
  blocks: WorkoutBlock[];
};

function manual(
  templateId: string,
  key: string,
  title: string,
  repeat: number,
  steps: StepInput[],
): WorkoutBlock {
  return {
    id: `${templateId}-${key}`,
    type: "manual",
    title,
    repeat,
    steps: steps.map(([name, detail], index) => ({
      id: `${templateId}-${key}-${index + 1}`,
      name,
      detail,
    })),
  };
}

function emom(
  templateId: string,
  key: string,
  title: string,
  minutes: number,
  steps: StepInput[],
): WorkoutBlock {
  return {
    id: `${templateId}-${key}`,
    type: "emom",
    title,
    minutes,
    steps: steps.map(([name, detail], index) => ({
      id: `${templateId}-${key}-${index + 1}`,
      name,
      detail,
    })),
  };
}

function forTime(
  templateId: string,
  key: string,
  title: string,
  rounds: number,
  restSeconds: number,
  steps: StepInput[],
  restName = "Odpočinek",
  restDetail = "Připrav se na další kolo.",
): WorkoutBlock {
  return {
    id: `${templateId}-${key}`,
    type: "for-time",
    title,
    rounds,
    restSeconds,
    restName,
    restDetail,
    steps: steps.map(([name, detail], index) => ({
      id: `${templateId}-${key}-${index + 1}`,
      name,
      detail,
    })),
  };
}

function interval(
  templateId: string,
  key: string,
  title: string,
  rounds: number,
  workSeconds: number,
  restSeconds: number,
  steps: StepInput[],
  restName = "Odpočinek",
  restDetail = "Připrav se na další interval.",
): WorkoutBlock {
  return {
    id: `${templateId}-${key}`,
    type: "interval",
    title,
    rounds,
    workSeconds,
    restSeconds,
    restName,
    restDetail,
    steps: steps.map(([name, detail], index) => ({
      id: `${templateId}-${key}-${index + 1}`,
      name,
      detail,
    })),
  };
}

function catalogTemplate(input: CatalogTemplateInput): WorkoutTemplate {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    durationMinutes: input.durationMinutes,
    tags: input.tags,
    metadata: {
      workoutCode: input.code,
      templateVersion: 1,
      category: input.category,
      goal: input.goal,
      targetRpeMin: input.rpe[0],
      targetRpeMax: input.rpe[1],
      expectedDurationMin: input.expectedDuration[0],
      expectedDurationMax: input.expectedDuration[1],
      runningTarget: input.runningTarget,
      primaryMetric: input.primaryMetric,
      secondaryMetrics: input.secondaryMetrics,
      progressionGroup: input.progressionGroup,
      difficultyLevel: input.difficultyLevel,
    },
    blocks: input.blocks,
    createdAt: seedTimestamp,
    updatedAt: seedTimestamp,
  };
}

const hyrox02 = "hyrox-02";
const baseEngine01 = "catalog-base-engine-01";
const baseEngine02 = "catalog-base-engine-02";
const baseEngine03 = "catalog-base-engine-03";
const baseBuilder01 = "catalog-base-builder-01";
const strength01 = "catalog-strength-01";
const strength02 = "catalog-strength-02";
const strength03 = "catalog-strength-03";
const threshold01 = "catalog-threshold-01";
const threshold02 = "catalog-threshold-02";
const threshold03 = "catalog-threshold-03";
const simulation01 = "catalog-race-simulation-01";
const simulation02 = "catalog-race-simulation-02";
const simulation03 = "catalog-race-simulation-03";
const longEngine01 = "catalog-long-engine-01";
const longEngine02 = "catalog-long-engine-02";
const recovery01 = "catalog-recovery-01";
const mixed02 = "catalog-mixed-02";

export const HYROX_02_TEMPLATE = catalogTemplate({
  id: hyrox02,
  title: "HYROX 02 · Mixed Foundation",
  description: "Krátké běžecké úseky a základní stanoviště v kontrolovaném tempu.",
  durationMinutes: 45,
  tags: ["běh", "stanoviště", "kondice", "technika"],
  code: "HYX-MIX-01",
  category: "mixed",
  goal: "Naučit plynulé přechody mezi během a funkční prací bez ztráty techniky.",
  rpe: [6, 7],
  expectedDuration: [40, 50],
  runningTarget: "Kontrolované tempo 75–80 %, poslední kolo stejně rychlé jako první.",
  primaryMetric: "Rovnoměrnost časů jednotlivých kol",
  secondaryMetrics: ["technika přechodů", "wall balls bez dlouhé pauzy", "tep po běhu"],
  progressionGroup: "mixed-foundation",
  difficultyLevel: 1,
  blocks: [
    manual(hyrox02, "warmup", "Rozcvičení", 1, [
      ["5 min lehký běh nebo veslo", "Klidné tempo, postupně rozhýbej celé tělo."],
      ["2 kola mobility", "8 dřepů · 6 výpadů na stranu · 8 kliků · 20 s plank."],
    ]),
    manual(hyrox02, "main", "3 kola plynule", 3, [
      ["600 m běh", "Tempo přibližně 75–80 %, bez sprintu."],
      ["10 burpee broad jumps", "Plynule, dopad stabilně na obě chodidla."],
      ["16 walking lunges", "8 na každou nohu, trup vzpřímený."],
      ["12 wall balls", "Zvol váhu, se kterou udržíš stejnou techniku všechna kola."],
      ["250 m veslo", "Silné, ale rovnoměrné záběry."],
    ]),
    emom(hyrox02, "emom", "EMOM 6", 6, [
      ["12 kettlebell swings", "Dokonči do 40 s a zbytek minuty odpočívej."],
      ["10 box step-overs", "Střídej nástupní nohu a drž plynulé tempo."],
    ]),
    manual(hyrox02, "cooldown", "Zklidnění", 1, [
      ["3–5 min vychození", "Potom lehce protáhni kyčle, lýtka a hrudník."],
    ]),
  ],
});

export const TRAINING_CATALOG: WorkoutTemplate[] = [
  HYROX_02_TEMPLATE,
  catalogTemplate({
    id: baseEngine01,
    title: "Base Engine 01 · Z2 Run",
    description: "Lehký aerobní běh s krátkými úseky chůze pro budování základní vytrvalosti.",
    durationMinutes: 40,
    tags: ["běh", "z2", "aerobní základ"],
    code: "HYX-BE-01",
    category: "base-engine",
    goal: "Rozvíjet aerobní kapacitu při plně kontrolovaném dýchání.",
    rpe: [4, 5],
    expectedDuration: [36, 44],
    runningTarget: "Zóna 2 nebo tempo, při kterém zvládneš mluvit v celých větách.",
    primaryMetric: "Čas strávený v lehké intenzitě",
    secondaryMetrics: ["rovnoměrné tempo", "uvolněný krok", "nízké RPE"],
    progressionGroup: "base-engine",
    difficultyLevel: 1,
    blocks: [
      manual(baseEngine01, "warmup", "Rozběhání", 1, [
        ["8 min velmi lehce", "Začni chůzí a plynule přejdi do klusu."],
        ["3× 20 s svižně", "Mezi úseky 40 s lehce; bez maximálního sprintu."],
      ]),
      interval(baseEngine01, "main", "3 aerobní bloky", 3, 480, 120, [
        ["Lehký běh", "8 min · drž Z2 a uvolněná ramena."],
      ], "Svižná chůze", "2 min · srovnej dech, nezastavuj se."),
      manual(baseEngine01, "cooldown", "Zklidnění", 1, [
        ["5 min chůze a mobilita", "Kotníky, lýtka a flexory kyčlí."],
      ]),
    ],
  }),
  catalogTemplate({
    id: baseEngine02,
    title: "Base Engine 02 · Cardio Rotation",
    description: "Střídání běhu, SkiErgu a vesla bez výrazného nárůstu intenzity.",
    durationMinutes: 55,
    tags: ["běh", "skierg", "veslo", "z2"],
    code: "HYX-BE-02",
    category: "base-engine",
    goal: "Prodloužit souvislou aerobní práci a udržet klidné přechody mezi modalitami.",
    rpe: [4, 6],
    expectedDuration: [50, 60],
    runningTarget: "Z2 až spodní Z3, bez zrychlování v posledních kolech.",
    primaryMetric: "Stabilní tep napříč modalitami",
    secondaryMetrics: ["kadence běhu", "tempo SkiErgu", "tempo vesla"],
    progressionGroup: "base-engine",
    difficultyLevel: 2,
    blocks: [
      manual(baseEngine02, "warmup", "Aerobní warm-up", 1, [
        ["5 min lehký klus", "Plynulé tempo."],
        ["5 min SkiErg nebo veslo", "Lehce, soustřeď se na dlouhý záběr."],
      ]),
      manual(baseEngine02, "main", "4 kola bez zastavení", 4, [
        ["6 min běh", "Z2, kontrolované dýchání."],
        ["500 m SkiErg nebo veslo", "V každém kole vystřídej stroj; RPE maximálně 6."],
      ]),
      manual(baseEngine02, "cooldown", "Zklidnění", 1, [
        ["5 min velmi lehce", "Vychození nebo volné veslo."],
      ]),
    ],
  }),
  catalogTemplate({
    id: baseEngine03,
    title: "Base Engine 03 · Aerobic Cruise",
    description: "Delší běžecké úseky doplněné lehkou prací na ergometru.",
    durationMinutes: 65,
    tags: ["běh", "skierg", "veslo", "vytrvalost"],
    code: "HYX-BE-03",
    category: "base-engine",
    goal: "Udržet efektivní běh při rostoucím aerobním objemu.",
    rpe: [5, 6],
    expectedDuration: [58, 70],
    runningTarget: "Horní Z2, stále nejméně 45–60 s/km pomaleji než závodní tempo.",
    primaryMetric: "Stabilita tempa v delších úsecích",
    secondaryMetrics: ["tepový drift", "ekonomika běhu", "technika záběru"],
    progressionGroup: "base-engine",
    difficultyLevel: 3,
    blocks: [
      manual(baseEngine03, "warmup", "Rozběhání", 1, [
        ["10 min lehce", "Poslední 2 minuty lehce zrychli."],
      ]),
      manual(baseEngine03, "main", "4 aerobní kola", 4, [
        ["1,5 km běh", "Horní Z2, stejné tempo v každém kole."],
        ["500 m SkiErg nebo veslo", "Lehké aktivní zotavení, stroje střídej."],
      ]),
      manual(baseEngine03, "cooldown", "Zklidnění", 1, [
        ["5–8 min volně", "Chůze a mobilita kotníků a kyčlí."],
      ]),
    ],
  }),
  catalogTemplate({
    id: baseBuilder01,
    title: "Base Builder 01 · Transition Skills",
    description: "Technický nácvik jednoduchých přechodů v nízké až střední intenzitě.",
    durationMinutes: 45,
    tags: ["technika", "přechody", "běh", "stanoviště"],
    code: "HYX-BB-01",
    category: "base-builder",
    goal: "Zautomatizovat přechod z běhu na stanoviště a zpět bez zbytečné pauzy.",
    rpe: [5, 6],
    expectedDuration: [40, 50],
    runningTarget: "Lehké až střední tempo, po stanovišti znovu srovnej krok do 100 m.",
    primaryMetric: "Čas přechodů",
    secondaryMetrics: ["technika SkiErgu", "držení při carry", "kvalita wall balls"],
    progressionGroup: "base-builder",
    difficultyLevel: 1,
    blocks: [
      manual(baseBuilder01, "warmup", "Příprava pohybu", 1, [
        ["6 min lehký běh", "Vlož 3 krátká zrychlení."],
        ["2 kola techniky", "8 air squat · 8 výpadů · 6 burpees · 10 lehkých přítahů."],
      ]),
      manual(baseBuilder01, "main", "4 technická kola", 4, [
        ["500 m běh", "Pohodlné tempo, posledních 50 m připrav přechod."],
        ["250 m SkiErg", "Dlouhý záběr, nezvedej ramena."],
        ["20 m farmers carry", "Střední váha, krátké rychlé kroky."],
        ["10 wall balls", "Kontrolovaný dřep a stejný bod zásahu."],
      ]),
      manual(baseBuilder01, "cooldown", "Zklidnění", 1, [
        ["5 min volně", "Vychození a klidné dýchání."],
      ]),
    ],
  }),
  catalogTemplate({
    id: strength01,
    title: "Strength 01 · Lower Body Foundation",
    description: "Základní síla nohou a trupu pro saně, výpady a přenášení.",
    durationMinutes: 50,
    tags: ["síla", "nohy", "core", "carry"],
    code: "HYX-STR-01",
    category: "strength",
    goal: "Vybudovat technickou silovou základnu bez práce do selhání.",
    rpe: [6, 7],
    expectedDuration: [45, 55],
    runningTarget: "Bez hlavního běžeckého objemu; warm-up pouze lehce.",
    primaryMetric: "Kvalita opakování a stabilita trupu",
    secondaryMetrics: ["použitá váha", "symetrie výpadů", "síla úchopu"],
    progressionGroup: "strength",
    difficultyLevel: 1,
    blocks: [
      manual(strength01, "warmup", "Silový warm-up", 1, [
        ["6 min lehký ergometr", "Klidné tempo."],
        ["2 kola aktivace", "8 glute bridge · 8 dřepů · 6 výpadů na stranu · 20 s plank."],
      ]),
      forTime(strength01, "main", "4 kvalitní kola", 4, 90, [
        ["8 goblet squats", "RPE 6–7, pevný střed těla."],
        ["8 rumunských mrtvých tahů", "Kontrolovaný pohyb, neutrální záda."],
        ["8 split squats na každou nohu", "Rozsah bez ztráty stability."],
        ["40 m farmers carry", "Vzpřímený trup a pevný úchop."],
      ], "Odpočinek", "90 s · další kolo začni s připravenou technikou."),
      manual(strength01, "cooldown", "Mobilita", 1, [
        ["5 min lehce", "Kyčle, hýždě a hrudní páteř."],
      ]),
    ],
  }),
  catalogTemplate({
    id: strength02,
    title: "Strength 02 · Sled Builder",
    description: "Specifická síla pro tlak a tah saní doplněná výpady.",
    durationMinutes: 55,
    tags: ["síla", "sled push", "sled pull", "výpady"],
    code: "HYX-STR-02",
    category: "strength",
    goal: "Zvýšit sílu a jistotu na saních při zachování závodní techniky.",
    rpe: [7, 8],
    expectedDuration: [48, 60],
    runningTarget: "Krátký lehký běh pouze v rozcvičení.",
    primaryMetric: "Konzistentní čas pracovních úseků na saních",
    secondaryMetrics: ["tréninková váha", "počet zastavení", "technika lana"],
    progressionGroup: "strength",
    difficultyLevel: 2,
    blocks: [
      manual(strength02, "warmup", "Příprava na saně", 1, [
        ["8 min lehký běh nebo ergometr", "Postupně zvyšuj teplotu těla."],
        ["3 lehké nájezdy na saně", "Krátký tlak i tah s lehkou váhou."],
      ]),
      forTime(strength02, "main", "5 silových kol", 5, 120, [
        ["12,5 m sled push", "Tréninková váha, se kterou úsek dokončíš bez zastavení."],
        ["12,5 m sled pull", "Plynulé kroky vzad a rychlé dobírání lana."],
        ["10 sandbag lunges na každou nohu", "Koleno kontrolovaně k podlaze."],
      ], "Odpočinek", "2 min · další kolo drž ve stejné kvalitě."),
      manual(strength02, "cooldown", "Zklidnění", 1, [
        ["5 min volně", "Vychození a mobilita lýtek, kyčlí a zad."],
      ]),
    ],
  }),
  catalogTemplate({
    id: strength03,
    title: "Strength 03 · Heavy Stations",
    description: "Náročná silová práce na saních, výpadech a wall balls pro zkušené sportovce.",
    durationMinutes: 65,
    tags: ["síla", "těžké saně", "wall balls", "výpady"],
    code: "HYX-STR-03",
    category: "strength",
    goal: "Zlepšit rezervu síly na hlavních závodních stanovištích.",
    rpe: [8, 9],
    expectedDuration: [55, 70],
    runningTarget: "Bez intenzivního běhu; zachovej sílu pro kvalitní stanoviště.",
    primaryMetric: "Pracovní čas bez technického selhání",
    secondaryMetrics: ["váha saní", "počet sérií wall balls", "stabilita výpadů"],
    progressionGroup: "strength",
    difficultyLevel: 3,
    blocks: [
      manual(strength03, "warmup", "Důkladné rozcvičení", 1, [
        ["10 min lehce", "Běh nebo ergometr a dynamická mobilita."],
        ["3 postupné série", "Sled push, sled pull a wall balls s rostoucí tréninkovou váhou."],
      ]),
      forTime(strength03, "main", "4 těžká kola", 4, 180, [
        ["25 m sled push", "Těžká, ale technicky zvládnutelná tréninková váha."],
        ["25 m sled pull", "Trup stabilní, lano vždy rychle dobírej."],
        ["20 m sandbag lunges", "Bez odkládání bagu uprostřed úseku."],
        ["15 wall balls", "Jedna až dvě plánované série."],
      ], "Odpočinek", "3 min · nezkracuj odpočinek na úkor techniky."),
      manual(strength03, "cooldown", "Zklidnění", 1, [
        ["8 min velmi lehce", "Chůze, mobilita a klidné dýchání."],
      ]),
    ],
  }),
  catalogTemplate({
    id: threshold01,
    title: "Threshold 01 · 400 m Repeats",
    description: "Krátké kontrolované intervaly pro první práci v prahovém tempu.",
    durationMinutes: 45,
    tags: ["běh", "intervaly", "tempo"],
    code: "HYX-THR-01",
    category: "threshold",
    goal: "Zlepšit rychlost běhu bez rozpadu techniky nebo nekontrolovaného finiše.",
    rpe: [7, 8],
    expectedDuration: [40, 50],
    runningTarget: "Tempo přibližně na úrovni kontrolovaného závodu na 10 km.",
    primaryMetric: "Rozdíl mezi nejrychlejším a nejpomalejším úsekem",
    secondaryMetrics: ["kadence", "RPE posledního úseku", "obnova dechu"],
    progressionGroup: "threshold",
    difficultyLevel: 1,
    blocks: [
      manual(threshold01, "warmup", "Běžecký warm-up", 1, [
        ["12 min lehký běh", "Na konci 4× 20 s svižně s 40 s lehce."],
      ]),
      forTime(threshold01, "main", "6 intervalů", 6, 90, [
        ["400 m svižně", "Kontrolované tempo, všech šest úseků podobně rychle."],
      ], "Lehký klus nebo chůze", "90 s · srovnej dech, ale nezastavuj úplně."),
      manual(threshold01, "cooldown", "Výklus", 1, [
        ["8 min lehce", "Postupně zpomal až do chůze."],
      ]),
    ],
  }),
  catalogTemplate({
    id: threshold02,
    title: "Threshold 02 · 1 km Control",
    description: "Kilometrové intervaly blízko HYROX tempa s plnou kontrolou každého úseku.",
    durationMinutes: 55,
    tags: ["běh", "1 km", "threshold", "hyrox tempo"],
    code: "HYX-THR-02",
    category: "threshold",
    goal: "Najít udržitelné kilometrové tempo pro specifickou část přípravy.",
    rpe: [7, 8],
    expectedDuration: [48, 60],
    runningTarget: "Cílové HYROX tempo nebo o 5–10 s/km rychleji, bez sprintu.",
    primaryMetric: "Průměr a rozptyl kilometrů",
    secondaryMetrics: ["tep po intervalu", "kadence", "RPE"],
    progressionGroup: "threshold",
    difficultyLevel: 2,
    blocks: [
      manual(threshold02, "warmup", "Rozběhání", 1, [
        ["12 min lehce", "Přidej 4 krátká zrychlení."],
      ]),
      forTime(threshold02, "main", "4× 1 km", 4, 120, [
        ["1 km v cílovém tempu", "První úsek nejvýše stejně rychlý jako poslední."],
      ], "Lehký klus", "2 min aktivní zotavení."),
      manual(threshold02, "cooldown", "Výklus", 1, [
        ["10 min lehce", "Volné tempo a následná mobilita."],
      ]),
    ],
  }),
  catalogTemplate({
    id: threshold03,
    title: "Threshold 03 · Compromised Kilometers",
    description: "Prahový běh prokládaný ergometrem pro zkušené sportovce.",
    durationMinutes: 70,
    tags: ["běh", "threshold", "skierg", "veslo", "compromised"],
    code: "HYX-THR-03",
    category: "threshold",
    goal: "Udržet kilometrové tempo i po zatížení horní a zadní části těla.",
    rpe: [8, 9],
    expectedDuration: [60, 75],
    runningTarget: "Cílové HYROX tempo; zpomalení mezi prvním a posledním během do 3 %.",
    primaryMetric: "Stabilita běhu po ergometru",
    secondaryMetrics: ["tempo SkiErgu", "tempo vesla", "čas přechodů"],
    progressionGroup: "threshold",
    difficultyLevel: 3,
    blocks: [
      manual(threshold03, "warmup", "Kompletní warm-up", 1, [
        ["12 min lehký běh", "Na konci 4 zrychlení."],
        ["500 m lehký SkiErg nebo row", "Připrav techniku záběru."],
      ]),
      forTime(threshold03, "main", "5 kompromitovaných kol", 5, 90, [
        ["1 km běh", "Cílové tempo, žádný finiš v prvních kolech."],
        ["250 m SkiErg nebo veslo", "Stroje střídej po kolech, RPE 8."],
      ], "Lehce", "90 s chůze nebo klus · srovnej dech."),
      manual(threshold03, "cooldown", "Výklus", 1, [
        ["8–10 min lehce", "Postupné zklidnění."],
      ]),
    ],
  }),
  catalogTemplate({
    id: simulation01,
    title: "Race Simulation 01 · Quarter",
    description: "Čtvrtinová simulace s kratším během a čtyřmi různými stanovišti.",
    durationMinutes: 50,
    tags: ["simulace", "běh", "stanoviště", "technika"],
    code: "HYX-SIM-01",
    category: "race-simulation",
    goal: "Nacvičit pořadí práce a přechody bez plného závodního objemu.",
    rpe: [6, 7],
    expectedDuration: [42, 55],
    runningTarget: "Kontrolované tempo přibližně 15–25 s/km pomaleji než závodní cíl.",
    primaryMetric: "Plynulost přechodů",
    secondaryMetrics: ["rovnoměrnost běhu", "technika stanovišť", "počet pauz"],
    progressionGroup: "race-simulation",
    difficultyLevel: 1,
    blocks: [
      manual(simulation01, "warmup", "Závodní rozcvičení", 1, [
        ["10 min lehce", "Běh, dynamická mobilita a krátký nácvik stanovišť."],
      ]),
      manual(simulation01, "main", "Čtvrtinová simulace", 1, [
        ["500 m běh", "Kontrolované tempo."],
        ["500 m SkiErg", "Plynulý dlouhý záběr."],
        ["500 m běh", "Do 100 m srovnej krok."],
        ["25 m sled push", "Lehká až střední tréninková váha."],
        ["500 m běh", "Bez sprintu po saních."],
        ["30 m burpee broad jumps", "Stabilní rytmus a dopady."],
        ["500 m běh", "Stejné tempo jako první úsek."],
        ["500 m veslo", "Rovnoměrné záběry."],
      ]),
      manual(simulation01, "cooldown", "Zklidnění", 1, [
        ["8 min volně", "Chůze nebo lehký klus a mobilita."],
      ]),
    ],
  }),
  catalogTemplate({
    id: simulation02,
    title: "Race Simulation 02 · First Half",
    description: "První polovina HYROX formátu: čtyři kilometrové běhy a první čtyři stanoviště.",
    durationMinutes: 75,
    tags: ["simulace", "1 km", "skierg", "saně", "burpees"],
    code: "HYX-SIM-02",
    category: "race-simulation",
    goal: "Ověřit tempo první poloviny závodu a práci na saních bez plného objemu.",
    rpe: [7, 8],
    expectedDuration: [60, 85],
    runningTarget: "Cílové tempo plus 10–20 s/km; všechny čtyři běhy rovnoměrně.",
    primaryMetric: "Čas první poloviny a stabilita kilometrů",
    secondaryMetrics: ["čas saní", "burpee rytmus", "čas přechodů"],
    progressionGroup: "race-simulation",
    difficultyLevel: 2,
    blocks: [
      manual(simulation02, "warmup", "Závodní warm-up", 1, [
        ["12 min lehce", "Běh, mobilita a postupný nácvik všech použitých stanovišť."],
      ]),
      manual(simulation02, "main", "Poloviční simulace", 1, [
        ["1 km běh", "Kontrolovaný začátek."],
        ["1 000 m SkiErg", "Nepřepal první polovinu."],
        ["1 km běh", "Srovnej tempo do 200 m."],
        ["50 m sled push", "Tréninková váha podle zvolené divize a cílového RPE."],
        ["1 km běh", "Krátký krok po saních, potom rytmus."],
        ["50 m sled pull", "Plynulé kroky vzad a rychlé dobírání lana."],
        ["1 km běh", "Bez závěrečného sprintu."],
        ["80 m burpee broad jumps", "Stálý rytmus, čistá technika."],
      ]),
      manual(simulation02, "cooldown", "Zklidnění", 1, [
        ["10 min volně", "Doplň tekutiny a zapiš časy jednotlivých částí."],
      ]),
    ],
  }),
  catalogTemplate({
    id: simulation03,
    title: "Race Simulation 03 · Full HYROX",
    description: "Plná simulace oficiálního pořadí osmi běhů a osmi stanovišť.",
    durationMinutes: 100,
    tags: ["plná simulace", "8 km", "závod", "stanoviště"],
    code: "HYX-SIM-03",
    category: "race-simulation",
    goal: "Prověřit pacing, výživu, přechody a techniku v kompletním závodním formátu.",
    rpe: [8, 9],
    expectedDuration: [75, 125],
    runningTarget: "Realistické cílové HYROX tempo; první dva běhy záměrně konzervativně.",
    primaryMetric: "Celkový čas a stabilita osmi kilometrů",
    secondaryMetrics: ["Roxzone", "časy stanovišť", "počet neplánovaných pauz"],
    progressionGroup: "race-simulation",
    difficultyLevel: 3,
    blocks: [
      manual(simulation03, "warmup", "Kompletní závodní warm-up", 1, [
        ["15 min příprava", "Lehký běh, mobilita, 3 zrychlení a krátké nácviky stanovišť."],
      ]),
      manual(simulation03, "main", "Plný HYROX formát", 1, [
        ["1 km běh", "Konzervativní start."],
        ["1 000 m SkiErg", "Rovnoměrné tempo."],
        ["1 km běh", "Najdi cílový rytmus."],
        ["50 m sled push", "Soutěžní váha zvolené divize nebo bezpečná tréninková varianta."],
        ["1 km běh", "Po saních zkrať krok a postupně jej otevři."],
        ["50 m sled pull", "Plynulé dobírání lana."],
        ["1 km běh", "Kontroluj dech a kadenci."],
        ["80 m burpee broad jumps", "Stálý rytmus bez zbytečných sprintů."],
        ["1 km běh", "Vrať se k cílovému tempu."],
        ["1 000 m veslo", "Silné nohy, uvolněná ramena."],
        ["1 km běh", "Nenech tempo spadnout po vesle."],
        ["200 m farmers carry", "Krátké kroky a pevný trup."],
        ["1 km běh", "Připrav se na výpady."],
        ["100 m sandbag lunges", "Kontrolovaná opakování podle pravidel."],
        ["1 km běh", "Poslední kilometr zrychli až v druhé polovině."],
        ["100 wall balls", "Předem zvolený plán sérií, čistá opakování."],
      ]),
      manual(simulation03, "cooldown", "Po simulaci", 1, [
        ["10 min zklidnění", "Vychození, tekutiny a okamžitý zápis splitů a RPE."],
      ]),
    ],
  }),
  catalogTemplate({
    id: longEngine01,
    title: "Long Engine 01 · Easy 60",
    description: "Souvislá lehká vytrvalost pro odolnost nohou a aerobní základ.",
    durationMinutes: 60,
    tags: ["dlouhý běh", "z2", "vytrvalost"],
    code: "HYX-LNG-01",
    category: "long-engine",
    goal: "Prodloužit čas v nízké intenzitě bez výrazného tepového driftu.",
    rpe: [4, 5],
    expectedDuration: [55, 65],
    runningTarget: "Zóna 2; podle potřeby kombinuj běh a krátkou chůzi.",
    primaryMetric: "Čas v Z2",
    secondaryMetrics: ["tepový drift", "příjem tekutin", "RPE posledních 10 minut"],
    progressionGroup: "long-engine",
    difficultyLevel: 1,
    blocks: [
      manual(longEngine01, "warmup", "Pozvolný začátek", 1, [
        ["5 min chůze až lehký klus", "Začni opravdu volně."],
      ]),
      manual(longEngine01, "main", "Souvislá lehká práce", 1, [
        ["50 min Z2", "Běh, případně běh/chůze; udrž konverzační intenzitu."],
      ]),
      manual(longEngine01, "cooldown", "Zklidnění", 1, [
        ["5 min chůze", "Potom krátká mobilita chodidel, lýtek a kyčlí."],
      ]),
    ],
  }),
  catalogTemplate({
    id: longEngine02,
    title: "Long Engine 02 · Progressive 75",
    description: "Delší vytrvalost s pozvolným přechodem od Z2 ke střednímu tempu.",
    durationMinutes: 75,
    tags: ["dlouhý běh", "progrese", "z2", "z3"],
    code: "HYX-LNG-02",
    category: "long-engine",
    goal: "Udržet ekonomiku pohybu při delším zatížení a kontrolovaném závěru.",
    rpe: [5, 7],
    expectedDuration: [68, 80],
    runningTarget: "40 min Z2, 20 min středně, 5 min opět lehce.",
    primaryMetric: "Kontrolované zrychlení bez výrazného růstu RPE",
    secondaryMetrics: ["tepový drift", "kadence", "příjem tekutin"],
    progressionGroup: "long-engine",
    difficultyLevel: 2,
    blocks: [
      manual(longEngine02, "warmup", "Lehký začátek", 1, [
        ["10 min velmi lehce", "Uvolněný běh nebo kombinace běhu a chůze."],
      ]),
      manual(longEngine02, "main", "Progresivní vytrvalost", 1, [
        ["40 min Z2", "Konverzační tempo."],
        ["20 min střední tempo", "Horní Z2 až Z3, stále bez závodního úsilí."],
        ["5 min lehce", "Vrať tep a dech pod kontrolu."],
      ]),
      manual(longEngine02, "cooldown", "Zklidnění", 1, [
        ["5 min chůze a mobilita", "Lýtka, kyčle a chodidla."],
      ]),
    ],
  }),
  catalogTemplate({
    id: recovery01,
    title: "Recovery 01 · Easy Flush",
    description: "Velmi lehká jednotka pro aktivní zotavení a mobilitu.",
    durationMinutes: 30,
    tags: ["regenerace", "mobilita", "lehce"],
    code: "HYX-REC-01",
    category: "recovery",
    goal: "Podpořit zotavení bez přidání další významné únavy.",
    rpe: [2, 4],
    expectedDuration: [25, 35],
    runningTarget: "Velmi lehce; běh lze nahradit chůzí, kolem nebo ergometrem.",
    primaryMetric: "Nižší RPE po skončení než před začátkem",
    secondaryMetrics: ["pocit nohou", "rozsah pohybu", "klidné dýchání"],
    progressionGroup: "recovery",
    difficultyLevel: 1,
    blocks: [
      manual(recovery01, "easy", "Lehký pohyb", 1, [
        ["20 min velmi lehké cardio", "Chůze, klus, kolo nebo ergometr; pouze RPE 2–4."],
      ]),
      manual(recovery01, "mobility", "Mobilita", 2, [
        ["45 s kotníky a lýtka", "Každá strana, bez bolesti."],
        ["45 s kyčle", "Plynulé pozice a klidný dech."],
        ["45 s hrudní páteř", "Rotace v pohodlném rozsahu."],
        ["5 hlubokých nádechů", "Dlouhý výdech a uvolněná ramena."],
      ]),
    ],
  }),
  catalogTemplate({
    id: mixed02,
    title: "Mixed 02 · Compromised Running",
    description: "Středně dlouhé běhy prokládané ergometrem, carry a wall balls.",
    durationMinutes: 60,
    tags: ["běh", "compromised", "veslo", "carry", "wall balls"],
    code: "HYX-MIX-02",
    category: "mixed",
    goal: "Rychle obnovit běžeckou techniku po různých typech funkční práce.",
    rpe: [7, 8],
    expectedDuration: [52, 65],
    runningTarget: "Kontrolované HYROX tempo; první 200 m po stanovišti bez sprintu.",
    primaryMetric: "Čas potřebný k návratu do cílového běžeckého tempa",
    secondaryMetrics: ["čas kol", "wall ball série", "síla úchopu"],
    progressionGroup: "mixed",
    difficultyLevel: 2,
    blocks: [
      manual(mixed02, "warmup", "Dynamický warm-up", 1, [
        ["10 min lehce", "Běh a krátký nácvik použitých stanovišť."],
      ]),
      manual(mixed02, "main", "5 kompromitovaných kol", 5, [
        ["800 m běh", "Stejné tempo v každém kole."],
        ["400 m SkiErg nebo veslo", "Stroje střídej po kolech."],
        ["12 wall balls", "Jedna plynulá série nebo plánované 6 + 6."],
        ["40 m farmers carry", "Střední váha, nepokládej uprostřed úseku."],
      ]),
      manual(mixed02, "cooldown", "Zklidnění", 1, [
        ["8 min volně", "Výklus nebo chůze a mobilita."],
      ]),
    ],
  }),
];
