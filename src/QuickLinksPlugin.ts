interface Hint {
	text: string;
	hint: Function;
	displayText?: string;
	render?: Function;
}

module.exports = {
	default: function(context: any) {

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
			let hints: Hint[] = [];

			//get local notes
			const response = await context.postMessage({ command: 'getNotes', prefix: prefix });
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
						<div style="display:table-cell; text-align: right;"><small><em>In ${folder}</em></small></div>
						`
					};
				} else {
					hint.displayText = note.title;
				}
				hints.push(hint);
			}

			//get wikipedia articles
			if (prefix){
				//query wikipedia
				var request = new XMLHttpRequest()
				request.open('GET', 'https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=5&srsearch='+prefix, false)
				request.send()
				var data = JSON.parse(request.response)
				if (request.status >= 200 && request.status < 400) {
					var results = data.query.search
					for (let i = 0; i < results.length; i++){
						var article = results[i]
						console.log(article.title)
						const hint0: Hint = {
							text: article.title,
							hint: async (cm, data, completion) => {
								const from = completion.from || data.from;
								from.ch -= 2;
								cm.replaceRange(`[${article.title}](https://en.wikipedia.org/wiki/${article.title})`, from, cm.getCursor(), "complete");
							},
						};
						if (response.showFolders) {
							hint0.render = (elem, _data, _completion) => {
								const p = elem.ownerDocument.createElement('div');
								p.setAttribute('style', 'width: 100%; display:table;');
								elem.appendChild(p);
								p.innerHTML = `
								<div style="display:table-cell; padding-right: 5px">${article.title}</div>
								<div style="display:table-cell; text-align: right;"><small><em>In Wikipedia</em></small></div>
								`
							};
						} else {
							hint0.displayText = article.title;
						}
						hints.push(hint0);
					}
				} else {
					console.log('error')
				}
			}
			

			if(response.allowNewNotes && prefix) {
				hints.push(NewNoteHint(prefix, false));
				hints.push(NewNoteHint(prefix, true));
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
