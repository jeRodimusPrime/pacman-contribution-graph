import { CELL_SIZE, DELTA_TIME, GAP_SIZE, GRID_HEIGHT, GRID_WIDTH } from '../../shared/constants';

export { CELL_SIZE, DELTA_TIME, GAP_SIZE, GRID_HEIGHT, GRID_WIDTH };

export const BURROW_HEADER_HEIGHT = 24;
/** Blur (stdDeviation, px) used to round the soil into soft clods; small, so each day keeps its own colour. */
export const BURROW_SOIL_CLUMP = 2;
/** Corner radius of the soil field as a whole. */
export const BURROW_FIELD_RADIUS = 8;
export const BURROW_MIN_DURATION_MS = 5000;
/** Frames play a little faster than the shared DELTA_TIME: digging dense days takes a lot of them. */
export const BURROW_DURATION_DIVISOR = 2;

/** Hard cap on simulated frames, before the ending sequence. */
export const BURROW_MAX_FRAMES = 2400;
/** Give up (and send the beetles home) after this many frames in a row without digging or lulling anything. */
export const BURROW_MAX_IDLE_FRAMES = 150;

/** The wombat starts in its den, just off the left edge, in the middle row. */
export const BURROW_DEN: { x: number; y: number } = { x: -1, y: Math.floor(GRID_HEIGHT / 2) };

/** The wombat works on soil within this many columns of the leftmost soil left, sweeping left to right. */
export const BURROW_SWEEP_WIDTH = 2;

/** The wombat's humming carries this many cells down a straight, open tunnel. */
export const BURROW_HUM_RANGE = 3;
/** Each note of the lullaby takes this many frames to float from the wombat to the beetle. */
export const BURROW_HUM_FRAMES = 4;
/** Frames between one note landing and the next being hummed. */
export const BURROW_HUM_COOLDOWN = 2;
/** Notes needed to put a beetle to sleep. */
export const BURROW_LULL_HITS = 3;
/** A beetle being sung to stays put until just after the next note could land, so it cannot slip away mid-lullaby. */
export const BURROW_FREEZE_FRAMES = BURROW_HUM_FRAMES + BURROW_HUM_COOLDOWN + 2;
/** Drowsiness wears off by one level after this many frames without another note. */
export const BURROW_WAKE_FRAMES = 15;
/** Frames a sleeping or dizzy beetle lingers before heading home. */
export const BURROW_NAP_FRAMES = 12;

/** Beetles step once every N frames through tunnels, and more slowly when squeezing through soil. */
export const BURROW_BEETLE_TUNNEL_STEP = 2;
export const BURROW_BEETLE_SOIL_STEP = 4;
/** Frames without a tunnel route before a beetle starts squeezing through soil. */
export const BURROW_BEETLE_PATIENCE = 8;
/** Beetles closer than this (in steps) chase the wombat; farther away they amble about. */
export const BURROW_BEETLE_CHASE_RANGE = 14;
export const BURROW_BEETLE_APPEAR_FRAME = 3;
export const BURROW_MAX_BEETLES = 4;
/** One beetle, plus one more for every this many soil cells (up to BURROW_MAX_BEETLES). */
export const BURROW_SOIL_PER_BEETLE = 90;
/** An empty graph has nothing to dig, so a couple of beetles still turn up to be sung to. */
export const BURROW_EMPTY_GRAPH_BEETLES = 2;
/** Beetles start no closer to the den than this column. */
export const BURROW_BEETLE_MIN_X = 14;

export const BURROW_MAX_PEBBLES = 5;
/** One pebble for every this many soil cells (up to BURROW_MAX_PEBBLES). */
export const BURROW_SOIL_PER_PEBBLE = 30;
/** Pebbles stay clear of the first few columns, so the wombat is never greeted by one at the den. */
export const BURROW_PEBBLE_MIN_X = 2;
/** Minimum number of columns between two pebbles. */
export const BURROW_PEBBLE_SPACING = 5;
export const BURROW_PEBBLE_WOBBLE_FRAMES = 3;
export const BURROW_PEBBLE_CRUMBLE_FRAMES = 2;
/** Extra path cost for walking under a pebble that is about to fall. */
export const BURROW_PEBBLE_DANGER_COST = 15;

export const BURROW_NAP_END_FRAMES = 10;
export const BURROW_REGROW_FRAMES = 8;
export const BURROW_END_HOLD_FRAMES = 4;

/** Score per dug cell, by contribution level (index = level). */
export const BURROW_LEVEL_POINTS = [0, 1, 2, 3, 5];
export const BURROW_LULL_POINTS = 20;
export const BURROW_BONK_POINTS = 30;
