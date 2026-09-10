/**
 * The demand-gap sentence on a Career compass recommendation card.
 *
 * Pure so the 0 / 1 / many cases can be tested without a database. Every
 * count in this sentence really does reach zero and one in production:
 * before 2026-09-10 the card read "14 searches over the last 90 days
 * mention this skill and only 0 people on Sebenza carries it", which is
 * two grammar faults and one sentence a seeker should never have to read.
 */

export const DEMAND_WINDOW_DAYS = 90;

export function demandDetail(searches: number, matches: number): string {
  const demand =
    `${searches} ${searches === 1 ? "search" : "searches"} in the last ` +
    `${DEMAND_WINDOW_DAYS} days ${searches === 1 ? "mentions" : "mention"} this skill`;
  const supply =
    matches === 0
      ? "nobody on Sebenza has it yet"
      : matches === 1
        ? "only 1 person on Sebenza has it"
        : `only ${matches} people on Sebenza have it`;
  return `${demand}, and ${supply}.`;
}
