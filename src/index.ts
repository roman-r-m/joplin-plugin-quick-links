import joplin from 'api';
import { ContentScriptType, Path } from 'api/types';

joplin.plugins.register({
	onStart: async function() {
		await joplin.contentScripts.register(
			ContentScriptType.CodeMirrorPlugin,
			'quickLinks',
			'./QuickLinksPlugin.js'
		);

		await joplin.contentScripts.onMessage('quickLinks', async (message: any) => {
			if (message.command === 'getNotes') {
				const prefix = message.prefix;
				if (prefix === "") {
					const notes = await joplin.data.get(['notes'], {
						fields: ['id', 'title'],
						order_by: 'updated_time',
						order_dir: 'DESC',
						limit: 10,
					});
					return notes.items;
				} else {
					const notes = await joplin.data.get(['search'], {
						fields: ['id', 'title'],
						limit: 10,
						query: `title:${prefix}*`,
					});
					return notes.items;
				}
			}
		});
	},
});
