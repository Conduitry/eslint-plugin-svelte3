module.exports = {
	rules: {
		'no-undef': 'error',
	},
	processorOptions: {
		ignoreWarnings: ({ code }) => code === 'missing-declaration',
	},
};
