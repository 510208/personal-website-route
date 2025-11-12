/**
 * Rick Roll 重導向 - 只負責產生回應內容
 */

const handler = {
	async handle(request, env, ctx) {
		return {
			body: '',
			status: 302,
			headers: {
				Location: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
			},
		};
	},
};

export default handler;
