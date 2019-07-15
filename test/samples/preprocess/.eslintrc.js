const MagicString = require('magic-string');

module.exports = {
	rules: {
		'arrow-spacing': 'error',
	},
	settings: {
		'svelte3/preprocess': code => {
			const s = new MagicString(code);
			s.overwrite(4, 5, 'hello');
			s.overwrite(3, 4, '');
			return { code: s.toString(), mappings: s.generateMap().mappings };
		},
	},
};
