export type CloudInitializationAction =
  | "local"
  | "offline"
  | "upload"
  | "blocked"
  | "download";

type InitializationInput = {
  userId: string | null;
  online: boolean;
  pending: boolean;
  pendingUserId: string | null;
};

export function decideCloudInitialization({
  userId,
  online,
  pending,
  pendingUserId,
}: InitializationInput): CloudInitializationAction {
  if (!userId) return "local";
  if (!online) return "offline";
  if (pending && pendingUserId === userId) return "upload";
  if (pending) return "blocked";
  return "download";
}

export function hasNewerLocalChanges(
  sequenceAtUploadStart: number,
  currentSequence: number,
) {
  return sequenceAtUploadStart !== currentSequence;
}
