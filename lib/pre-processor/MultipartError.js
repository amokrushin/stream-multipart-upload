/* eslint-disable consistent-return, class-methods-use-this */
const { Readable, Transform } = require('stream');
const _ = require('lodash');

class MultipartError extends Transform {
    constructor(streamOptions) {
        super(Object.assign({}, streamOptions, { objectMode: true, highWaterMark: 1 }));
    }

    _transform(chunk, encoding, callback) {
        if (typeof chunk !== 'object' || !(chunk.file instanceof Readable)) {
            return callback(new TypeError('Invalid chunk format'));
        }
        const _callback = _.once(callback);
        chunk.file.once('end', () => {
            _callback(null, {});
        });
        chunk.file.once('error', (err) => {
            _callback(null, { error: err.message });
        });
        chunk.file.resume();
    }
}

module.exports = MultipartError;
