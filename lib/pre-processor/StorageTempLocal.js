/* eslint-disable consistent-return */
const { Readable, Transform } = require('stream');
const uuid = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { InvalidChunk } = require('../errors');

class StorageTempLocal extends Transform {
    /**
     * Save temporary files.
     * @param {Object} options
     *      StorageTempLocal options.
     * @param {string} [options.tmpDir=os.tmpdir()]
     *      Directory for temporary files.
     * @param {boolean} [options.ensureDir=true]
     *      Ensure that dir exists, create if not.
     * @extends Transform
     */
    constructor(options) {
        super({ objectMode: true, highWaterMark: 1 });

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
            return callback(null, {
                errors: [new InvalidChunk('Invalid chunk format: `file` is not a readable stream')],
            });
        }

        const localTmpFilename = uuid.v1();
        const localTmpFilepath = path.join(this.options.tmpDir, localTmpFilename);

        const stream = fs
            .createWriteStream(localTmpFilepath)
            .on('finish', () => {
                callback(null, {
                    metadata: {
                        localTmpFilepath,
                    },
                });
            });

        chunk.file.pipe(stream);
    }

    /**
     * @function write
     * @memberof StorageTempLocal#
     * @param {StorageTempLocal~InputChunk} chunk
     * @param {function} callback
     */

    /**
     * @typedef {Object} StorageTempLocal~InputChunk
     * @property {Readable} file
     */

    /**
     * @function read
     * @memberof StorageTempLocal#
     * @returns {?StorageTempLocal~OutputChunk}
     */

    /**
     * @typedef {Object} StorageTempLocal~OutputChunk
     * @property {Object} metadata
     * @property {string} metadata.localTmpFilepath
     * @property {Array<Error>} [errors]
     */
}

module.exports = StorageTempLocal;
