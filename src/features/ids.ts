/** A short unique id for players and one-off teams (fits the 40-character database limit). */
export function newRecordId(): string {
  return `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
