import { BaseConfig, BaseStore, Contribution, GridCell } from '../shared/types';

export interface Position {
	x: number;
	y: number;
}

export type Facing = 'left' | 'right';

/**
 * - `walk`: trundling along a tunnel (or standing still)
 * - `dig`: scraping at the soil in front of it
 * - `lantern`: holding up its lantern to lull a beetle
 * - `sleep`: curled up for a nap once the burrow is finished
 */
export type WombatPose = 'walk' | 'dig' | 'lantern' | 'sleep';

export interface Wombat extends Position {
	facing: Facing;
	pose: WombatPose;
	/** Alternates every dig frame so the claws visibly scrabble. */
	digPhase: number;
	/** Frames until the lantern can be raised again. */
	lanternCooldown: number;
	/** Which way the lantern light points while the pose is `lantern`. */
	lanternAim: 'side' | 'up' | 'down';
	visible: boolean;
}

/**
 * - `hidden`: not peeked out yet
 * - `awake`: wandering the tunnels (or squeezing through soil) towards the wombat
 * - `asleep`: lulled by the lantern; dozes for a moment, then heads home
 * - `dizzy`: bonked by a falling pebble; wobbles for a moment, then heads home
 * - `gone`: went home
 */
export type BeetleState = 'hidden' | 'awake' | 'asleep' | 'dizzy' | 'gone';

export interface Beetle extends Position {
	id: number;
	state: BeetleState;
	facing: Facing;
	/** 0 = wide awake … BURROW_LULL_HITS = asleep. */
	drowsiness: number;
	/** Frames the beetle stays frozen in place after being lit. */
	frozenFor: number;
	/** Frame of the last lantern hit; drowsiness wears off if it is not topped up. */
	lastLitFrame: number;
	/** Frames until the next step. */
	moveCooldown: number;
	/** Frames spent without a tunnel route to the wombat; once it runs out the beetle squeezes through soil. */
	stuckFrames: number;
	/** Countdown for the `asleep` / `dizzy` states before the beetle goes home. */
	timer: number;
	spawn: Position;
}

/**
 * - `resting`: sitting on soil
 * - `wobble`: the soil underneath was dug out; about to fall
 * - `falling`: dropping one cell per frame
 * - `crumble`: landed and breaking apart
 * - `gone`: crumbled into the tunnel
 */
export type PebbleState = 'resting' | 'wobble' | 'falling' | 'crumble' | 'gone';

export interface Pebble extends Position {
	id: number;
	state: PebbleState;
	timer: number;
	/** Contribution level index (1-4) of the day the pebble sits on, scored when it crumbles. */
	level: number;
	spawn: Position;
}

export interface BurrowSnapshot {
	/** Remaining hardness of every cell: 0 = tunnel, 1-4 = soil. */
	soil: number[][];
	wombat: Wombat;
	beetles: Beetle[];
	pebbles: Pebble[];
}

export interface BurrowConfig extends BaseConfig {}

export interface BurrowStore extends BaseStore {
	contributions: Contribution[];
	grid: GridCell[][];
	monthLabels: string[];
	config: BurrowConfig;
	gameInterval: number;
	frameCount: number;
	/** Remaining hardness of every cell: 0 = tunnel, 1-4 = soil. */
	soil: number[][];
	/** Starting hardness of every cell, used for scoring and for the regrow at the end. */
	initialSoil: number[][];
	wombat: Wombat;
	beetles: Beetle[];
	pebbles: Pebble[];
	snapshots: BurrowSnapshot[];
	score: number;
	cellsDug: number;
	beetlesLulled: number;
	beetlesBonked: number;
}
