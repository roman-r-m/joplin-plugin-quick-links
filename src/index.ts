import joplin from 'api';
import { ContentScriptType, SettingItemType } from 'api/types';

const NUM_RESULTS = 21;
const FOLDERS_REFRESH_INTERVAL = 60000;
const SETTING_SHOW_FOLDERS = 'showFolders';
const SETTING_ALLOW_NEW_NOTES = 'allowNewNotes';
const SETTING_SELECT_TEXT = 'selectText';

let showFolders = false;
let allowNewNotes = false;
let selectText = false;
let folders = {};

async function onShowFolderSettingChanged() {
	showFolders = await joplin.settings.value(SETTING_SHOW_FOLDERS);
	if (showFolders) {
		await refreshFolderList();
	}
}

async function onAllowNewNotesSettingChanged() {
	allowNewNotes = await joplin.settings.value(SETTING_ALLOW_NEW_NOTES);
}

async function onSelectTextSettingChanged() {
	selectText = await joplin.settings.value(SETTING_SELECT_TEXT);
}

async function refreshFolderList() {
	folders = await getFolders();
	setTimeout(() => {
		if (showFolders) refreshFolderList();
	}, FOLDERS_REFRESH_INTERVAL);
}

async function getNotes(prefix: string): Promise<any[]> {
	if (prefix === "") {
		const notes = await joplin.data.get(['notes'], {
			fields: ['id', 'title', 'parent_id'],
			order_by: 'updated_time',
			order_dir: 'DESC',
			limit: NUM_RESULTS,
		});
		return notes.items;
	} else {
		const notes = await joplin.data.get(['search'], {
			fields: ['id', 'title', 'parent_id'],
			limit: NUM_RESULTS,
			query: `title:${prefix.trimRight()}*`,
		});
		return notes.items;
	}
}

async function getFolders() {
	let folders = {};

	const query =  { fields: ['id', 'title'], page: 1 };
	let result = await joplin.data.get(['folders'], query);
	result.items.forEach(i => folders[i.id] = i.title);

	while (!!result.has_more) {
		query.page += 1;
		result = await joplin.data.get(['folders'], query);
		result.items.forEach(i => folders[i.id] = i.title);
	}
	return folders;
}

async function initSettings() {
	const SECTION = 'QuickLinks';

	await joplin.settings.registerSection(SECTION, {
		description: 'Quick Links Plugin Settings',
		label: 'Quick Links',
		iconName: 'fas fa-link'
	});

	await joplin.settings.registerSettings({
		[SETTING_SHOW_FOLDERS]: { 
			public: true,
			section: SECTION,
			type: SettingItemType.Bool,
			value: showFolders,
			label: 'Show Notebooks',
		},
		[SETTING_ALLOW_NEW_NOTES]: {
			public: true,
			section: SECTION,
			type: SettingItemType.Bool,
			value: allowNewNotes,
			label: 'Allow new notes',
		},
		[SETTING_SELECT_TEXT]: {
			public: true,
			section: SECTION,
			type: SettingItemType.Bool,
			value: selectText,
			label: 'Select link text after inserting',
		}		
	});

	await onShowFolderSettingChanged();

	await onAllowNewNotesSettingChanged();
	await onAllowNewNotesSettingChanged();
	await onSelectTextSettingChanged();

	await joplin.settings.onChange(change => {
		const showFoldersIdx = change.keys.indexOf(SETTING_SHOW_FOLDERS);
		if (showFoldersIdx >= 0) {
			onShowFolderSettingChanged();
		}
		const allowNewNotesIdx = change.keys.indexOf(SETTING_ALLOW_NEW_NOTES);
		if (allowNewNotesIdx >= 0) {
			onAllowNewNotesSettingChanged();
		}
		const selectTextIdx = change.keys.indexOf(SETTING_SELECT_TEXT);
		if (selectTextIdx >= 0) {
			onSelectTextSettingChanged();
		}		
	});
}

joplin.plugins.register({
	onStart: async function() {
		await initSettings();

		await joplin.contentScripts.register(
			ContentScriptType.CodeMirrorPlugin,
			'quickLinks',
			'./contentScript/index.js'
		);

		await joplin.contentScripts.onMessage('quickLinks', async (message: any) => {
			const selectedNoteIds = await joplin.workspace.selectedNoteIds();
			const noteId = selectedNoteIds[0];
			if (message.command === 'getNotes') {
				const prefix = message.prefix;
				let notes = await getNotes(prefix);
				const res =  notes.filter(n => n.id !== noteId).map(n => {
					return {
						id: n.id,
						title: n.title,
						folder: folders[n.parent_id]
					};
				});
				return {
					notes: res,
					showFolders: showFolders,
					allowNewNotes: allowNewNotes,
					selectText: selectText
				};
			}
			else if(message.command === 'createNote')
			{
				const activeNote = await joplin.workspace.selectedNote();
				const activeNotesFolder = await joplin.data.get(['folders', activeNote.parent_id]);
				const newNote = await joplin.data.post(['notes'], null,
					{
						is_todo: message.todo,
						title: message.title,
						parent_id: activeNotesFolder.id
					});

				return {newNote: newNote};
			}
		});
	}
});
