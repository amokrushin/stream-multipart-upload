const { Transform } = require('stream');
const { mergeWith } = require('lodash');

class CustomError extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
    }
}
class InvalidChunk extends CustomError {}

class Merge extends Transform {
    /**
     * Merges array of objects to a single object
     * @extends Transform
     * @example
     * new Merge()
     *   .on('data', (chunk) => {
     *     console.log(chunk);
     *   })
     *   .end([
     *     { metadata: { a: 1 }, errors: [new Error('a')] },
     *     { metadata: { b: 2 }, errors: [new Error('b')] },
     *     { metadata: { a: 3 } },
     *   ]);
     *
     * /*
     *   Prints:
     *   {
     *     metadata: { a: 3, b: 2 },
     *     errors: [Error: a, Error: b],
     *   }
     * *​/
     */
    constructor() {
        super({ objectMode: true });
    }

    _transform(chunk, encoding, callback) {
        if (!Array.isArray(chunk)) {
            return callback(null, {
                errors: [new InvalidChunk('Invalid chunk format: `chunk` should be an array')],
            });
        }
        for (let i = 0; i < chunk.length; i++) {
            if (typeof chunk[i] !== 'object') {
                return callback(null, {
                    errors: [new InvalidChunk('Invalid chunk format: `chunk` should be an array of objects')],
                });
            }
        }

        const customizer = (obj, src) => {
            if (Array.isArray(obj)) {
                return obj.concat(src);
            }
        };
        callback(null, mergeWith(...chunk, customizer));
    }

    /**
     * @typedef {Object} Merge~InputChunk
     * @property {Object} [metadata]
     * @property {Array<Error>} [errors]
     */

    /**
     * @typedef {Object} Merge~OutputChunk
     * @property {Object} [metadata]
     * @property {Error|Array<Error>} [errors]
     */

    /**
     * @function write
     * @memberof Merge#
     * @param {Array<Pick~InputChunk>} chunk
     * @param {function} callback
     */

    /**
     * @function read
     * @memberof Merge#
     * @returns {?Pick~OutputChunk}
     */
}

module.exports = Merge;
