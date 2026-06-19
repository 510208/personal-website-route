/**
 * Rick Roll 重導向 - 只負責產生回應內容
 */

const RICK_ROLL_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const handler = {
	async handle() {
		return {
			body: '',
			status: 302,
			headers: {
				Location: RICK_ROLL_URL,
			},
		};
	},
};

export default handler;
