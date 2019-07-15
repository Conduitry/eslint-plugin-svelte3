import { decode } from 'sourcemap-codec';
import { state } from './state.js';
import { find_last, find_last_index } from './utils.js';

export const map = () => {
	if (state.mappings) {
		const decoded_mappings = decode(state.mappings);
		for (let i = 0; i < state.messages.length; i++) {
			const message = state.messages[i];
			for (let j = 0; j < 2; j++) {
				if (message[j ? 'endLine' : 'line']) {
					const mapping = find_last(decoded_mappings[message[j ? 'endLine' : 'line'] - 1], ([column]) => column < message[j ? 'endColumn' : 'column']);
					if (mapping && mapping[1] === 0) {
						message[j ? 'endLine' : 'line'] = mapping[2] + 1;
						message[j ? 'endColumn' : 'column'] += mapping[3] - mapping[0];
					}
				}
			}
			if (message.fix) {
				for (let j = 0; j < 2; j++) {
					const line = find_last_index(state.post_line_offsets, offset => offset < message.fix.range[j]);
					const line_offset = state.post_line_offsets[line];
					const mapping = find_last(decoded_mappings[line], ([column]) => column < message.fix.range[j] - line_offset);
					if (mapping && mapping[1] === 0) {
						message.fix.range[j] += mapping[3] - mapping[0] + state.pre_line_offsets[mapping[2]] - line_offset;
					}
				}
			}
		}
	}
};
