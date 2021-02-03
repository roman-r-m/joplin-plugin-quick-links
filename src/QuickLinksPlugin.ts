interface Hint {
	text: string;
	hint: Function;
	displayText?: string;
	render?: Function;
}

module.exports = {
	default: function(context: any) {

		const buildHints = async (prefix: string) =>{
			const response = await context.postMessage({ command: 'getNotes', prefix: prefix });

			let hints: Hint[] = [];
			const notes = response.notes;
			for (let i = 0; i < notes.length; i++) {
				const note = notes[i];
				const hint: Hint = {
                    text: note.title,
                    hint: async (cm, data, completion) => {
                        const from = completion.from || data.from;
                        from.ch -= 2;
                        cm.replaceRange(`[${note.title}](:/${note.id})`, from, cm.getCursor(), "complete");
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
						<div style="display:table-cell; text-align: right;"><small><em>In ${note.folder}</em></small></div>
						`
					};
				} else {
					hint.displayText = note.title;
				}
                hints.push(hint);
			}
			return hints;
		}

		const plugin = function(CodeMirror) {
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
		};

		return {
			plugin: plugin,
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
        }
    }
}