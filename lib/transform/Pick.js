const { Transform } = require('stream');
const { pick, flatten } = require('lodash');

class CustomError extends Error {
    constructor(...args) {
        super(...args);
        this.name = this.constructor.name;
    }
}
class InvalidChunk extends CustomError {}

class Pick extends Transform {
    /**
     * Creates an object composed of the picked object properties for each chunk
     * @param {...(string|string[])} paths
     *      The property paths to pick
     * @see {@link https://lodash.com/docs/4.17.2#pick}
     * @extends Transform
     * @example
     * new Pick('metadata')
     *   .on('data', (chunk) => {
     *     console.log(chunk);
     *   })
     *   .end({ metadata: { a: 1 }, errors: [new Error('a')] });
     *
     * /*
     *   Prints:
     *   { metadata: { a: 1 } }
     * *​/
     */
    constructor(...paths) {
        super({ objectMode: true });
        this.options = { paths: flatten(paths) };
    }

    _transform(chunk, encoding, callback) {
        if (typeof chunk !== 'object' || Array.isArray(chunk)) {
            return callback(null, {
                errors: [new InvalidChunk('Invalid chunk format: `chunk` should be an array')],
            });
        }
        callback(null, pick(chunk, this.options.paths));
    }

    /**
     * @function write
     * @memberof Pick#
     * @param {Object} chunk
     * @param {function} callback
     */

    /**
     * @function read
     * @memberof Pick#
     * @returns {?Object}
     */
}

module.exports = Pick;
