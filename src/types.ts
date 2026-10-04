export type Bindings = {
	WAKATIME_API_KEY?: string;
	YOUTUBE_DATA_API_KEY?: string;
	CWA_API_KEY?: string;
	CWA_ALLOWED_DATASETS?: string;
};

export type AppEnv = {
	Bindings: Bindings;
};
