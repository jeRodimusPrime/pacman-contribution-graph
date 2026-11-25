/** Small deterministic PRNG (mulberry32) so the same contribution graph always plays the same game. */
export const createRandom = (seed: number) => {
	let state = seed >>> 0 || 1;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

export type Random = ReturnType<typeof createRandom>;

/** A shuffled copy of `items` (Fisher–Yates), driven by `random` so it is repeatable. */
export const shuffle = <T>(items: readonly T[], random: Random): T[] => {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
};
