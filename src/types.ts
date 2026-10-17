export type Bindings = {
	WAKATIME_API_KEY?: string;
	YOUTUBE_DATA_API_KEY?: string;
	CWA_API_KEY?: string;
	CWA_ALLOWED_DATASETS?: string;
	GITHUB_TOKEN?: string;
	GA_API_KEY?: string;
	THREADS_STORE: KVNamespace;
};

export type AppEnv = {
	Bindings: Bindings;
};
