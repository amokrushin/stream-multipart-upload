/* eslint-disable consistent-return */
const { Readable, Transform } = require('stream');
const uuid = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class StorageTempLocal extends Transform {
    constructor(options, streamOptions) {
        super(Object.assign({}, streamOptions, { objectMode: true, highWaterMark: 1 }));

        this.options = Object.assign({
            tmpDir: os.tmpdir(),
            ensureDir: true,
        }, options);

        if (options && options.tmpDir && options.ensureDir !== false) {
            fs.ensureDirSync(this.options.tmpDir);
        }

        // eslint-disable-next-line no-bitwise
        fs.accessSync(this.options.tmpDir, fs.constants.R_OK | fs.constants.W_OK);
    }

    _transform(chunk, encoding, callback) {
        if (typeof chunk !== 'object' || !(chunk.file instanceof Readable)) {
            return callback(new TypeError('Invalid chunk format: file is not readable stream'));
        }

        const localTmpFilename = uuid.v1();
        const localTmpFilepath = path.join(this.options.tmpDir, localTmpFilename);

        const stream = fs
            .createWriteStream(localTmpFilepath)
            .on('finish', () => {
                callback(null, { localTmpFilepath });
            });

        chunk.file.pipe(stream);
    }
}

module.exports = StorageTempLocal;
