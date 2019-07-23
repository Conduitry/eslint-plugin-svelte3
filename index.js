'use strict';

// get the total length, number of lines, and length of the last line of a string
const get_offsets = str => {
	const { length } = str;
	let lines = 1;
	let last = 0;
	for (let i = 0; i < length; i++) {
		if (str[i] === '\n') {
			lines++;
			last = 0;
		} else {
			last++;
		}
	}
	return { length, lines, last };
};

// dedent a script block, and get offsets necessary to later adjust linting messages about the block
const dedent_code = str => {
	let indentation = '';
	for (let i = 0; i < str.length; i++) {
		const char = str[i];
		if (char === '\n' || char === '\r') {
			indentation = '';
		} else if (char === ' ' || char === '\t') {
			indentation += str[i];
		} else {
			break;
		}
	}
	const { length } = indentation;
	let dedented = '';
	const offsets = [];
	const total_offsets = [0];
	for (let i = 0; i < str.length; i++) {
		if (i === 0 || str[i - 1] === '\n') {
			if (str.slice(i, i + length) === indentation) {
				i += length;
				offsets.push(length);
			} else {
				offsets.push(0);
			}
			total_offsets.push(total_offsets[total_offsets.length - 1] + offsets[offsets.length - 1]);
			if (i >= str.length) {
				break;
			}
		}
		dedented += str[i];
	}
	return { dedented, offsets: { offsets, total_offsets } };
};

// get character offsets of each line in a string
const get_line_offsets = str => {
	const offsets = [-1];
	for (let i = 0; i < str.length; i++) {
		if (str[i] === '\n') {
			offsets.push(i);
		}
	}
	return offsets;
};

// find the index of the last element of an array matching a condition
const find_last_index = (array, cond) => {
	const idx = array.findIndex(item => !cond(item));
	return idx === -1 ? array.length - 1 : idx - 1;
};

// find the last element of an array matching a condition
const find_last = (array, cond) => array[find_last_index(array, cond)];

// return a new block
const new_block = () => ({ transformed_code: '', line_offsets: null, translations: new Map() });

// get translation info and include the processed scripts in this block's transformed_code
const get_translation = (text, block, node, options = {}) => {
	block.transformed_code += '\n';
	const translation = { options, unoffsets: get_offsets(block.transformed_code) };
	translation.range = [node.start, node.end];
	const { dedented, offsets } = dedent_code(text.slice(node.start, node.end));
	block.transformed_code += dedented;
	translation.offsets = get_offsets(text.slice(0, node.start));
	translation.dedent = offsets;
	translation.end = get_offsets(block.transformed_code).lines;
	for (let i = translation.unoffsets.lines; i <= translation.end; i++) {
		block.translations.set(i, translation);
	}
	block.transformed_code += '\n';
};

const processor_options = {};

// find Linter instance
const linter_path = Object.keys(require.cache).find(path => path.endsWith('/eslint/lib/linter/linter.js') || path.endsWith('\\eslint\\lib\\linter\\linter.js'));
if (!linter_path) {
	throw new Error('Could not find ESLint Linter in require cache');
}
const { Linter } = require(linter_path);

// patch Linter#verify
const { verify } = Linter.prototype;
Linter.prototype.verify = function(code, config, options) {
	// fetch settings
	const settings = config && (typeof config.extractConfig === 'function' ? config.extractConfig(options.filename) : config).settings || {};
	processor_options.custom_compiler = settings['svelte3/compiler'];
	processor_options.ignore_warnings = settings['svelte3/ignore-warnings'];
	processor_options.ignore_styles = settings['svelte3/ignore-styles'];
	processor_options.compiler_options = settings['svelte3/compiler-options'];
	processor_options.named_blocks = settings['svelte3/named-blocks'];
	processor_options.svelte_preprocess = settings['svelte3/preprocess'];
	// call original Linter#verify
	return verify.call(this, code, config, options);
};

let state;
const reset = () => {
	state = {
		messages: null,
		var_names: null,
		blocks: new Map(),
		pre_line_offsets: null,
		post_line_offsets: null,
		mappings: null,
	};
};
reset();

var charToInteger = {};
var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
for (var i = 0; i < chars.length; i++) {
    charToInteger[chars.charCodeAt(i)] = i;
}
function decode(mappings) {
    var generatedCodeColumn = 0; // first field
    var sourceFileIndex = 0; // second field
    var sourceCodeLine = 0; // third field
    var sourceCodeColumn = 0; // fourth field
    var nameIndex = 0; // fifth field
    var decoded = [];
    var line = [];
    var segment = [];
    for (var i = 0, j = 0, shift = 0, value = 0, len = mappings.length; i < len; i++) {
        var c = mappings.charCodeAt(i);
        if (c === 44) { // ","
            if (segment.length)
                line.push(segment);
            segment = [];
            j = 0;
        }
        else if (c === 59) { // ";"
            if (segment.length)
                line.push(segment);
            segment = [];
            j = 0;
            decoded.push(line);
            line = [];
            generatedCodeColumn = 0;
        }
        else {
            var integer = charToInteger[c];
            if (integer === undefined) {
                throw new Error('Invalid character (' + String.fromCharCode(c) + ')');
            }
            var hasContinuationBit = integer & 32;
            integer &= 31;
            value += integer << shift;
            if (hasContinuationBit) {
                shift += 5;
            }
            else {
                var shouldNegate = value & 1;
                value >>>= 1;
                if (shouldNegate) {
                    value = -value;
                    if (value === 0)
                        value = -0x80000000;
                }
                if (j == 0) {
                    generatedCodeColumn += value;
                    segment.push(generatedCodeColumn);
                }
                else if (j === 1) {
                    sourceFileIndex += value;
                    segment.push(sourceFileIndex);
                }
                else if (j === 2) {
                    sourceCodeLine += value;
                    segment.push(sourceCodeLine);
                }
                else if (j === 3) {
                    sourceCodeColumn += value;
                    segment.push(sourceCodeColumn);
                }
                else if (j === 4) {
                    nameIndex += value;
                    segment.push(nameIndex);
                }
                j++;
                value = shift = 0; // reset
            }
        }
    }
    if (segment.length)
        line.push(segment);
    decoded.push(line);
    return decoded;
}

let default_compiler;

// find the contextual name or names described by a particular node in the AST
const contextual_names = [];
const find_contextual_names = (compiler, node) => {
	if (node) {
		if (typeof node === 'string') {
			contextual_names.push(node);
		} else if (typeof node === 'object') {
			compiler.walk(node, {
				enter(node, parent, prop) {
					if (node.name && prop !== 'key') {
						contextual_names.push(node.name);
					}
				},
			});
		}
	}
};

// extract scripts to lint from component definition
const preprocess = text => {
	const compiler = processor_options.custom_compiler || default_compiler || (default_compiler = require('svelte/compiler'));
	if (processor_options.ignore_styles) {
		// wipe the appropriate <style> tags in the file
		text = text.replace(/<style(\s[^]*?)?>[^]*?<\/style>/gi, (match, attributes = '') => {
			const attrs = {};
			attributes.split(/\s+/).filter(Boolean).forEach(attr => {
				const p = attr.indexOf('=');
				if (p === -1) {
					attrs[attr] = true;
				} else {
					attrs[attr.slice(0, p)] = '\'"'.includes(attr[p + 1]) ? attr.slice(p + 2, -1) : attr.slice(p + 1);
				}
			});
			return processor_options.ignore_styles(attrs) ? match.replace(/\S/g, ' ') : match;
		});
	}
	// run preprocessor if present
	if (processor_options.svelte_preprocess) {
		const result = processor_options.svelte_preprocess(text);
		if (result) {
			state.pre_line_offsets = get_line_offsets(text);
			text = result.code;
			state.post_line_offsets = get_line_offsets(text);
			state.mappings = decode(result.mappings);
		}
	}
	// get information about the component
	let result;
	try {
		result = compiler.compile(text, { generate: false, ...processor_options.compiler_options });
	} catch ({ name, message, start, end }) {
		// convert the error to a linting message, store it, and return
		state.messages = [
			{
				ruleId: name,
				severity: 2,
				message,
				line: start && start.line,
				column: start && start.column + 1,
				endLine: end && end.line,
				endColumn: end && end.column + 1,
			},
		];
		return [];
	}
	const { ast, warnings, vars } = result;
	const references_and_reassignments = `{${vars.filter(v => v.referenced).map(v => v.name)};${vars.filter(v => v.reassigned || v.export_name).map(v => v.name + '=0')}}`;
	state.var_names = new Set(vars.map(v => v.name));

	// convert warnings to linting messages
	state.messages = (processor_options.ignore_warnings ? warnings.filter(warning => !processor_options.ignore_warnings(warning)) : warnings).map(({ code, message, start, end }) => ({
		ruleId: code,
		severity: 1,
		message,
		line: start && start.line,
		column: start && start.column + 1,
		endLine: end && end.line,
		endColumn: end && end.column + 1,
	}));

	// build strings that we can send along to ESLint to get the remaining messages

	if (ast.module) {
		// block for <script context='module'>
		const block = new_block();
		state.blocks.set('module.js', block);

		get_translation(text, block, ast.module.content);

		if (ast.instance) {
			block.transformed_code += text.slice(ast.instance.content.start, ast.instance.content.end);
		}

		block.transformed_code += references_and_reassignments;
	}

	if (ast.instance) {
		// block for <script context='instance'>
		const block = new_block();
		state.blocks.set('instance.js', block);

		block.transformed_code = vars.filter(v => v.injected || v.module).map(v => `let ${v.name};`).join('');

		get_translation(text, block, ast.instance.content);

		block.transformed_code += references_and_reassignments;
	}

	if (ast.html) {
		// block for template
		const block = new_block();
		state.blocks.set('template.js', block);

		block.transformed_code = vars.map(v => `let ${v.name};`).join('');

		const nodes_with_contextual_scope = new WeakSet();
		let in_quoted_attribute = false;
		compiler.walk(ast.html, {
			enter(node, parent, prop) {
				if (prop === 'expression') {
					return this.skip();
				} else if (prop === 'attributes' && '\'"'.includes(text[node.end - 1])) {
					in_quoted_attribute = true;
				}
				contextual_names.length = 0;
				find_contextual_names(compiler, node.context);
				if (node.type === 'EachBlock') {
					find_contextual_names(compiler, node.index);
				} else if (node.type === 'ThenBlock') {
					find_contextual_names(compiler, parent.value);
				} else if (node.type === 'CatchBlock') {
					find_contextual_names(compiler, parent.error);
				} else if (node.type === 'Element' || node.type === 'InlineComponent') {
					node.attributes.forEach(node => node.type === 'Let' && find_contextual_names(compiler, node.expression || node.name));
				}
				if (contextual_names.length) {
					nodes_with_contextual_scope.add(node);
					block.transformed_code += `{let ${contextual_names.map(name => `${name}=0`).join(',')};`;
				}
				if (node.expression && typeof node.expression === 'object') {
					// add the expression in question to the constructed string
					block.transformed_code += '(';
					get_translation(text, block, node.expression, { template: true, in_quoted_attribute });
					block.transformed_code += ');';
				}
			},
			leave(node, parent, prop) {
				if (prop === 'attributes') {
					in_quoted_attribute = false;
				}
				// close contextual scope
				if (nodes_with_contextual_scope.has(node)) {
					block.transformed_code += '}';
				}
			},
		});
	}

	// return processed string
	return [...state.blocks].map(([filename, { transformed_code: text }]) => processor_options.named_blocks ? { text, filename } : text);
};

const unmap = message => {
	for (let j = 0; j < 2; j++) {
		if (message[j ? 'endLine' : 'line']) {
			const mapping = find_last(state.mappings[message[j ? 'endLine' : 'line'] - 1], ([column]) => column < message[j ? 'endColumn' : 'column']);
			if (!mapping || mapping[1] !== 0) {
				return false;
			}
			message[j ? 'endLine' : 'line'] = mapping[2] + 1;
			message[j ? 'endColumn' : 'column'] += mapping[3] - mapping[0];
		}
	}
	if (message.fix) {
		for (let j = 0; j < 2; j++) {
			const line = find_last_index(state.post_line_offsets, offset => offset < message.fix.range[j]);
			const line_offset = state.post_line_offsets[line];
			const mapping = find_last(state.mappings[line], ([column]) => column < message.fix.range[j] - line_offset);
			if (!mapping || mapping[1] !== 0) {
				return false;
			}
			message.fix.range[j] += mapping[3] - mapping[0] + state.pre_line_offsets[mapping[2]] - line_offset;
		}
	}
	return true;
};

// transform a linting message according to the module/instance script info we've gathered
const transform_message = ({ transformed_code }, { unoffsets, dedent, offsets, range }, message) => {
	// strip out the start and end of the fix if they are not actually changes
	if (message.fix) {
		while (message.fix.range[0] < message.fix.range[1] && transformed_code[message.fix.range[0]] === message.fix.text[0]) {
			message.fix.range[0]++;
			message.fix.text = message.fix.text.slice(1);
		}
		while (message.fix.range[0] < message.fix.range[1] && transformed_code[message.fix.range[1] - 1] === message.fix.text[message.fix.text.length - 1]) {
			message.fix.range[1]--;
			message.fix.text = message.fix.text.slice(0, -1);
		}
	}
	// shift position reference backward according to unoffsets
	{
		const { length, lines, last } = unoffsets;
		if (message.line === lines) {
			message.column -= last;
		}
		if (message.endColumn && message.endLine === lines) {
			message.endColumn -= last;
		}
		message.line -= lines - 1;
		if (message.endLine) {
			message.endLine -= lines - 1;
		}
		if (message.fix) {
			message.fix.range[0] -= length;
			message.fix.range[1] -= length;
		}
	}
	// adjust position reference according to the previous dedenting
	{
		const { offsets, total_offsets } = dedent;
		message.column += offsets[message.line - 1];
		if (message.endColumn) {
			message.endColumn += offsets[message.endLine - 1];
		}
		if (message.fix) {
			message.fix.range[0] += total_offsets[message.line];
			message.fix.range[1] += total_offsets[message.line];
		}
	}
	// shift position reference forward according to offsets
	{
		const { length, lines, last } = offsets;
		if (message.line === 1) {
			message.column += last;
		}
		if (message.endColumn && message.endLine === 1) {
			message.endColumn += last;
		}
		message.line += lines - 1;
		if (message.endLine) {
			message.endLine += lines - 1;
		}
		if (message.fix) {
			message.fix.range[0] += length;
			message.fix.range[1] += length;
		}
	}
	// make sure the fix doesn't include anything outside the range of the script
	if (message.fix) {
		if (message.fix.range[0] < range[0]) {
			message.fix.text = message.fix.text.slice(range[0] - message.fix.range[0]);
			message.fix.range[0] = range[0];
		}
		if (message.fix.range[1] > range[1]) {
			message.fix.text = message.fix.text.slice(0, range[1] - message.fix.range[1]);
			message.fix.range[1] = range[1];
		}
	}
};

// extract the string referenced by a message
const get_referenced_string = (block, message) => {
	if (message.line && message.column && message.endLine && message.endColumn) {
		if (!block.line_offsets) {
			block.line_offsets = get_line_offsets(block.transformed_code);
		}
		return block.transformed_code.slice(block.line_offsets[message.line - 1] + message.column, block.line_offsets[message.endLine - 1] + message.endColumn);
	}
};

// extract something that looks like an identifier (not supporting unicode escape stuff) from the beginning of a string
const get_identifier = str => (str && str.match(/^[^\s!"#%&\\'()*+,\-./:;<=>?@[\\\]^`{|}~]+/) || [])[0];

// determine whether this message from ESLint is something we care about
const is_valid_message = (block, message, translation) => {
	switch (message.ruleId) {
		case 'eol-last': return false;
		case 'indent': return !translation.options.template;
		case 'linebreak-style': return message.line !== translation.end;
		case 'no-labels': return get_identifier(get_referenced_string(block, message)) !== '$';
		case 'no-restricted-syntax': return message.nodeType !== 'LabeledStatement' || get_identifier(get_referenced_string(block, message)) !== '$';
		case 'no-self-assign': return !state.var_names.has(get_identifier(get_referenced_string(block, message)));
		case 'no-unused-labels': return get_referenced_string(block, message) !== '$';
		case 'quotes': return !translation.options.in_quoted_attribute;
	}
	return true;
};

// transform linting messages and combine with compiler warnings
const postprocess = blocks_messages => {
	// filter messages and fix their offsets
	const blocks_array = [...state.blocks.values()];
	for (let i = 0; i < blocks_messages.length; i++) {
		const block = blocks_array[i];
		for (let j = 0; j < blocks_messages[i].length; j++) {
			const message = blocks_messages[i][j];
			const translation = block.translations.get(message.line);
			if (translation && is_valid_message(block, message, translation)) {
				transform_message(block, translation, message);
				state.messages.push(message);
			}
		}
	}
	if (state.mappings) {
		state.messages = state.messages.filter(unmap);
	}

	// sort messages and return
	const sorted_messages = state.messages.sort((a, b) => a.line - b.line || a.column - b.column);
	reset();
	return sorted_messages;
};

var index = { processors: { svelte3: { preprocess, postprocess, supportsAutofix: true } } };

module.exports = index;
