import { ThemeKeys } from '../../shared/types';
import { Beetle, Pebble, Wombat } from '../types';

/**
 * Hand-drawn style vector sprites, drawn once in <defs> and reused with <use>.
 * Every sprite is centred on (0, 0) inside a 20×20 cell; some (the lantern glow) spill over on purpose.
 */

export interface BurrowPalette {
	/** Cells that are open tunnel: warm cream by day, deep cocoa by night. */
	tunnel: string;
	outline: string;
	fur: string;
	furShade: string;
	nose: string;
	cheek: string;
	lamp: string;
	glow: string;
	shell: string;
	shellSpot: string;
	beetleHead: string;
	pebble: string;
	pebbleShade: string;
	sparkle: string;
	snooze: string;
}

export const getBurrowPalette = (theme: ThemeKeys): BurrowPalette => {
	const isDark = theme.endsWith('-dark');
	return isDark
		? {
				tunnel: '#2b2019',
				outline: '#14100c',
				fur: '#b58d68',
				furShade: '#8f6b4c',
				nose: '#3a2a20',
				cheek: '#e79a92',
				lamp: '#ffcf5c',
				glow: '#ffd98a',
				shell: '#b48ad6',
				shellSpot: '#d9c2ee',
				beetleHead: '#4a3560',
				pebble: '#a39d94',
				pebbleShade: '#7d776f',
				sparkle: '#ffe08a',
				snooze: '#f3e3c8'
			}
		: {
				tunnel: '#efe3cf',
				outline: '#3b2a1e',
				fur: '#a07a58',
				furShade: '#7f5d40',
				nose: '#3b2a1e',
				cheek: '#ef9f97',
				lamp: '#ffc23d',
				glow: '#ffd56b',
				shell: '#7b4b94',
				shellSpot: '#b893cb',
				beetleHead: '#3d2a4d',
				pebble: '#8f8a83',
				pebbleShade: '#68635d',
				sparkle: '#e0a21a',
				snooze: '#6b4f3a'
			};
};

/* ───────────────────────── Sprite ids ───────────────────────── */

export const wombatRef = (wombat: Pick<Wombat, 'pose' | 'facing' | 'digPhase' | 'lanternAim'>) => {
	switch (wombat.pose) {
		case 'sleep':
			return '#bw-sleep';
		case 'dig':
			return `#bw-dig${wombat.digPhase}-${wombat.facing[0]}`;
		case 'lantern':
			return `#bw-lantern${wombat.lanternAim === 'side' ? '' : `-${wombat.lanternAim[0]}`}-${wombat.facing[0]}`;
		default:
			return `#bw-walk-${wombat.facing[0]}`;
	}
};

export const beetleRef = (beetle: Pick<Beetle, 'state' | 'facing' | 'drowsiness'>) => {
	switch (beetle.state) {
		case 'asleep':
			return '#bb-asleep';
		case 'dizzy':
			return '#bb-dizzy';
		default:
			return beetle.drowsiness > 0
				? `#bb-drowsy${Math.min(beetle.drowsiness, 2)}-${beetle.facing[0]}`
				: `#bb-walk-${beetle.facing[0]}`;
	}
};

export const pebbleRef = (pebble: Pick<Pebble, 'state' | 'timer'>) => {
	switch (pebble.state) {
		case 'wobble':
			return pebble.timer % 2 === 0 ? '#bp-tilt-a' : '#bp-tilt-b';
		case 'crumble':
			return '#bp-crumble';
		default:
			return '#bp-rest';
	}
};

/* ───────────────────────── Drawings ───────────────────────── */

const wombatBody = (c: BurrowPalette) =>
	`<ellipse cx="-5" cy="7.6" rx="2.2" ry="1.4" fill="${c.furShade}" stroke="${c.outline}" stroke-width="0.8"/>` +
	`<ellipse cx="2" cy="7.6" rx="2.2" ry="1.4" fill="${c.furShade}" stroke="${c.outline}" stroke-width="0.8"/>` +
	`<ellipse cx="-1.5" cy="2" rx="8" ry="6" fill="${c.fur}" stroke="${c.outline}" stroke-width="1.1"/>` +
	`<path d="M-7 4 Q-2 7 3 4" fill="none" stroke="${c.furShade}" stroke-width="1" stroke-linecap="round"/>` +
	`<ellipse cx="1.8" cy="-4.6" rx="1.5" ry="2" fill="${c.fur}" stroke="${c.outline}" stroke-width="0.8"/>` +
	`<circle cx="5" cy="-0.4" r="4.6" fill="${c.fur}" stroke="${c.outline}" stroke-width="1.1"/>` +
	`<circle cx="4.2" cy="-4.4" r="1.4" fill="${c.lamp}" stroke="${c.outline}" stroke-width="0.6"/>` +
	`<ellipse cx="8.8" cy="0.2" rx="2" ry="1.6" fill="${c.nose}"/>` +
	`<circle cx="6.1" cy="-1.4" r="0.9" fill="${c.outline}"/>` +
	`<circle cx="6.4" cy="-1.7" r="0.3" fill="#ffffff"/>` +
	`<circle cx="5" cy="1.8" r="1.1" fill="${c.cheek}" opacity="0.75"/>`;

const wombatPaw = (c: BurrowPalette, x: number, y: number) =>
	`<ellipse cx="${x}" cy="${y}" rx="2" ry="1.5" fill="${c.furShade}" stroke="${c.outline}" stroke-width="0.8"/>` +
	`<path d="M${x + 1.6} ${y - 0.8} l1.4 -0.4 M${x + 1.9} ${y + 0.2} l1.5 0 M${x + 1.6} ${y + 1} l1.4 0.5" stroke="${c.outline}" stroke-width="0.6" stroke-linecap="round"/>`;

const crumbs = (c: BurrowPalette, points: [number, number][]) =>
	points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.9" fill="${c.furShade}" opacity="0.8"/>`).join('');

/** A soft cone of light from the lantern towards the beetle, plus a halo round the lantern itself. */
const lanternGlow = (c: BurrowPalette, cx: number, cy: number, rx: number, ry: number) =>
	`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c.glow}" opacity="0.28"/>` +
	`<circle cx="11" cy="1" r="6" fill="${c.glow}" opacity="0.4"/>`;

const wombatWithLantern = (c: BurrowPalette) =>
	wombatBody(c) +
	`<path d="M9 -2.5 v-1.5 h3 v1.5" fill="none" stroke="${c.outline}" stroke-width="0.7"/>` +
	`<rect x="8.6" y="-2.5" width="3.8" height="5" rx="1" fill="${c.lamp}" stroke="${c.outline}" stroke-width="0.8"/>` +
	wombatPaw(c, 8, 4);

const wombatSprites = (c: BurrowPalette): Record<string, string> => ({
	'bw-walk-r': wombatBody(c),
	'bw-dig0-r':
		wombatBody(c) +
		wombatPaw(c, 7.5, 5.5) +
		crumbs(c, [
			[11.5, 3],
			[12.5, 6]
		]),
	'bw-dig1-r':
		wombatBody(c) +
		wombatPaw(c, 8.5, 3) +
		crumbs(c, [
			[12, 0.5],
			[11, 7]
		]),
	'bw-lantern-r': lanternGlow(c, 22, 1, 14, 6) + wombatWithLantern(c),
	'bw-lantern-u-r': lanternGlow(c, 10.5, -14, 6, 14) + wombatWithLantern(c),
	'bw-lantern-d-r': lanternGlow(c, 10.5, 16, 6, 14) + wombatWithLantern(c),
	'bw-sleep':
		`<ellipse cx="0" cy="3" rx="8.5" ry="6" fill="${c.fur}" stroke="${c.outline}" stroke-width="1.1"/>` +
		`<path d="M-6 5 Q0 8.5 6 5" fill="none" stroke="${c.furShade}" stroke-width="1" stroke-linecap="round"/>` +
		`<circle cx="4.5" cy="2.5" r="3.6" fill="${c.fur}" stroke="${c.outline}" stroke-width="1"/>` +
		`<ellipse cx="7.4" cy="3.4" rx="1.5" ry="1.2" fill="${c.nose}"/>` +
		`<path d="M3.4 1.8 q1 0.9 2 0" fill="none" stroke="${c.outline}" stroke-width="0.7" stroke-linecap="round"/>` +
		`<circle cx="3.8" cy="4.2" r="0.9" fill="${c.cheek}" opacity="0.75"/>` +
		`<text x="5" y="-5" font-size="6" font-family="sans-serif" font-weight="bold" fill="${c.snooze}">z</text>` +
		`<text x="9" y="-9" font-size="4.5" font-family="sans-serif" font-weight="bold" fill="${c.snooze}">z</text>`
});

const beetleLegs = (c: BurrowPalette) =>
	`<path d="M-4 3.5 l-1.5 2.5 M0 4.2 l0 2.6 M4 3.5 l1.5 2.5" stroke="${c.outline}" stroke-width="0.8" stroke-linecap="round"/>`;

const beetleBody = (c: BurrowPalette, eyes: string) =>
	beetleLegs(c) +
	`<path d="M6.5 -1.5 q2 -3.5 0.5 -5.5 M7.5 -0.5 q3.5 -2.5 3 -5" fill="none" stroke="${c.outline}" stroke-width="0.7" stroke-linecap="round"/>` +
	`<circle cx="6.2" cy="1" r="2.8" fill="${c.beetleHead}" stroke="${c.outline}" stroke-width="0.8"/>` +
	`<ellipse cx="-0.5" cy="1" rx="6.2" ry="4.6" fill="${c.shell}" stroke="${c.outline}" stroke-width="1"/>` +
	`<path d="M-0.5 -3.6 V5.6" stroke="${c.outline}" stroke-width="0.7"/>` +
	`<circle cx="-3" cy="-0.2" r="1" fill="${c.shellSpot}"/><circle cx="2" cy="2.4" r="0.9" fill="${c.shellSpot}"/>` +
	eyes;

const grumpyEyes = (c: BurrowPalette) =>
	`<circle cx="7.2" cy="0.6" r="1.1" fill="#ffffff"/><circle cx="7.6" cy="0.8" r="0.5" fill="${c.outline}"/>` +
	`<path d="M5.8 -1 l2.6 0.8" stroke="${c.outline}" stroke-width="0.7" stroke-linecap="round"/>`;

const sleepyEyes = (c: BurrowPalette, closed: boolean) =>
	closed
		? `<path d="M6.4 1 q0.9 0.8 1.8 0" fill="none" stroke="#ffffff" stroke-width="0.7" stroke-linecap="round"/>`
		: `<circle cx="7.2" cy="0.8" r="1.1" fill="#ffffff"/><path d="M6 0.4 h2.4" stroke="${c.beetleHead}" stroke-width="1.2"/>` +
			`<circle cx="7.5" cy="1.1" r="0.45" fill="${c.outline}"/>`;

const sparkle = (c: BurrowPalette, x: number, y: number, r: number) =>
	`<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3}Z" fill="${c.sparkle}"/>`;

const beetleSprites = (c: BurrowPalette): Record<string, string> => ({
	'bb-walk-r': beetleBody(c, grumpyEyes(c)),
	'bb-drowsy1-r': beetleBody(c, sleepyEyes(c, false)) + sparkle(c, 0, -7, 2.2),
	'bb-drowsy2-r': beetleBody(c, sleepyEyes(c, true)) + sparkle(c, -3, -7, 2.4) + sparkle(c, 3, -8, 1.6),
	'bb-asleep':
		`<ellipse cx="0" cy="3" rx="6.4" ry="4.2" fill="${c.shell}" stroke="${c.outline}" stroke-width="1"/>` +
		`<path d="M0 -1 V7" stroke="${c.outline}" stroke-width="0.7"/>` +
		`<circle cx="-2.6" cy="2" r="0.9" fill="${c.shellSpot}"/><circle cx="2.4" cy="4" r="0.8" fill="${c.shellSpot}"/>` +
		`<text x="3" y="-3" font-size="5.5" font-family="sans-serif" font-weight="bold" fill="${c.snooze}">z</text>` +
		`<text x="7" y="-6.5" font-size="4" font-family="sans-serif" font-weight="bold" fill="${c.snooze}">z</text>`,
	'bb-dizzy':
		beetleBody(c, `<path d="M6.4 0 l1.6 1.6 M8 0 l-1.6 1.6" stroke="#ffffff" stroke-width="0.7" stroke-linecap="round"/>`) +
		sparkle(c, -4, -7, 1.6) +
		sparkle(c, 0, -8.5, 1.6) +
		sparkle(c, 4, -7, 1.6)
});

const pebbleShape = (c: BurrowPalette) =>
	`<path d="M-7 4 Q-8 -2 -3 -5 Q2 -7 6 -3 Q9 1 6 5 Q0 8 -7 4Z" fill="${c.pebble}" stroke="${c.outline}" stroke-width="1"/>` +
	`<path d="M-4 -2 Q-1 -4 2 -3.5" fill="none" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity="0.45"/>` +
	`<circle cx="2.5" cy="2.5" r="1" fill="${c.pebbleShade}"/>`;

const pebbleSprites = (c: BurrowPalette): Record<string, string> => ({
	'bp-rest': pebbleShape(c),
	'bp-tilt-a': `<g transform="rotate(-12)"><use href="#bp-rest"/></g>`,
	'bp-tilt-b': `<g transform="rotate(12)"><use href="#bp-rest"/></g>`,
	'bp-crumble':
		`<path d="M-7 5 l3 -4 l3 4z M-1 6 l3 -5 l3 5z M4 5 l2 -3 l2 3z" fill="${c.pebble}" stroke="${c.outline}" stroke-width="0.8"/>` +
		`<circle cx="-4" cy="-3" r="0.8" fill="${c.pebbleShade}"/><circle cx="3" cy="-4" r="0.7" fill="${c.pebbleShade}"/>`
});

/* ───────────────────────── Crumbling soil ───────────────────────── */

/** Number of crumble stages drawn over a cell while it is being dug. */
export const CRUMBLE_STAGES = 3;

/**
 * Crumble stage (1…CRUMBLE_STAGES) for a cell with `remaining` of its `initial` hardness left, or 0 when the
 * cell is untouched or fully dug. A level-4 day goes through every stage; a level-1 day opens in one scrape.
 */
export const crumbleStage = (initial: number, remaining: number) =>
	remaining <= 0 || remaining >= initial ? 0 : Math.ceil(((initial - remaining) / initial) * CRUMBLE_STAGES - 1e-9);

export const crumbleRef = (stage: number) => `#bc-${stage}`;

/** Clip so holes punched near a corner follow the cell's rounded edge. */
const CRUMBLE_CLIP = `<clipPath id="bc-clip"><rect x="-10" y="-10" width="20" height="20" rx="3"/></clipPath>`;

/**
 * Holes are painted in the tunnel colour, so whatever is left of the cell keeps its current soil shade
 * underneath. Each stage keeps the holes of the one before, so the soil only ever falls away.
 */
const crumbleSprites = (c: BurrowPalette): Record<string, string> => {
	const hole = (d: string) => `<path d="${d}" fill="${c.tunnel}"/>`;
	const crack = (d: string) =>
		`<path d="${d}" fill="none" stroke="${c.outline}" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>`;
	const crumb = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.tunnel}"/>`;

	const stage1 =
		hole('M4 -10 L10 -10 L10 -4 L7 -5 L5 -7Z') +
		crack('M-6 -10 L-3 -4 L-6 1 M4 10 L2 5 L5 1 M5 -7 L1 -5') +
		crumb(-1, -7, 0.9) +
		crumb(7, 2, 0.7);
	const stage2 =
		stage1 +
		hole('M-10 3 L-5 2 L-3 6 L-4 10 L-10 10Z') +
		hole('M-3 -4 L2 -5 L3 -1 L-1 1Z') +
		crack('M-3 6 L1 3 L3 -1 M-10 -3 L-6 1') +
		crumb(5, 6, 1) +
		crumb(-7, -4, 0.8);
	const stage3 =
		hole('M-10 -5 L-5 -10 L5 -10 L10 -2 L10 5 L5 10 L-5 10 L-10 4Z') +
		crack('M-10 -5 L-5 -10 M10 5 L5 10') +
		`<circle cx="-2" cy="1" r="1.4" fill="${c.outline}" opacity="0.25"/>` +
		`<circle cx="3" cy="4" r="1" fill="${c.outline}" opacity="0.25"/>` +
		`<circle cx="1" cy="-4" r="0.8" fill="${c.outline}" opacity="0.25"/>`;

	const clipped = (body: string) => `<g clip-path="url(#bc-clip)">${body}</g>`;
	return { 'bc-1': clipped(stage1), 'bc-2': clipped(stage2), 'bc-3': clipped(stage3) };
};

/** Facing left is the right-facing drawing mirrored. */
const mirrored = (sprites: Record<string, string>): Record<string, string> => {
	const result: Record<string, string> = { ...sprites };
	for (const id of Object.keys(sprites)) {
		if (id.endsWith('-r')) result[`${id.slice(0, -2)}-l`] = `<g transform="scale(-1 1)"><use href="#${id}"/></g>`;
	}
	return result;
};

/** The <defs> block for every sprite referenced in `usedRefs` (plus whatever those depend on). */
export const buildSpriteDefs = (palette: BurrowPalette, usedRefs: Set<string>): string => {
	const all = mirrored({ ...wombatSprites(palette), ...beetleSprites(palette), ...pebbleSprites(palette), ...crumbleSprites(palette) });
	const needed = new Set<string>();
	const include = (id: string) => {
		if (needed.has(id) || !all[id]) return;
		needed.add(id);
		const pattern = /href="#([^"]+)"/g;
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(all[id])) !== null) include(match[1]);
	};
	for (const ref of usedRefs) include(ref.replace(/^#/, ''));
	const clip = [...needed].some((id) => id.startsWith('bc-')) ? CRUMBLE_CLIP : '';
	return `<defs>${clip}${[...needed].map((id) => `<g id="${id}">${all[id]}</g>`).join('')}</defs>`;
};
