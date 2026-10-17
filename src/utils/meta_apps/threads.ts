// 刷新Threads API token
import type { Bindings } from '../../types';

export async function refreshThreadsToken(env: Bindings) {
	try {
		const currentToken = await env.THREADS_STORE.get('THREADS_LONG_LIVED_TOKEN');
		if (!currentToken) {
			console.error('[Cron] 找不到現有的長期 Token，無法刷新。');
			return;
		}

		// 呼叫 Meta 官方的延長（刷新）端點
		const url = `https://graph.threads.com/refresh_access_token?grant_type=th_refresh_token&access_token=${currentToken}`;
		const response = await fetch(url);
		const result: any = await response.json();

		if (result.access_token) {
			// 成功拿到新 Token（效期延長 60 天），寫回 KV 覆蓋舊的
			await env.THREADS_STORE.put('THREADS_LONG_LIVED_TOKEN', result.access_token);
			console.log('[Cron] Threads 長期 Token 自動刷新成功！');
		} else {
			console.error('[Cron] 刷新失敗，Meta 回傳錯誤:', result);
		}
	} catch (error) {
		console.error('[Cron] 刷新過程中發生異常:', error);
	}
}
