import { state } from './state.js';
import { find_last, find_last_index } from './utils.js';

export const unmap = message => {
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
