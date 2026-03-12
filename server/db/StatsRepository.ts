import { eq, sql } from "drizzle-orm";
import { db } from "./client.js";
import { playerStats } from "./schema.js";
import type { RoundResult, Player } from "../../app/lib/types.js";

export async function recordRoundResults(
  results: RoundResult[],
  players: Player[]
): Promise<void> {
  const playerMap = new Map(players.map((p) => [p.playerId, p]));

  // Group results by player
  const byPlayer = new Map<string, RoundResult[]>();
  for (const result of results) {
    const list = byPlayer.get(result.playerId) ?? [];
    list.push(result);
    byPlayer.set(result.playerId, list);
  }

  await Promise.all(
    Array.from(byPlayer.entries()).map(async ([playerId, playerResults]) => {
      const player = playerMap.get(playerId);
      if (!player) return;

      let handsPlayed = 0;
      let handsWon = 0;
      let handsLost = 0;
      let handsPushed = 0;
      let blackjacks = 0;
      let totalWagered = 0;
      let netWinnings = 0;
      let biggestWin = 0;
      let biggestBet = 0;
      let splitsMade = 0;
      let doublesMade = 0;
      let timesBusted = 0;

      for (const result of playerResults) {
        const hand = player.hands.find((h) => h.handId === result.handId);
        if (!hand) continue;

        handsPlayed++;
        totalWagered += hand.bet;
        const netGain = result.payout - hand.bet;
        netWinnings += netGain;

        if (hand.bet > biggestBet) biggestBet = hand.bet;
        if (netGain > biggestWin) biggestWin = netGain;

        if (hand.splitFromHandId !== null) splitsMade++;
        if (hand.doubled) doublesMade++;

        switch (result.result) {
          case "win":
          case "blackjack":
            handsWon++;
            break;
          case "lose":
            handsLost++;
            break;
          case "bust":
            handsLost++;
            timesBusted++;
            break;
          case "push":
            handsPushed++;
            break;
        }

        if (result.result === "blackjack") blackjacks++;
      }

      await db
        .update(playerStats)
        .set({
          handsPlayed: sql`${playerStats.handsPlayed} + ${handsPlayed}`,
          handsWon: sql`${playerStats.handsWon} + ${handsWon}`,
          handsLost: sql`${playerStats.handsLost} + ${handsLost}`,
          handsPushed: sql`${playerStats.handsPushed} + ${handsPushed}`,
          blackjacks: sql`${playerStats.blackjacks} + ${blackjacks}`,
          totalWagered: sql`${playerStats.totalWagered} + ${totalWagered}`,
          netWinnings: sql`${playerStats.netWinnings} + ${netWinnings}`,
          biggestWin: sql`GREATEST(${playerStats.biggestWin}, ${biggestWin})`,
          biggestBet: sql`GREATEST(${playerStats.biggestBet}, ${biggestBet})`,
          splitsMade: sql`${playerStats.splitsMade} + ${splitsMade}`,
          doublesMade: sql`${playerStats.doublesMade} + ${doublesMade}`,
          timesBusted: sql`${playerStats.timesBusted} + ${timesBusted}`,
          updatedAt: new Date(),
        })
        .where(eq(playerStats.playerId, playerId));
    })
  );
}
