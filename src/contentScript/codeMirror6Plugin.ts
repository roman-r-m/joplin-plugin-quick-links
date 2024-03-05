
// To avoid importing @codemirror packages directly, we import CodeMirror types, then
// later, require dynamically.
//
// This allows us to continue supporting older versions of Joplin that don't depend
// on @codemirror/ packages.
import type * as CodeMirrorAutocompleteType from '@codemirror/autocomplete';
import type * as CodeMirrorStateType from '@codemirror/state';

import type { CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';

import { PluginContext } from './types';


export default function codeMirror6Plugin(pluginContext: PluginContext, CodeMirror: any) {
	const { autocompletion, insertCompletionText } = require('@codemirror/autocomplete') as typeof CodeMirrorAutocompleteType;
	const { EditorSelection } = require('@codemirror/state') as typeof CodeMirrorStateType;

	const completeMarkdown = async (completionContext: CompletionContext): Promise<CompletionResult> => {
		// Start completions on @@, match any characters that aren't in "()[]{};>,\n"
		const prefix = completionContext.matchBefore(/[@][@][^()\[\]{};:>,\n]*/);
		if (!prefix || (prefix.from === prefix.to && !completionContext.explicit)) {
			return null;
		}

		const searchText = prefix.text.substring(2); // Remove @@s
		const response = await pluginContext.postMessage({
			command: 'getNotes',
			prefix: searchText,
		});

		const createApplyCompletionFn = (noteTitle: string, noteId: string) => {
			return (view: EditorView, _completion: Completion, from: number, to: number) => {
				const markdownLink = `[${noteTitle}](:/${noteId})`;

				view.dispatch(
					insertCompletionText(
						view.state,
						markdownLink,
						from,
						to,
					),
				);

				if (response.selectText) {
					const selStart = from + 1;
					const selEnd = selStart + noteTitle.length;
					view.dispatch({
						selection: EditorSelection.range(selStart, selEnd),
					});
				}
			};
		};


		const notes = response.notes;
		const completions: Completion[] = [];
		for (const note of notes) {
			completions.push({
				apply: createApplyCompletionFn(note.title, note.id),
				label: note.title,
				detail: response.showFolders ? `In ${note.folder ?? 'unknown'}` : undefined,
			});
		}

		const addNewNoteCompletion = (todo: boolean) => {
			const title = searchText;
			const description = todo ? 'New Task' : 'New Note';
			completions.push({
				label: description,
				detail: `"${title}"`,
				apply: async (view, completion, from, to) => {
					const response = await pluginContext.postMessage({
						command: 'createNote',
						title,
						todo,
					});

					const applyCompletion = createApplyCompletionFn(title, response.newNote.id);
					applyCompletion(view, completion, from, to);
				},
			});
		};

		if (response.allowNewNotes && searchText.length > 0) {
			addNewNoteCompletion(true);
			addNewNoteCompletion(false);
		}

		return {
			from: prefix.from,
			options: completions,
			filter: false,
		};
	};

	let extension: Extension;

	if (CodeMirror.joplinExtensions) {
		extension = CodeMirror.joplinExtensions.completionSource(completeMarkdown);
	} else {
		// The override field doesn't work if there are multiple
		// plugins that try to use autocomplete. As such, only use it
		// if the Joplin autocomplete extension isn't available.
		extension = autocompletion({
			override: [ completeMarkdown ],
		});
	}

	CodeMirror.addExtension([
		extension,
		autocompletion({
			tooltipClass: () => 'quick-links-completions',
		}),
	]);
}

