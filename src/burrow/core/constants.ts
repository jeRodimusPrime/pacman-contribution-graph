import { CELL_SIZE, DELTA_TIME, GAP_SIZE, GRID_HEIGHT, GRID_WIDTH } from '../../shared/constants';

export { CELL_SIZE, DELTA_TIME, GAP_SIZE, GRID_HEIGHT, GRID_WIDTH };

export const BURROW_HEADER_HEIGHT = 24;
export const BURROW_CELL_RADIUS = 3;
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

/** Lantern light carries this many cells down a straight, open tunnel. */
export const BURROW_LANTERN_RANGE = 3;
/** Each flash of the lantern is held up for this many frames, glow pulsing, so the lullaby reads clearly. */
export const BURROW_LANTERN_HOLD_FRAMES = 4;
/** Frames between lowering the lantern and raising it again. */
export const BURROW_LANTERN_COOLDOWN = 2;
/** Lantern hits needed to put a beetle to sleep. */
export const BURROW_LULL_HITS = 3;
/** A lit beetle stays frozen until just after the next flash could land, so it cannot slip away mid-lullaby. */
export const BURROW_FREEZE_FRAMES = BURROW_LANTERN_HOLD_FRAMES + BURROW_LANTERN_COOLDOWN + 2;
/** Drowsiness wears off by one level after this many frames without light. */
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
/** Beetles start no closer to the den than this column. */
export const BURROW_BEETLE_MIN_X = 14;

export const BURROW_MAX_PEBBLES = 5;
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
