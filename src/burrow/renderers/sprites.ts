import { ThemeKeys } from '../../shared/types';
import { Beetle, Pebble, Wombat } from '../types';

/**
 * Hand-drawn style vector sprites, drawn once in <defs> and reused with <use>.
 * Every sprite is centred on (0, 0) inside a 20×20 cell. Outlines are soft and thin and every creature
 * casts a small ground shadow, so the sprites sit in the soil rather than floating on top of it.
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
	shell: string;
	shellSpot: string;
	beetleHead: string;
	pebble: string;
	pebbleShade: string;
	note: string;
	sparkle: string;
	snooze: string;
	shadow: string;
}

export const getBurrowPalette = (theme: ThemeKeys): BurrowPalette => {
	const isDark = theme.endsWith('-dark');
	return isDark
		? {
				tunnel: '#2b2019',
				outline: '#1d1510',
				fur: '#a9855f',
				furShade: '#86664a',
				nose: '#3a2a20',
				cheek: '#c98b80',
				lamp: '#e8bd5a',
				shell: '#8f7398',
				shellSpot: '#b8a3bd',
				beetleHead: '#4a3a4f',
				pebble: '#8e857a',
				pebbleShade: '#6e665c',
				note: '#f0cf86',
				sparkle: '#e8c46a',
				snooze: '#e6d3b3',
				shadow: '#000000'
			}
		: {
				tunnel: '#efe3cf',
				outline: '#5a4434',
				fur: '#a07a58',
				furShade: '#836246',
				nose: '#4a3628',
				cheek: '#e3a097',
				lamp: '#e8b13a',
				shell: '#7d5f86',
				shellSpot: '#a98fae',
				beetleHead: '#4a3a4f',
				pebble: '#9a8f80',
				pebbleShade: '#76695b',
				note: '#8a5a2b',
				sparkle: '#c98d1e',
				snooze: '#7a5c44',
				shadow: '#3b2a1e'
			};
};

/* ───────────────────────── Sprite ids ───────────────────────── */

export const wombatRef = (wombat: Pick<Wombat, 'pose' | 'facing' | 'digPhase'>) => {
	switch (wombat.pose) {
		case 'sleep':
			return '#bw-sleep';
		case 'dig':
			return `#bw-dig${wombat.digPhase}-${wombat.facing[0]}`;
		case 'hum':
			return `#bw-hum-${wombat.facing[0]}`;
		default:
			return `#bw-walk-${wombat.facing[0]}`;
	}
};

/** The two notes of the lullaby alternate as it floats along. */
export const noteRef = (phase: number) => `#bn-${phase % 2}`;

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

const groundShadow = (c: BurrowPalette, rx: number, cy = 8.6) =>
	`<ellipse cx="0" cy="${cy}" rx="${rx}" ry="1.6" fill="${c.shadow}" opacity="0.18"/>`;

const zz = (c: BurrowPalette, x: number, y: number, size: number) =>
	`<text x="${x}" y="${y}" font-size="${size}" font-family="sans-serif" font-weight="bold" fill="${c.snooze}">z</text>`;

/** The wombat's face changes with the pose: open eyes, or closed eyes and a little "o" while humming. */
const wombatBody = (c: BurrowPalette, face: 'awake' | 'humming' = 'awake') =>
	groundShadow(c, 9) +
	`<ellipse cx="-5" cy="7.6" rx="2.2" ry="1.4" fill="${c.furShade}" stroke="${c.outline}" stroke-width="0.6"/>` +
	`<ellipse cx="2" cy="7.6" rx="2.2" ry="1.4" fill="${c.furShade}" stroke="${c.outline}" stroke-width="0.6"/>` +
	`<ellipse cx="-1.5" cy="2" rx="8" ry="6" fill="${c.fur}" stroke="${c.outline}" stroke-width="0.8"/>` +
	`<path d="M-7 4 Q-2 7 3 4" fill="none" stroke="${c.furShade}" stroke-width="0.9" stroke-linecap="round"/>` +
	`<ellipse cx="1.8" cy="-4.6" rx="1.5" ry="2" fill="${c.fur}" stroke="${c.outline}" stroke-width="0.6"/>` +
	`<circle cx="5" cy="-0.4" r="4.6" fill="${c.fur}" stroke="${c.outline}" stroke-width="0.8"/>` +
	`<circle cx="4.2" cy="-4.4" r="1.3" fill="${c.lamp}" stroke="${c.outline}" stroke-width="0.5"/>` +
	`<ellipse cx="8.8" cy="0.2" rx="2" ry="1.6" fill="${c.nose}"/>` +
	(face === 'awake'
		? `<circle cx="6.1" cy="-1.4" r="0.9" fill="${c.outline}"/><circle cx="6.4" cy="-1.7" r="0.3" fill="#ffffff"/>`
		: `<path d="M5.3 -1.4 q0.8 0.8 1.6 0" fill="none" stroke="${c.outline}" stroke-width="0.6" stroke-linecap="round"/>` +
			`<ellipse cx="7.6" cy="2.4" rx="0.7" ry="0.8" fill="${c.nose}"/>`) +
	`<circle cx="5" cy="1.8" r="1.1" fill="${c.cheek}" opacity="0.7"/>`;

const wombatPaw = (c: BurrowPalette, x: number, y: number) =>
	`<ellipse cx="${x}" cy="${y}" rx="2" ry="1.5" fill="${c.furShade}" stroke="${c.outline}" stroke-width="0.6"/>` +
	`<path d="M${x + 1.6} ${y - 0.8} l1.4 -0.4 M${x + 1.9} ${y + 0.2} l1.5 0 M${x + 1.6} ${y + 1} l1.4 0.5" stroke="${c.outline}" stroke-width="0.5" stroke-linecap="round"/>`;

const crumbs = (c: BurrowPalette, points: [number, number][]) =>
	points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.9" fill="${c.furShade}" opacity="0.8"/>`).join('');

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
	'bw-hum-r': wombatBody(c, 'humming'),
	'bw-sleep':
		groundShadow(c, 9.5, 9) +
		`<ellipse cx="0" cy="3" rx="8.5" ry="6" fill="${c.fur}" stroke="${c.outline}" stroke-width="0.8"/>` +
		`<path d="M-6 5 Q0 8.5 6 5" fill="none" stroke="${c.furShade}" stroke-width="0.9" stroke-linecap="round"/>` +
		`<circle cx="4.5" cy="2.5" r="3.6" fill="${c.fur}" stroke="${c.outline}" stroke-width="0.8"/>` +
		`<ellipse cx="7.4" cy="3.4" rx="1.5" ry="1.2" fill="${c.nose}"/>` +
		`<path d="M3.4 1.8 q1 0.9 2 0" fill="none" stroke="${c.outline}" stroke-width="0.6" stroke-linecap="round"/>` +
		`<circle cx="3.8" cy="4.2" r="0.9" fill="${c.cheek}" opacity="0.7"/>` +
		zz(c, 5, -5, 6) +
		zz(c, 9, -9, 4.5)
});

/** Music notes drift from the wombat to the beetle: a single quaver and a pair of beamed ones. */
const noteSprites = (c: BurrowPalette): Record<string, string> => {
	const stroke = `stroke="${c.outline}" stroke-width="0.5"`;
	return {
		'bn-0':
			`<ellipse cx="-1" cy="3" rx="2.2" ry="1.6" transform="rotate(-20 -1 3)" fill="${c.note}" ${stroke}/>` +
			`<path d="M1 2.6 V-5 q3 1.5 3.4 4.2" fill="none" stroke="${c.note}" stroke-width="1.1" stroke-linecap="round"/>`,
		'bn-1':
			`<ellipse cx="-3" cy="3.6" rx="2" ry="1.5" transform="rotate(-20 -3 3.6)" fill="${c.note}" ${stroke}/>` +
			`<ellipse cx="3" cy="2.4" rx="2" ry="1.5" transform="rotate(-20 3 2.4)" fill="${c.note}" ${stroke}/>` +
			`<path d="M-1.2 3.2 V-4 L4.8 -5.2 V2" fill="none" stroke="${c.note}" stroke-width="1.1" stroke-linejoin="round"/>`
	};
};

const beetleLegs = (c: BurrowPalette) =>
	`<path d="M-4 3.5 l-1.5 2.5 M0 4.2 l0 2.6 M4 3.5 l1.5 2.5" stroke="${c.outline}" stroke-width="0.6" stroke-linecap="round"/>`;

const beetleBody = (c: BurrowPalette, eyes: string) =>
	groundShadow(c, 7) +
	beetleLegs(c) +
	`<path d="M6.5 -1.5 q2 -3.5 0.5 -5.5 M7.5 -0.5 q3.5 -2.5 3 -5" fill="none" stroke="${c.outline}" stroke-width="0.6" stroke-linecap="round"/>` +
	`<circle cx="6.2" cy="1" r="2.8" fill="${c.beetleHead}" stroke="${c.outline}" stroke-width="0.6"/>` +
	`<ellipse cx="-0.5" cy="1" rx="6.2" ry="4.6" fill="${c.shell}" stroke="${c.outline}" stroke-width="0.8"/>` +
	`<path d="M-0.5 -3.6 V5.6" stroke="${c.outline}" stroke-width="0.6"/>` +
	`<circle cx="-3" cy="-0.2" r="1" fill="${c.shellSpot}"/><circle cx="2" cy="2.4" r="0.9" fill="${c.shellSpot}"/>` +
	eyes;

const grumpyEyes = (c: BurrowPalette) =>
	`<circle cx="7.2" cy="0.6" r="1.1" fill="#ffffff"/><circle cx="7.6" cy="0.8" r="0.5" fill="${c.outline}"/>` +
	`<path d="M5.8 -1 l2.6 0.8" stroke="${c.outline}" stroke-width="0.6" stroke-linecap="round"/>`;

/** Heavy lids: the beetle is getting sleepy. */
const droopyEyes = (c: BurrowPalette) =>
	`<circle cx="7.2" cy="0.8" r="1.1" fill="#ffffff"/><path d="M5.9 0.5 h2.6" stroke="${c.beetleHead}" stroke-width="1.3"/>` +
	`<circle cx="7.5" cy="1.2" r="0.45" fill="${c.outline}"/>`;

const closedEyes = () => `<path d="M6.4 1 q0.9 0.8 1.8 0" fill="none" stroke="#ffffff" stroke-width="0.6" stroke-linecap="round"/>`;

const sparkle = (c: BurrowPalette, x: number, y: number, r: number) =>
	`<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3}Z" fill="${c.sparkle}"/>`;

const beetleSprites = (c: BurrowPalette): Record<string, string> => ({
	'bb-walk-r': beetleBody(c, grumpyEyes(c)),
	'bb-drowsy1-r': beetleBody(c, droopyEyes(c)),
	// Nodding off: head dips forward, eyes shut, a first little "z".
	'bb-drowsy2-r': `<g transform="rotate(10 0 4)">${beetleBody(c, closedEyes())}</g>` + zz(c, 5, -5, 5),
	'bb-asleep':
		groundShadow(c, 7) +
		`<ellipse cx="0" cy="3" rx="6.4" ry="4.2" fill="${c.shell}" stroke="${c.outline}" stroke-width="0.8"/>` +
		`<path d="M0 -1 V7" stroke="${c.outline}" stroke-width="0.6"/>` +
		`<circle cx="-2.6" cy="2" r="0.9" fill="${c.shellSpot}"/><circle cx="2.4" cy="4" r="0.8" fill="${c.shellSpot}"/>` +
		zz(c, 3, -3, 5.5) +
		zz(c, 7, -6.5, 4),
	'bb-dizzy':
		beetleBody(c, `<path d="M6.4 0 l1.6 1.6 M8 0 l-1.6 1.6" stroke="#ffffff" stroke-width="0.6" stroke-linecap="round"/>`) +
		sparkle(c, -4, -7, 1.6) +
		sparkle(c, 0, -8.5, 1.6) +
		sparkle(c, 4, -7, 1.6)
});

const pebbleShape = (c: BurrowPalette) =>
	groundShadow(c, 7, 7.6) +
	`<path d="M-7 4 Q-8 -2 -3 -5 Q2 -7 6 -3 Q9 1 6 5 Q0 8 -7 4Z" fill="${c.pebble}" stroke="${c.outline}" stroke-width="0.8"/>` +
	`<path d="M-4 -2 Q-1 -4 2 -3.5" fill="none" stroke="#ffffff" stroke-width="0.9" stroke-linecap="round" opacity="0.3"/>` +
	`<circle cx="2.5" cy="2.5" r="1" fill="${c.pebbleShade}"/>`;

const pebbleSprites = (c: BurrowPalette): Record<string, string> => ({
	'bp-rest': pebbleShape(c),
	'bp-tilt-a': `<g transform="rotate(-12)"><use href="#bp-rest"/></g>`,
	'bp-tilt-b': `<g transform="rotate(12)"><use href="#bp-rest"/></g>`,
	'bp-crumble':
		`<path d="M-7 5 l3 -4 l3 4z M-1 6 l3 -5 l3 5z M4 5 l2 -3 l2 3z" fill="${c.pebble}" stroke="${c.outline}" stroke-width="0.6"/>` +
		`<circle cx="-4" cy="-3" r="0.8" fill="${c.pebbleShade}"/><circle cx="3" cy="-4" r="0.7" fill="${c.pebbleShade}"/>`
});

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
	const all = mirrored({ ...wombatSprites(palette), ...noteSprites(palette), ...beetleSprites(palette), ...pebbleSprites(palette) });
	const needed = new Set<string>();
	const include = (id: string) => {
		if (needed.has(id) || !all[id]) return;
		needed.add(id);
		const pattern = /href="#([^"]+)"/g;
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(all[id])) !== null) include(match[1]);
	};
	for (const ref of usedRefs) include(ref.replace(/^#/, ''));
	return `<defs>${[...needed].map((id) => `<g id="${id}">${all[id]}</g>`).join('')}</defs>`;
};
