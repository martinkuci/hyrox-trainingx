const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function secureRandom() {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const value = crypto.getRandomValues(new Uint32Array(1))[0];
    return value / 0x1_0000_0000;
  }
  return Math.random();
}

export function createTeamJoinCode(random: () => number = secureRandom) {
  const token = Array.from({ length: 8 }, () => ALPHABET[Math.floor(random() * ALPHABET.length) % ALPHABET.length]).join("");
  return `ENG-${token.slice(0, 4)}-${token.slice(4)}`;
}

export function normalizeTeamJoinCode(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const token = compact.startsWith("ENG") ? compact.slice(3) : compact;
  if (token.length !== 8) return value.trim().toUpperCase();
  return `ENG-${token.slice(0, 4)}-${token.slice(4)}`;
}

export function isValidTeamJoinCode(value: string) {
  return /^ENG-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(normalizeTeamJoinCode(value));
}
