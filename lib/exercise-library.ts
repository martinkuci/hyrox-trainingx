import type { EquipmentId } from "./types";

export type ExerciseCategory =
  | "hyrox"
  | "running"
  | "conditioning"
  | "strength"
  | "warmup"
  | "mobility"
  | "compensation"
  | "recovery";

export type TeamWorkMode =
  | "solo"
  | "simultaneous"
  | "shared-reps"
  | "shared-distance"
  | "relay"
  | "you-go-i-go";

export type ExerciseTeamCapabilities = {
  modes: TeamWorkMode[];
  requiresSingleStation?: boolean;
  supportsIndependentTracking: boolean;
};

export type ExerciseEquipmentRequirement = {
  anyOf: EquipmentId[];
};

export type ExerciseDefinition = {
  id: string;
  name: string;
  aliases: string[];
  category: ExerciseCategory;
  movementFamily: string;
  equipment: ExerciseEquipmentRequirement[];
  primaryMuscles: string[];
  purposes: string[];
  instructions: string[];
  cues: string[];
  commonMistakes: string[];
  regressions: string[];
  progressions: string[];
  alternatives: string[];
  tags: string[];
  team: ExerciseTeamCapabilities;
};

const eq = (...anyOf: EquipmentId[]): ExerciseEquipmentRequirement => ({ anyOf });
const team = (
  modes: TeamWorkMode[],
  options: Partial<Omit<ExerciseTeamCapabilities, "modes">> = {},
): ExerciseTeamCapabilities => ({
  modes,
  supportsIndependentTracking: true,
  ...options,
});

export const EXERCISE_LIBRARY: ExerciseDefinition[] = [
  {
    id: "run",
    name: "Běh",
    aliases: ["run", "running", "klus"],
    category: "running",
    movementFamily: "locomotion",
    equipment: [eq("running", "treadmill")],
    primaryMuscles: ["nohy", "lýtka", "hýždě"],
    purposes: ["aerobní kapacita", "tempo", "race specificity"],
    instructions: ["Drž vzpřímený postoj a přirozený krok.", "Tempo přizpůsob cíli konkrétního úseku."],
    cues: ["Lehký dopad", "Uvolněná ramena", "Stabilní rytmus"],
    commonMistakes: ["Přepálený začátek", "Příliš dlouhý krok", "Zbytečné napětí ramen"],
    regressions: ["run-walk"],
    progressions: ["incline-run"],
    alternatives: ["row", "ski-erg", "bike-erg"],
    tags: ["hyrox", "engine", "cardio"],
    team: team(["solo", "simultaneous", "relay"]),
  },
  {
    id: "ski-erg",
    name: "SkiErg",
    aliases: ["ski erg", "skierg"],
    category: "hyrox",
    movementFamily: "pull-conditioning",
    equipment: [eq("ski-erg")],
    primaryMuscles: ["záda", "triceps", "core", "hamstringy"],
    purposes: ["HYROX stanoviště", "engine", "lat endurance"],
    instructions: ["Začni pohybem trupu a kyčlí, paže dokončují záběr.", "Vrať se plynule nahoru bez zbytečného čekání."],
    cues: ["Dlouhý záběr", "Žebra dolů", "Ruce dokončí pohyb"],
    commonMistakes: ["Tah jen rukama", "Příliš hluboký dřep", "Ztráta rytmu"],
    regressions: [],
    progressions: [],
    alternatives: ["row", "bike-erg"],
    tags: ["hyrox", "erg", "cardio"],
    team: team(["solo", "shared-distance", "you-go-i-go"], { requiresSingleStation: true }),
  },
  {
    id: "sled-push",
    name: "Sled Push",
    aliases: ["sled push", "tlačení saní"],
    category: "hyrox",
    movementFamily: "horizontal-push",
    equipment: [eq("sled")],
    primaryMuscles: ["kvadricepsy", "hýždě", "lýtka", "core"],
    purposes: ["HYROX stanoviště", "síla nohou", "lokální vytrvalost"],
    instructions: ["Opři se do saní pevným trupem a krátkými silovými kroky.", "Tlak drž nepřetržitě přes celé chodidlo."],
    cues: ["Tělo jako jeden celek", "Krátké kroky", "Tlač zem dozadu"],
    commonMistakes: ["Příliš vysoký postoj", "Propad beder", "Dlouhé kroky"],
    regressions: ["sled-push-light"],
    progressions: ["sled-push-heavy"],
    alternatives: ["walking-lunge", "heavy-step-up"],
    tags: ["hyrox", "sled", "strength-endurance"],
    team: team(["solo", "shared-distance", "you-go-i-go"], { requiresSingleStation: true }),
  },
  {
    id: "sled-pull",
    name: "Sled Pull",
    aliases: ["sled pull", "přitahování saní"],
    category: "hyrox",
    movementFamily: "horizontal-pull",
    equipment: [eq("sled")],
    primaryMuscles: ["záda", "biceps", "zadní řetězec", "core"],
    purposes: ["HYROX stanoviště", "grip", "síla zad"],
    instructions: ["Drž stabilní postoj a přitahuj lano plynule k tělu.", "Po každém záběru rychle zkrať vzdálenost k saním."],
    cues: ["Pevný střed", "Lokty dozadu", "Plynulé lano"],
    commonMistakes: ["Tah pouze pažemi", "Ztráta stability", "Šlapání na lano"],
    regressions: ["sled-pull-light"],
    progressions: ["sled-pull-heavy"],
    alternatives: ["cable-row", "farmer-carry"],
    tags: ["hyrox", "sled", "grip"],
    team: team(["solo", "shared-distance", "you-go-i-go"], { requiresSingleStation: true }),
  },
  {
    id: "burpee-broad-jump",
    name: "Burpee Broad Jump",
    aliases: ["burpee broad jump", "bbj"],
    category: "hyrox",
    movementFamily: "burpee-jump",
    equipment: [],
    primaryMuscles: ["celé tělo", "kvadricepsy", "ramena", "core"],
    purposes: ["HYROX stanoviště", "výbušnost", "conditioning"],
    instructions: ["Burpee dokonči stabilním postavením a navazuj skokem vpřed.", "Dopadej měkce a kontrolovaně."],
    cues: ["Plynulý rytmus", "Měkký dopad", "Šetři kroky navíc"],
    commonMistakes: ["Zbytečné zastavení mezi burpee a skokem", "Tvrdý dopad", "Přepálená frekvence"],
    regressions: ["burpee-step-forward"],
    progressions: [],
    alternatives: ["burpee", "walking-lunge"],
    tags: ["hyrox", "bodyweight", "conditioning"],
    team: team(["solo", "shared-distance", "you-go-i-go"]),
  },
  {
    id: "row",
    name: "Veslo",
    aliases: ["row", "rower", "rowing"],
    category: "hyrox",
    movementFamily: "row-conditioning",
    equipment: [eq("rower")],
    primaryMuscles: ["nohy", "záda", "paže", "core"],
    purposes: ["HYROX stanoviště", "engine", "power endurance"],
    instructions: ["Záběr začíná nohama, navazuje trup a až potom paže.", "Při návratu postupuj opačně: ruce, trup, nohy."],
    cues: ["Nohy–trup–ruce", "Klidný návrat", "Stejný split"],
    commonMistakes: ["Brzký tah pažemi", "Příliš rychlý návrat", "Kolaps zad"],
    regressions: [],
    progressions: [],
    alternatives: ["ski-erg", "bike-erg"],
    tags: ["hyrox", "erg", "cardio"],
    team: team(["solo", "shared-distance", "you-go-i-go"], { requiresSingleStation: true }),
  },
  {
    id: "farmer-carry",
    name: "Farmers Carry",
    aliases: ["farmers carry", "farmer carry"],
    category: "hyrox",
    movementFamily: "loaded-carry",
    equipment: [eq("kettlebell", "dumbbell")],
    primaryMuscles: ["úchop", "trapézy", "core", "nohy"],
    purposes: ["HYROX stanoviště", "grip", "posturální síla"],
    instructions: ["Nes břemena po stranách s pevným trupem a krátkým stabilním krokem."],
    cues: ["Vysoký postoj", "Pevný úchop", "Žebra nad pánví"],
    commonMistakes: ["Naklánění do stran", "Shrbení", "Příliš dlouhý krok"],
    regressions: ["farmer-carry-light"],
    progressions: ["farmer-carry-heavy"],
    alternatives: ["sandbag-carry"],
    tags: ["hyrox", "carry", "grip"],
    team: team(["solo", "shared-distance", "you-go-i-go"]),
  },
  {
    id: "sandbag-lunge",
    name: "Sandbag Lunges",
    aliases: ["sandbag lunge", "sandbag lunges"],
    category: "hyrox",
    movementFamily: "lunge",
    equipment: [eq("sandbag")],
    primaryMuscles: ["kvadricepsy", "hýždě", "core"],
    purposes: ["HYROX stanoviště", "unilateral strength", "strength endurance"],
    instructions: ["Drž sandbag stabilně a střídej kontrolované výpady vpřed.", "Koleno zadní nohy míří k zemi, trup zůstává pevný."],
    cues: ["Stabilní trup", "Celé chodidlo", "Plynulé střídání"],
    commonMistakes: ["Padání kolena dovnitř", "Předklon", "Krátký nekontrolovaný krok"],
    regressions: ["walking-lunge"],
    progressions: ["sandbag-lunge-heavy"],
    alternatives: ["walking-lunge", "dumbbell-lunge"],
    tags: ["hyrox", "lunge", "legs"],
    team: team(["solo", "shared-distance", "shared-reps", "you-go-i-go"]),
  },
  {
    id: "wall-ball",
    name: "Wall Ball",
    aliases: ["wall ball", "wallball"],
    category: "hyrox",
    movementFamily: "squat-throw",
    equipment: [eq("wall-ball")],
    primaryMuscles: ["kvadricepsy", "hýždě", "ramena", "core"],
    purposes: ["HYROX stanoviště", "squat endurance", "finisher"],
    instructions: ["Proveď plný dřep a z výstupu plynule hoď míč na cíl.", "Míč přijmi před tělem a hned pokračuj do dalšího opakování."],
    cues: ["Dřep pod kontrolou", "Síla z nohou", "Chyť a pokračuj"],
    commonMistakes: ["Mělký dřep", "Házení jen rukama", "Pozdní zachycení míče"],
    regressions: ["medicine-ball-thruster"],
    progressions: ["wall-ball-heavy"],
    alternatives: ["dumbbell-thruster", "medicine-ball-thruster"],
    tags: ["hyrox", "wall-ball", "squat"],
    team: team(["solo", "shared-reps", "you-go-i-go"], { requiresSingleStation: true }),
  },
  {
    id: "dumbbell-thruster",
    name: "Dumbbell Thruster",
    aliases: ["db thruster", "dumbbell thruster"],
    category: "conditioning",
    movementFamily: "squat-press",
    equipment: [eq("dumbbell")],
    primaryMuscles: ["kvadricepsy", "hýždě", "ramena", "triceps"],
    purposes: ["conditioning", "náhrada wall ball", "full body"],
    instructions: ["Spoj dřep s plynulým tlakem jednoruček nad hlavu."],
    cues: ["Síla z nohou", "Pevný střed", "Dokonči nad hlavou"],
    commonMistakes: ["Pauza mezi dřepem a tlakem", "Prohnutí beder"],
    regressions: ["dumbbell-front-squat"],
    progressions: [],
    alternatives: ["wall-ball", "medicine-ball-thruster"],
    tags: ["full-body", "conditioning"],
    team: team(["solo", "simultaneous", "shared-reps", "you-go-i-go"]),
  },
  {
    id: "walking-lunge",
    name: "Walking Lunge",
    aliases: ["walking lunge", "výpady v chůzi"],
    category: "strength",
    movementFamily: "lunge",
    equipment: [],
    primaryMuscles: ["kvadricepsy", "hýždě", "hamstringy"],
    purposes: ["síla nohou", "kompenzační objem", "náhrada sandbag lunge"],
    instructions: ["Střídej dlouhé stabilní výpady s kontrolou kolene a trupu."],
    cues: ["Celé přední chodidlo", "Koleno sleduje špičku", "Pevný trup"],
    commonMistakes: ["Úzká linie kroků", "Koleno dovnitř", "Odraz jen ze špičky"],
    regressions: ["reverse-lunge"],
    progressions: ["dumbbell-lunge", "sandbag-lunge"],
    alternatives: ["step-up"],
    tags: ["legs", "unilateral"],
    team: team(["solo", "simultaneous", "shared-reps", "shared-distance", "you-go-i-go"]),
  },
  {
    id: "air-squat",
    name: "Air Squat",
    aliases: ["bodyweight squat", "dřep"],
    category: "warmup",
    movementFamily: "squat",
    equipment: [],
    primaryMuscles: ["kvadricepsy", "hýždě", "core"],
    purposes: ["warm-up", "technika dřepu", "aktivace"],
    instructions: ["Sedni mezi kyčle, drž celé chodidlo na zemi a vrať se do stoje."],
    cues: ["Kolena ven", "Hrudník vysoko", "Celé chodidlo"],
    commonMistakes: ["Paty od země", "Kolena dovnitř", "Kolaps trupu"],
    regressions: ["box-squat"],
    progressions: ["goblet-squat"],
    alternatives: [],
    tags: ["warmup", "bodyweight"],
    team: team(["solo", "simultaneous", "shared-reps"]),
  },
  {
    id: "dead-bug",
    name: "Dead Bug",
    aliases: ["dead bug"],
    category: "compensation",
    movementFamily: "core-stability",
    equipment: [],
    primaryMuscles: ["core"],
    purposes: ["stabilita trupu", "kompenzace", "warm-up"],
    instructions: ["Udržuj bedra lehce opřená o podložku a střídavě natahuj protilehlou paži a nohu."],
    cues: ["Žebra dolů", "Pomalu", "Bedra stabilní"],
    commonMistakes: ["Prohnutí beder", "Příliš rychlé tempo"],
    regressions: ["heel-tap"],
    progressions: ["banded-dead-bug"],
    alternatives: ["bird-dog"],
    tags: ["core", "prehab", "compensation"],
    team: team(["solo", "simultaneous"]),
  },
  {
    id: "bird-dog",
    name: "Bird Dog",
    aliases: ["bird dog"],
    category: "compensation",
    movementFamily: "core-stability",
    equipment: [],
    primaryMuscles: ["core", "hýždě", "záda"],
    purposes: ["stabilita trupu", "kompenzace", "kontrola pánve"],
    instructions: ["Z pozice na čtyřech natahuj protilehlou ruku a nohu bez rotace trupu."],
    cues: ["Pánev rovně", "Dlouhý dosah", "Pomalý návrat"],
    commonMistakes: ["Rotace pánve", "Prohnutí zad"],
    regressions: [],
    progressions: ["bird-dog-row"],
    alternatives: ["dead-bug"],
    tags: ["core", "prehab", "compensation"],
    team: team(["solo", "simultaneous"]),
  },
  {
    id: "ankle-rock",
    name: "Mobilita kotníku – knee to wall",
    aliases: ["ankle mobility", "knee to wall"],
    category: "mobility",
    movementFamily: "ankle-mobility",
    equipment: [],
    primaryMuscles: ["kotník", "lýtko"],
    purposes: ["mobilita kotníku", "příprava dřepu", "běžecká mechanika"],
    instructions: ["Posouvej koleno vpřed nad špičku bez zvednutí paty."],
    cues: ["Pata na zemi", "Koleno sleduje špičku", "Bez bolesti"],
    commonMistakes: ["Zvedání paty", "Rotace chodidla"],
    regressions: [],
    progressions: [],
    alternatives: ["calf-stretch"],
    tags: ["mobility", "ankle", "compensation"],
    team: team(["solo", "simultaneous"]),
  },
  {
    id: "hip-flexor-stretch",
    name: "Hip Flexor Stretch",
    aliases: ["hip flexor stretch", "protažení flexorů kyčle"],
    category: "mobility",
    movementFamily: "hip-mobility",
    equipment: [],
    primaryMuscles: ["flexory kyčle", "kvadriceps"],
    purposes: ["cool-down", "kompenzace běhu", "mobilita kyčle"],
    instructions: ["V kleku podsad pánev a posuň tělo lehce vpřed bez prohnutí beder."],
    cues: ["Podsadit pánev", "Žebra dolů", "Jemný tah"],
    commonMistakes: ["Prohnutí beder", "Příliš agresivní rozsah"],
    regressions: [],
    progressions: [],
    alternatives: [],
    tags: ["mobility", "hips", "recovery"],
    team: team(["solo", "simultaneous"]),
  },
  {
    id: "thoracic-rotation",
    name: "Thoracic Rotation",
    aliases: ["t-spine rotation", "thoracic rotation"],
    category: "mobility",
    movementFamily: "thoracic-mobility",
    equipment: [],
    primaryMuscles: ["hrudní páteř", "ramena"],
    purposes: ["mobilita hrudní páteře", "příprava wall ball", "kompenzace"],
    instructions: ["Rotuj hrudník kontrolovaně bez velkého pohybu pánve."],
    cues: ["Dýchej do rozsahu", "Pánev stabilní", "Pohyb z hrudníku"],
    commonMistakes: ["Rotace jen paží", "Pohyb pánve"],
    regressions: [],
    progressions: [],
    alternatives: [],
    tags: ["mobility", "t-spine", "shoulders"],
    team: team(["solo", "simultaneous"]),
  },
  {
    id: "band-pull-apart",
    name: "Band Pull Apart",
    aliases: ["band pull apart"],
    category: "compensation",
    movementFamily: "scapular-control",
    equipment: [eq("resistance-band")],
    primaryMuscles: ["zadní ramena", "mezilopatkové svaly"],
    purposes: ["aktivace lopatek", "kompenzace tlaku", "držení těla"],
    instructions: ["Roztahuj gumu před hrudníkem bez zvedání ramen."],
    cues: ["Ramena dolů", "Lopatky k sobě", "Kontrolovaný návrat"],
    commonMistakes: ["Pokrčené zápěstí", "Ramena k uším", "Švih"],
    regressions: [],
    progressions: [],
    alternatives: ["face-pull"],
    tags: ["prehab", "shoulders", "compensation"],
    team: team(["solo", "simultaneous"]),
  },
];

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  hyrox: "HYROX",
  running: "Běh",
  conditioning: "Conditioning",
  strength: "Síla",
  warmup: "Warm-up",
  mobility: "Mobilita",
  compensation: "Kompenzace",
  recovery: "Regenerace",
};

export function getExercise(exerciseId: string | undefined) {
  if (!exerciseId) return undefined;
  return EXERCISE_LIBRARY.find((exercise) => exercise.id === exerciseId);
}

export function exerciseFitsEquipment(exercise: ExerciseDefinition, equipment: EquipmentId[]) {
  const available = new Set<EquipmentId>(["none", ...equipment]);
  return exercise.equipment.every((requirement) => requirement.anyOf.some((item) => available.has(item)));
}

export function exerciseEquipmentLabels(exercise: ExerciseDefinition, labels: Record<EquipmentId, string>) {
  return exercise.equipment.map((requirement) => requirement.anyOf.map((item) => labels[item]).join(" / "));
}

export function findExerciseAlternatives(exerciseId: string, equipment: EquipmentId[]) {
  const source = getExercise(exerciseId);
  if (!source) return [];
  const preferred = new Set(source.alternatives);
  return EXERCISE_LIBRARY
    .filter((candidate) => candidate.id !== source.id && exerciseFitsEquipment(candidate, equipment))
    .map((candidate) => ({
      exercise: candidate,
      score:
        (preferred.has(candidate.id) ? 0 : 20) +
        (candidate.movementFamily === source.movementFamily ? 0 : 10) +
        (candidate.category === source.category ? 0 : 5),
    }))
    .sort((a, b) => a.score - b.score || a.exercise.name.localeCompare(b.exercise.name, "cs"))
    .map((item) => item.exercise);
}
