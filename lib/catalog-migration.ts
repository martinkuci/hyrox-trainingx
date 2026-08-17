import type { WorkoutTemplate } from "./types";

export function upgradeCatalogTemplates(
  stored: WorkoutTemplate[],
  storedCatalogVersion: number,
  fallbackTemplates: WorkoutTemplate[],
  currentCatalogVersion: number,
) {
  if (storedCatalogVersion >= currentCatalogVersion) return stored;

  const legacySeedTimestamp = "2026-07-14T00:00:00.000Z";
  const fallbackById = new Map(fallbackTemplates.map((template) => [template.id, template]));
  const upgraded = stored.map((template) => {
    const catalogTemplate = fallbackById.get(template.id);
    const isUnmodifiedLegacyDefault =
      template.id === "hyrox-02" &&
      !template.metadata &&
      template.createdAt === legacySeedTimestamp &&
      template.updatedAt === legacySeedTimestamp;
    const isUnmodifiedCatalogTemplate = Boolean(
      catalogTemplate &&
      template.createdAt === catalogTemplate.createdAt &&
      template.updatedAt === catalogTemplate.updatedAt,
    );
    return isUnmodifiedLegacyDefault || isUnmodifiedCatalogTemplate
      ? catalogTemplate ?? template
      : template;
  });
  const existingIds = new Set(upgraded.map((template) => template.id));

  return [
    ...upgraded,
    ...fallbackTemplates.filter((template) => !existingIds.has(template.id)),
  ];
}
