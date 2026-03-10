import type { Card, Rank, Suit } from "../app/lib/types.js";
import { SUITS, RANKS, SHOE_SIZE, CUT_CARD_PENETRATION } from "../app/lib/constants.js";

export class Deck {
  private cards: Card[] = [];
  private dealtCount = 0;

  constructor() {
    this.build();
    this.shuffle();
  }

  private build(): void {
    this.cards = [];
    // 6 decks
    for (let d = 0; d < 6; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          this.cards.push({ suit, rank, faceDown: false });
        }
      }
    }
    this.dealtCount = 0;
  }

  private shuffle(): void {
    const arr = this.cards;
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  deal(faceDown = false): Card {
    if (this.cards.length === 0) {
      this.build();
      this.shuffle();
    }
    const card = { ...this.cards.pop()!, faceDown };
    this.dealtCount++;
    return card;
  }

  get cardsRemaining(): number {
    return this.cards.length;
  }

  get penetration(): number {
    return this.dealtCount / SHOE_SIZE;
  }

  get needsShuffle(): boolean {
    return this.penetration >= CUT_CARD_PENETRATION;
  }

  reshuffle(): void {
    this.build();
    this.shuffle();
  }
}
