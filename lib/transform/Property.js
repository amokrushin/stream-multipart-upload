const { Transform } = require('stream');
const _ = require('lodash');

class Property extends Transform {
    constructor(path, options) {
        super(Object.assign({}, options, { objectMode: true }));
        this.path = path;
    }

    _transform(chunk, encoding, cb) {
        cb(null, _.get(chunk, this.path));
    }
}

module.exports = Property;
