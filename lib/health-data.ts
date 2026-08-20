export type HealthPlatform = "apple-health" | "health-connect" | "unavailable";

export type HealthPermissionState = "unknown" | "unsupported" | "not-requested" | "denied" | "granted";

export type HealthMetricId =
  | "resting-heart-rate"
  | "heart-rate-variability"
  | "sleep"
  | "steps"
  | "active-energy"
  | "workouts"
  | "running-distance"
  | "weight";

export type HealthMetricDefinition = {
  id: HealthMetricId;
  label: string;
  shortLabel: string;
  description: string;
  unit?: string;
};

export type HealthMetricSnapshot = {
  metricId: HealthMetricId;
  value: number | null;
  unit?: string;
  recordedAt?: string;
};

export type HealthConnectionStatus = {
  platform: HealthPlatform;
  available: boolean;
  permission: HealthPermissionState;
  lastSyncAt?: string;
};

export interface HealthDataProvider {
  getStatus(): Promise<HealthConnectionStatus>;
  requestPermissions(metrics: HealthMetricId[]): Promise<HealthConnectionStatus>;
  readLatest(metrics: HealthMetricId[]): Promise<HealthMetricSnapshot[]>;
}

export const HEALTH_METRICS: HealthMetricDefinition[] = [
  {
    id: "resting-heart-rate",
    label: "Klidový tep",
    shortLabel: "RHR",
    description: "Dlouhodobý trend regenerace a reakce organismu na zátěž.",
    unit: "bpm",
  },
  {
    id: "heart-rate-variability",
    label: "Variabilita srdečního tepu",
    shortLabel: "HRV",
    description: "Jeden ze signálů připravenosti a autonomní regenerace.",
    unit: "ms",
  },
  {
    id: "sleep",
    label: "Spánek",
    shortLabel: "Spánek",
    description: "Délka a později i kvalita spánku pro recovery doporučení.",
    unit: "h",
  },
  {
    id: "steps",
    label: "Denní aktivita",
    shortLabel: "Kroky",
    description: "Doplňkový pohled na celkovou denní pohybovou zátěž.",
    unit: "kroků",
  },
  {
    id: "active-energy",
    label: "Aktivní energie",
    shortLabel: "Energie",
    description: "Doplňkový ukazatel objemu pohybu během dne.",
    unit: "kcal",
  },
  {
    id: "workouts",
    label: "Tréninky",
    shortLabel: "Tréninky",
    description: "Historie aktivit zaznamenaných telefonem nebo hodinkami.",
  },
  {
    id: "running-distance",
    label: "Běžecká vzdálenost",
    shortLabel: "Běh",
    description: "Objem běhu pro budoucí práci s running loadem.",
    unit: "km",
  },
  {
    id: "weight",
    label: "Hmotnost",
    shortLabel: "Váha",
    description: "Volitelný dlouhodobý trend tělesné hmotnosti.",
    unit: "kg",
  },
];

class PwaHealthDataProvider implements HealthDataProvider {
  async getStatus(): Promise<HealthConnectionStatus> {
    return {
      platform: "unavailable",
      available: false,
      permission: "unsupported",
    };
  }

  async requestPermissions(): Promise<HealthConnectionStatus> {
    return this.getStatus();
  }

  async readLatest(): Promise<HealthMetricSnapshot[]> {
    return [];
  }
}

export const healthDataProvider: HealthDataProvider = new PwaHealthDataProvider();

export function getHealthPlatformCopy() {
  return {
    apple: {
      title: "Apple Health",
      technicalName: "HealthKit",
      description: "Po převodu Enginnu přes Capacitor připojíme zdravotní a fitness data uložená v Apple Health.",
    },
    android: {
      title: "Health Connect",
      technicalName: "Android Health Connect",
      description: "Na Androidu připojíme stejnou datovou vrstvu přes Health Connect.",
    },
  } as const;
}
