/* eslint-disable consistent-return */
const { Readable, Writable, Transform } = require('stream');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const uuid = require('uuid');
const async = require('async');
const { exiftool } = require('exiftool-vendored');
const { Task } = require('exiftool-vendored/dist/task');
const { ExiftoolTask } = require('../util/ExiftoolTask');
const { InvalidChunk } = require('../errors');

class TemporaryFile extends Writable {
    constructor({ filePath, breakLength }, options) {
        super(options);
        this.breakLength = breakLength;
        this.fileStream = fs.createWriteStream(filePath);
        this.fileSize = 0;
        this.finished = false;

        this.once('finish', () => {
            if (!this.finished) {
                this.fileStream.end();
            }
        });

        this.fileStream.once('finish', () => {
            this.finished = true;
        });
    }

    _write(chunk, encoding, callback) {
        if (this.fileSize < this.breakLength) {
            this.fileStream.write(chunk, callback);
            this.fileSize += chunk.length;
        } else {
            if (!this.finished) {
                this.fileStream.end();
            }
            callback();
        }
    }
}

class Exiftool extends Transform {
    /**
     * Extract file metadata using {@link http://www.sno.phy.queensu.ca/~phil/exiftool/|exiftool} and node.js
     *      {@link https://github.com/mceachen/exiftool-vendored|exiftool-vendored} wrapper.
     * @param {Object} options
     *      Exiftool options.
     * @param {string} [options.tmpDir=os.tmpdir()]
     *      Directory for temporary files.
     * @param {boolean} [options.ensureDir=true]
     *      Ensure that dir exists, create if not.
     * @param {number} [options.readLimit=524288]
     *      The EXIF data located at the beginning of the file, so there is no reason to read the file completely.
     *      `readLimit` is a limit following which the reading will be aborted and temporary file will be passed to
     *     exiftool. Default: 512Kb.
     * @param {Function} [options.ExiftoolTask={@link https://github.com/amokrushin/stream-multipart-upload/blob/master/lib/util/ExiftoolTask.js|ExiftoolTask}]
     *     Override default exiftool task. Should inherit {@link https://github.com/mceachen/exiftool-vendored/blob/master/src/task.ts|Task}
     * @extends Transform
     */
    constructor(options) {
        super({ objectMode: true, highWaterMark: 1 });

        this.options = Object.assign({
            tmpDir: os.tmpdir(),
            ensureDir: true,
            readLimit: 512 * 1024,
            ExiftoolTask,
        }, options);

        if (!(this.options.ExiftoolTask.prototype instanceof Task)) {
            throw new TypeError('ExiftoolTask should inherit Task');
        }

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

        const temporaryFile = new TemporaryFile({
            filePath: localTmpFilepath,
            breakLength: this.options.readLimit,
        });

        async.series({
            finish: cb => temporaryFile.on('finish', cb),
            metadata: (cb) => {
                exiftool.enqueueTask(this.options.ExiftoolTask.extractInfo(localTmpFilepath)).promise
                    .then(metadata => cb(null, metadata))
                    .catch(cb);
            },
            unlink: cb => fs.unlink(localTmpFilepath, cb),
        }, (err, { metadata }) => {
            if (err) {
                callback(null, { errors: [err] });
            }
            callback(null, { metadata });
        });

        chunk.file.pipe(temporaryFile);
    }

    /**
     * Shuts down exiftool child process.
     * @static
     */
    static end() {
        exiftool.end();
    }

    /**
     * @function write
     * @memberof Exiftool#
     * @param {Exiftool~InputChunk} chunk
     * @param {function} callback
     */

    /**
     * @typedef {Object} Exiftool~InputChunk
     * @property {Readable} file
     * @example
     * {
     *   file: ReadableStream
     * }
     */

    /**
     * @function read
     * @memberof Exiftool#
     * @returns {?Exiftool~OutputChunk}
     */

    /**
     * @typedef {Object} Exiftool~OutputChunk
     * @property {Object} metadata
     * @property {string} [metadata.create]
     * @property {string} [metadata.modify]
     * @property {string} [metadata.contentType]
     * @property {number} [metadata.width]
     * @property {number} [metadata.height]
     * @property {number} [metadata.orientation]
     * @property {number} [metadata.gpsLatitude]
     * @property {number} [metadata.gpsLongitude]
     * @property {number} [metadata.gpsTimestamp]
     * @property {string} [metadata.cameraModel]
     * @property {string} [metadata.cameraAperture]
     * @property {string} [metadata.cameraExposureTime]
     * @property {string} [metadata.cameraFocalLength]
     * @property {string} [metadata.cameraISO]
     * @property {string} [metadata.cameraDatetime]
     * @property {string} [metadata.cameraLensModel]
     * @property {number} [metadata.cameraFlashMode]
     * @property {boolean} [metadata.cameraFlashFired]
     * @property {Array<Error>} [errors]
     * @example
     * {
     *   create: "2015.08.01 19:10:25",
     *   modify: "2015.08.01 19:10:25",
     *   contentType: "image/jpeg",
     *   width: 1,
     *   height: 1,
     *   orientation: 6,
     *   gpsLatitude: 56.1235333333333,
     *   gpsLongitude: 38.6031527777778,
     *   gpsTimestamp: 1438445417,
     *   cameraModel: "ASUS T00J",
     *   cameraAperture: "f/2",
     *   cameraExposureTime: "1/20s",
     *   cameraFocalLength: "2.69mm",
     *   cameraISO: "ISO360",
     *   cameraDatetime: "2015.08.01 19:10:25",
     *   cameraFlashMode: 0,
     *   cameraFlashFired: false
     * }
     */
}

module.exports = Exiftool;
