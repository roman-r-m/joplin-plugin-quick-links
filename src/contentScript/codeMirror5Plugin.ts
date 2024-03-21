import type { Editor } from "codemirror";
import { PluginContext } from "./types";

interface Hint {
	text: string;
	hint: Function;
	displayText?: string;
	render?: Function;
}

export default function codeMirror5Plugin(context: PluginContext, CodeMirror: any) {
	function NewNoteHint(prefix: string, todo: boolean) {
		let description = "New Note";

		if(todo)
			description = "New Task";

		const newNoteHint: Hint = {
			text: prefix,
			hint: async (cm: Editor, data, completion) => {
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
			if (!cm1.state.completionActive && cm.getTokenAt(cm.getCursor()).string.startsWith('@@')) {
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


