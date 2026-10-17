// 刷新Threads API token
import type { Bindings } from '@/types';

export interface SingleResponse {
	profilePic: string;
	userName: string;
	followersCount: number;
	followsCount: number;
	timestamp: string;
	userUrl: string;
	userFullName: string;
	userId: string;
}

export async function refreshInstagramFollowers(env: Bindings) {
	try {
		const token = env.APIFY_API_KEY;

		// 發動 API
		const runUrl = `https://api.apify.com/v2/actors/7RQ4RlfRihUhflQtJ/runs?token=${token}&waitForFinish=60`;
		const runResponse = await fetch(runUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				usernames: ['samhacker.xyz'],
			}),
		});

		const runResult: any = await runResponse.json();

		// 確保任務成功完成
		if (!runResult.data || runResult.data.status !== 'SUCCEEDED') {
			console.error('[Cron] 爬蟲未成功完成:', runResult);
			return;
		}

		// 從回傳資訊中取得資料集 ID (defaultDatasetId)
		const datasetId = runResult.data.defaultDatasetId;

		// 呼叫 Dataset API 撈取真實抓到的 IG 數據
		const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=1`;
		const datasetResponse = await fetch(datasetUrl);
		const dataItems: any = await datasetResponse.json(); // 這會是一個陣列

		if (dataItems && dataItems.length > 0) {
			const igData = dataItems[0]; // 拿到你的 IG 資料物件
			const followersCount = igData.followersCount;

			await env.THREADS_STORE.put('INSTAGRAM_DATA', JSON.stringify(igData));

			console.log('[Cron] 成功更新追蹤資訊，目前粉絲數: ', followersCount);
		} else {
			console.error('[Cron] Dataset 中沒有找到任何資料');
		}
	} catch (error) {
		console.error('[Cron] 刷新過程中發生異常:', error);
	}
}
