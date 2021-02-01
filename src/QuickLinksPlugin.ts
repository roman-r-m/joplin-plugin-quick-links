module.exports = {
	default: function(context: any) {

		const buildHints = async (prefix: string) =>{
			const notes = await context.postMessage({
                command: 'getNotes',
                prefix: prefix,
            });

            let hints = [];
			for (let i = 0; i < notes.length; i++) {
				const note = notes[i];
                hints.push({
                    text: note.title,
                    displayText: note.title,
                    hint: async (cm, data, completion) => {
                        const from = completion.from || data.from;
                        from.ch -= 2;
                        cm.replaceRange(`[${note.title}](:/${note.id})`, from, cm.getCursor(), "complete");
                    }
                });
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