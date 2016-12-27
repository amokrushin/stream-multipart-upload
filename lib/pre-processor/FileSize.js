/* eslint-disable consistent-return, class-methods-use-this */
const { Readable, Transform } = require('stream');
const { InvalidChunk } = require('../errors');

class FileSize extends Transform {
    /**
     * Calculate a file's size
     * @extends Transform
     */
    constructor() {
        super({ objectMode: true, highWaterMark: 1 });
    }

    _transform(chunk, encoding, callback) {
        if (typeof chunk !== 'object' || !(chunk.file instanceof Readable)) {
            return callback(null, {
                errors: [new InvalidChunk('Invalid chunk format: `file` is not a readable stream')],
            });
        }

        let size = 0;
        chunk.file.on('data', (data) => {
            size += data.length;
        });
        chunk.file.once('end', () => {
            callback(null, {
                metadata: { size },
            });
        });
    }

    /**
     * @function write
     * @memberof FileSize#
     * @param {FileSize~InputChunk} chunk
     * @param {function} callback
     */

    /**
     * @typedef {Object} FileSize~InputChunk
     * @property {Readable} file
     */

    /**
     * @function read
     * @memberof FileSize#
     * @returns {?FileSize~OutputChunk}
     */

    /**
     * @typedef {Object} FileSize~OutputChunk
     * @property {Object} metadata
     * @property {string} metadata.size] File size in bytes.
     * @property {Array<Error>} [errors]
     */
}

module.exports = FileSize;
