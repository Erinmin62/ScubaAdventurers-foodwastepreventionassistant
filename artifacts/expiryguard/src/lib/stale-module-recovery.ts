/** A live update can leave an older React dependency loaded in an open preview. */
export function isStaleModuleError(error: Error): boolean {
  return /invalid hook call|failed to fetch dynamically imported module|outdated optimize dep|cannot read properties of null \(reading ['"]use(?:State|Effect|Memo|Context|Ref|Reducer|Callback|SyncExternalStore)['"]\)/i.test(error.message);
}

/** Permit only one automatic recovery per minute, never an endless reload loop. */
export function claimRecovery(storage: Pick<Storage, 'getItem' | 'setItem'>, now: number): boolean {
  const key = 'expiryguard:last-module-recovery';
  try {
    const previous = storage.getItem(key);
    if (previous !== null && now - Number(previous) < 60_000) return false;
    storage.setItem(key, String(now));
    return true;
  } catch {
    // If browser storage is unavailable, leave the manual reload control usable.
    return false;
  }
}
