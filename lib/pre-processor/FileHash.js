/* eslint-disable consistent-return */
const { Readable, Transform } = require('stream');
const crypto = require('crypto');
const bs58 = require('bs58');
const { InvalidChunk } = require('../errors');

class FileHash extends Transform {
    /**
     * Compute a file's hash digest
     * @param {Object} options
     *      FileHash options.
     * @param {string} [options.algorithm='sha1']
     *      Hash function algorithm.
     * @param {'hex'|'latin1'|'base64'|'bs58'} [options.encoding='hex']
     *      Hash output encoding.
     * @param {string} [options.algorithmNameAsKey=true]
     *      Output metadata object key is `[algorithm]`, otherwise `hash`.
     * @extends Transform
     */
    constructor(options) {
        super({ objectMode: true, highWaterMark: 1 });
        this.options = Object.assign({
            algorithm: 'sha1',
            encoding: 'hex',
            algorithmNameAsKey: true,
        }, options);
    }

    _transform(chunk, encoding, callback) {
        if (typeof chunk !== 'object' || !(chunk.file instanceof Readable)) {
            return callback(null, {
                errors: [new InvalidChunk('Invalid chunk format: `file` is not a readable stream')],
            });
        }

        const stream = crypto
            .createHash(this.options.algorithm)
            .setEncoding('hex')
            .once('finish', () => {
                const hash = this.options.encoding === 'bs58'
                    ? bs58.encode(new Buffer(stream.read(), 'hex'))
                    : stream.read();
                if (this.options.algorithmNameAsKey) {
                    callback(null, { metadata: { [this.options.algorithm]: hash } });
                } else {
                    callback(null, { metadata: { hash } });
                }
            });

        chunk.file.pipe(stream);
    }

    /**
     * @function write
     * @memberof FileHash#
     * @param {FileHash~InputChunk} chunk
     * @param {function} callback
     */

    /**
     * @typedef {Object} FileHash~InputChunk
     * @property {Readable} file
     */

    /**
     * @function read
     * @memberof FileHash#
     * @returns {?FileHash~OutputChunk}
     */

    /**
     * @typedef {Object} FileHash~OutputChunk
     * @property {Object} metadata
     * @property {string} metadata.[algorithm]] Hash digests of file data using the given algorithm.
     * @property {Array<Error>} [errors]
     */
}

module.exports = FileHash;
