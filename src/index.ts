import joplin from 'api';
import { ContentScriptType, Path } from 'api/types';

async function getNotes(prefix: string): Promise<any[]> {
	if (prefix === "") {
		const notes = await joplin.data.get(['notes'], {
			fields: ['id', 'title'],
			order_by: 'updated_time',
			order_dir: 'DESC',
			limit: 11,
		});
		return notes.items;
	} else {
		const notes = await joplin.data.get(['search'], {
			fields: ['id', 'title'],
			limit: 21,
			query: `title:${prefix.trimRight()}*`,
		});
		return notes.items;
	}
}

joplin.plugins.register({
	onStart: async function() {
		await joplin.contentScripts.register(
			ContentScriptType.CodeMirrorPlugin,
			'quickLinks',
			'./QuickLinksPlugin.js'
		);

		await joplin.contentScripts.onMessage('quickLinks', async (message: any) => {
			const selectedNoteIds = await joplin.workspace.selectedNoteIds();
			const noteId = selectedNoteIds[0];
			if (message.command === 'getNotes') {
				const prefix = message.prefix;
				let notes = await getNotes(prefix);
				return notes.filter(n => n.id !== noteId);
			}
		});
	},
});
