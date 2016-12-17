const { Transform } = require('stream');

class JsonStream extends Transform {
    constructor(options = {}) {
        super(Object.assign({}, options, { objectMode: true }));
        this._isFirstChunk = 0;
    }

    _transform(chunk, encoding, callback) {
        if (!this._isFirstChunk) {
            this._isFirstChunk = true;
            this.push(`[${JSON.stringify(chunk)}`);
        } else {
            this.push(`,${JSON.stringify(chunk)}`);
        }
        callback();
    }

    _flush(callback) {
        if (this._isFirstChunk) {
            this.push(']');
        } else {
            this.push('[]');
        }
        callback();
    }
}

module.exports = JsonStream;
