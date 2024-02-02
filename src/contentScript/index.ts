import { PluginContext } from './types';
import codeMirror5Plugin from './codeMirror5Plugin';
import codeMirror6Plugin from './codeMirror6Plugin';

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
