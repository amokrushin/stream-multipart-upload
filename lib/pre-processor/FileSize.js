/* eslint-disable consistent-return, class-methods-use-this */
const { Readable, Transform } = require('stream');

class FileSize extends Transform {
    constructor(streamOptions) {
        super(Object.assign({}, streamOptions, { objectMode: true, highWaterMark: 1 }));
    }

    _transform(chunk, encoding, callback) {
        if (typeof chunk !== 'object' || !(chunk.file instanceof Readable)) {
            return callback(new TypeError('Invalid chunk format'));
        }

        let size = 0;
        chunk.file.on('data', (data) => {
            size += data.length;
        });
        chunk.file.on('end', () => {
            callback(null, { size });
        });
    }
}

module.exports = FileSize;
