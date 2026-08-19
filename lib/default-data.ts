import type { HyroxData } from "./types";
import {
  HYROX_02_TEMPLATE,
  TRAINING_CATALOG,
  TRAINING_CATALOG_VERSION,
} from "./training-catalog";

export { HYROX_02_TEMPLATE };

export const DEFAULT_HYROX_DATA: HyroxData = {
  version: 1,
  catalogVersion: TRAINING_CATALOG_VERSION,
  templates: TRAINING_CATALOG,
  scheduledWorkouts: [],
  results: [],
  weeklyPlans: [],
  trainingPrograms: [],
  trainingLocations: [],
};

export function createDefaultHyroxData(): HyroxData {
  return JSON.parse(JSON.stringify(DEFAULT_HYROX_DATA)) as HyroxData;
}
