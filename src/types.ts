export type Bindings = {
	CWA_ALLOWED_DATASETS: string;
	CWA_API_KEY: string;
	GITHUB_TOKEN: string;
	WAKATIME_API_KEY: string;
	YOUTUBE_DATA_API_KEY: string;
	GA_PROPERTY_ID: string;
	GA_CLIENT_EMAIL: string;
	GA_PRIVATE_KEY: string;
	APIFY_API_KEY: string;
	THREADS_STORE: KVNamespace;
};

export type AppEnv = {
	Bindings: Bindings;
};
