import { Game } from '../burrow/core/game';
import { Store } from '../burrow/core/store';
import type { BurrowConfig, BurrowStore } from '../burrow/types';
import { Providers } from '../shared/providers/providers';
import { Utils } from '../shared/utils/utils';

export type { BurrowConfig } from '../burrow/types';

export class BurrowRenderer {
	store!: BurrowStore;
	conf: BurrowConfig;

	constructor(conf: BurrowConfig) {
		this.conf = { ...conf };
	}

	public async start() {
		const defaultConfig: BurrowConfig = {
			platform: 'github',
			username: '',
			svgCallback: (_: string) => {},
			gameOverCallback: () => {},
			gameTheme: 'github',
			pointsIncreasedCallback: (_: number) => {},
			githubSettings: { accessToken: '' }
		};

		this.store = JSON.parse(JSON.stringify(Store));
		this.store.config = { ...defaultConfig, ...this.conf };

		this.store.contributions = await Providers.fetchContributions(this.store);

		Utils.buildGrid(this.store);
		Utils.buildMonthLabels(this.store);

		await Game.startGame(this.store);
		return this.store;
	}

	public stop() {
		Game.stopGame(this.store);
	}
}
