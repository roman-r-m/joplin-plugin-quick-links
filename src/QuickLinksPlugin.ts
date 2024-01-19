import { Editor } from "codemirror";
import type * as CodeMirrorAutocompleteType from '@codemirror/autocomplete';
import type * as CodeMirrorMarkdownType from '@codemirror/lang-markdown';
import type * as CodeMirrorStateType from '@codemirror/state';
import type { CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete';
import type { EditorView } from '@codemirror/view';

interface Hint {
	text: string;
	hint: Function;
	displayText?: string;
	render?: Function;
}

interface PluginContext {
	postMessage(message: any): Promise<any>;
}

function codeMirror5Plugin(context: PluginContext, CodeMirror: any) {
	function NewNoteHint(prefix: string, todo: boolean) {
		let description = "New Note";

		if(todo)
			description = "New Task";

		const newNoteHint: Hint = {
			text: prefix,
			hint: async (cm, data, completion) => {
				const from = completion.from || data.from;
				from.ch -= 2;

				const response = await context.postMessage({command: 'createNote', title: prefix, todo: todo});
				cm.replaceRange(`[${prefix}](:/${response.newNote.id})`, from, cm.getCursor(), "complete");
			},
		};

		newNoteHint.render = (elem, _data, _completion) => {
			const p = elem.ownerDocument.createElement('div');
			p.setAttribute('style', 'width: 100%; display:table;');
			elem.appendChild(p);
			p.innerHTML = `
					<div style="display:table-cell; padding-right: 5px">${prefix}</div>
					<div style="display:table-cell; text-align: right;"><small><em>${description}</em></small></div>
					`
		};
		return newNoteHint;
	}

	const buildHints = async (prefix: string) =>{
		const response = await context.postMessage({ command: 'getNotes', prefix: prefix });

		let hints: Hint[] = [];

		const notes = response.notes;
		for (let i = 0; i < notes.length; i++) {
			const note = notes[i];
			const hint: Hint = {
				text: note.title,
				hint: async (cm: Editor, data, completion) => {
					const from = completion.from || data.from;
					from.ch -= 2;
					cm.replaceRange(`[${note.title}](:/${note.id})`, from, cm.getCursor(), "complete");
					if (response.selectText) {
						const selectionStart = Object.assign({}, from);
						const selectionEnd = Object.assign({}, from);
						selectionStart.ch += 1;
						selectionEnd.ch += 1 + note.title.length;
						cm.setSelection(selectionStart, selectionEnd)
					}
				},
			};
			if (response.showFolders) {
				const folder = !!note.folder ? note.folder  : "unknown";
				hint.render = (elem, _data, _completion) => {
					const p = elem.ownerDocument.createElement('div');
					p.setAttribute('style', 'width: 100%; display:table;');
					elem.appendChild(p);
					p.innerHTML = `
					<div style="display:table-cell; padding-right: 5px">${note.title}</div>
					<div style="display:table-cell; text-align: right;"><small><em>In ${folder}</em></small></div>
					`
				};
			} else {
				hint.displayText = note.title;
			}
			hints.push(hint);
		}

		if(response.allowNewNotes && prefix) {
			hints.push(NewNoteHint(prefix, false));
			hints.push(NewNoteHint(prefix, true));
		}

		return hints;
	}

	CodeMirror.defineOption('quickLinks', false, function(cm, value, prev) {
		if (!value) return;

		cm.on('inputRead', async function (cm1, change) {
			if (!cm1.state.completionActive && cm.getTokenAt(cm.getCursor()).string === '@@') {
				const start = {line: change.from.line, ch: change.from.ch + 1};

				const hint = function(cm, callback) {
					const cursor = cm.getCursor();
					let prefix = cm.getRange(start, cursor) || '';

					buildHints(prefix).then(hints => {
						callback({
							list: hints,
							from: {line: change.from.line, ch: change.from.ch + 1},
							to: {line: change.to.line, ch: change.to.ch + 1},
						});
					});
				};

				setTimeout(function () {
					CodeMirror.showHint(cm, hint, {
						completeSingle: false,
						closeOnUnfocus: true,
						async: true,
						closeCharacters: /[()\[\]{};:>,]/
					});
				}, 10);
			}
		});
	});
}

function codeMirror6Plugin(pluginContext: PluginContext, CodeMirror: any) {
	const { autocompletion, insertCompletionText } = require('@codemirror/autocomplete') as typeof CodeMirrorAutocompleteType;
	const { markdownLanguage } = require('@codemirror/lang-markdown') as typeof CodeMirrorMarkdownType;
	const { EditorSelection } = require('@codemirror/state') as typeof CodeMirrorStateType;

	const completeMarkdown = async (completionContext: CompletionContext): Promise<CompletionResult> => {
		const prefix = completionContext.matchBefore(/[@][@]\w+/);
		if (!prefix || (prefix.from === prefix.to && !completionContext.explicit)) {
			return null;
		}

		const response = await pluginContext.postMessage({
			command: 'getNotes',
			prefix: prefix.text,
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
			const title = prefix.text.substring(2);
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
					createApplyCompletionFn(
						title, response.newNote.id
					)(view, completion, from, to);
				},
			});
		};

		if (response.allowNewNotes) {
			addNewNoteCompletion(true);
			addNewNoteCompletion(false);
		}

		return {
			from: prefix.from,
			options: completions,
			filter: false,
		};
	};

	CodeMirror.addExtension([
		autocompletion({
			activateOnTyping: true,
			override: [ completeMarkdown ],
			tooltipClass: () => 'quick-links-completions',
			closeOnBlur: false,
		}),
		markdownLanguage.data.of({
			autocomplete: completeMarkdown,
		}),
	]);
}

module.exports = {
	default: function(context: PluginContext) {
		return {
			plugin: (CodeMirror: any) => {
				if (CodeMirror.cm6) {
					return codeMirror6Plugin(context, CodeMirror);
				} else {
					return codeMirror5Plugin(context, CodeMirror);
				}
			},
			codeMirrorResources: [
			    'addon/hint/show-hint',
			],
			codeMirrorOptions: {
    			'quickLinks': true,
			},
			assets: function() {
			    return [
			        { name: './show-hint.css'},
			    ]
			}
        };
    },
};
