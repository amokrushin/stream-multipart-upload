/* eslint-disable consistent-return */
const { Readable, Transform } = require('stream');
const crypto = require('crypto');
const bs58 = require('bs58');

class FileHash extends Transform {
    constructor(options, streamOptions) {
        super(Object.assign({}, streamOptions, { objectMode: true, highWaterMark: 1 }));
        this.algorithm = (options && options.algorithm) || 'sha1';
        this.encoding = (options && options.encoding) || 'hex'; // hex, bs58
    }

    _transform(chunk, encoding, callback) {
        if (typeof chunk !== 'object' || !(chunk.file instanceof Readable)) {
            return callback(new TypeError('Invalid chunk format'));
        }

        const stream = crypto
            .createHash(this.algorithm)
            .setEncoding('hex')
            .once('finish', () => {
                const hash = this.encoding === 'bs58'
                    ? bs58.encode(new Buffer(stream.read(), 'hex'))
                    : stream.read();
                callback(null, { [this.algorithm]: hash });
            });

        chunk.file.pipe(stream);
    }
}

module.exports = FileHash;
