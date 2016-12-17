/* eslint-disable class-methods-use-this */
const { Transform } = require('stream');

class Merge extends Transform {
    constructor(options) {
        super(Object.assign({}, options, { objectMode: true }));
    }

    _transform(chunk, encoding, callback) {
        if (!Array.isArray(chunk)) {
            callback(new TypeError('chunk should be an array'));
        }
        callback(null, chunk.reduce((result, item) => Object.assign(result, item)), {});
    }
}

module.exports = Merge;
