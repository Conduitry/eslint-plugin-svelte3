module.exports = {
	processorOptions: {
		ignoreStyles: attributes => attributes.foo && attributes.foo.includes('bar'),
	},
};
