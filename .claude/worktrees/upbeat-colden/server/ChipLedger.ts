// In-memory daily chip ledger. Tracks when each playerId last received their daily allotment.
// Resets are based on UTC date (YYYY-MM-DD).

interface LedgerEntry {
  lastAwardedDate: string; // "YYYY-MM-DD" UTC
  chips: number;
}

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export class ChipLedger {
  private entries = new Map<string, LedgerEntry>();

  /** Returns current chip balance, awarding daily chips if needed. */
  getChips(playerId: string, dailyAmount: number): number {
    const today = utcDate();
    const entry = this.entries.get(playerId);

    if (!entry) {
      this.entries.set(playerId, { lastAwardedDate: today, chips: dailyAmount });
      return dailyAmount;
    }

    if (entry.lastAwardedDate !== today) {
      const newChips = entry.chips + dailyAmount;
      this.entries.set(playerId, { lastAwardedDate: today, chips: newChips });
      return newChips;
    }

    return entry.chips;
  }

  setChips(playerId: string, chips: number): void {
    const today = utcDate();
    const entry = this.entries.get(playerId);
    this.entries.set(playerId, {
      lastAwardedDate: entry?.lastAwardedDate ?? today,
      chips,
    });
  }

  adjustChips(playerId: string, delta: number, dailyAmount: number): number {
    const current = this.getChips(playerId, dailyAmount);
    const next = Math.max(0, current + delta);
    this.setChips(playerId, next);
    return next;
  }
}
