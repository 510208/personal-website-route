export function getPersonalInfo() {
	const taipeiYear = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', year: 'numeric' }).format(new Date()));

	return {
		name: 'SamHacker',
		aka: ['510208', 'Misaka Itosana'],
		age: taipeiYear - 2010,
		location: 'Taichung, Taiwan',
		links: [
			{ github: 'https://github.com/510208' },
			{ wakatime: 'https://wakatime.com/@SamHacker' },
			{ blog: 'https://samhacker.xyz' },
			{ personal_website: 'https://510208.github.io' },
			{ bento: 'https://bento.me/510208' },
			{ threads: 'https://www.threads.com/@samhacker.xyz' },
			{ youtube: 'https://www.youtube.com/channel/UC6orwHdQNVzwHsA6M7HYD9g' },
		],
		school: 'Taichung Municipal Taichung First Senior High School',
		hobbies: ['programming', 'reading', 'gaming', 'watching anime'],
	};
}
