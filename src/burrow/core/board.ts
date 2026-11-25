import { Beetle, BurrowStore, Facing, Pebble, PebbleState, Position } from '../types';
import { inBounds, samePosition } from './ai';

/** Queries about the board that the wombat, the beetles and the pebbles all rely on. */

export const cloneSoil = (soil: number[][]) => soil.map((column) => [...column]);

/** Remaining hardness of a cell: 0 for open tunnel (or anywhere off the board, such as the den). */
export const soilAt = (store: BurrowStore, p: Position) => (inBounds(p) ? store.soil[p.x][p.y] : 0);

export const isTunnel = (store: BurrowStore, p: Position) => inBounds(p) && store.soil[p.x][p.y] === 0;

export const countSoil = (soil: number[][]) => soil.reduce((sum, column) => sum + column.filter((h) => h > 0).length, 0);

/** The pebble occupying `p`, if any. A pebble is solid until it has crumbled away completely. */
export const pebbleAt = (store: BurrowStore, p: Position): Pebble | undefined =>
	store.pebbles.find((pebble) => pebble.state !== 'gone' && samePosition(pebble, p));

/** Pebbles that are about to come down. */
export const LOOSE_PEBBLE_STATES: readonly PebbleState[] = ['wobble', 'falling'];
/** Pebbles that have not fallen yet, including ones still resting on soil. */
export const UNFALLEN_PEBBLE_STATES: readonly PebbleState[] = ['resting', 'wobble', 'falling'];

/** Whether a pebble in one of `states` sits somewhere above `p`, in the same column. */
export const isBelowPebble = (store: BurrowStore, p: Position, states: readonly PebbleState[]) =>
	store.pebbles.some((pebble) => states.includes(pebble.state) && pebble.x === p.x && pebble.y < p.y);

/** Beetles that take up their cell: awake ones, and ones dozing or dizzy before they head home. */
const occupiesCell = (beetle: Beetle) => beetle.state === 'awake' || beetle.state === 'asleep' || beetle.state === 'dizzy';

export const beetleAt = (store: BurrowStore, p: Position, except?: Beetle): Beetle | undefined =>
	store.beetles.find((beetle) => beetle !== except && occupiesCell(beetle) && samePosition(beetle, p));

export const facingTowards = (from: Position, to: Position, current: Facing): Facing =>
	to.x > from.x ? 'right' : to.x < from.x ? 'left' : current;

export const addScore = (store: BurrowStore, points: number) => {
	if (points <= 0) return;
	store.score += points;
	store.config.pointsIncreasedCallback(store.score);
};
