/* eslint-disable consistent-return */
const { Readable, Writable, Transform } = require('stream');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const uuid = require('uuid');
const async = require('async');
const { exiftool } = require('exiftool-vendored');
const { Task } = require('exiftool-vendored/lib/task');
const { ExiftoolTask } = require('../util/ExiftoolTask');

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
    constructor(options, streamOptions) {
        super(Object.assign({}, streamOptions, { objectMode: true, highWaterMark: 1 }));

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
            return callback(new TypeError('Invalid chunk format'));
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
                callback(null, { error: err });
            }
            callback(null, metadata);
        });

        chunk.file.pipe(temporaryFile);
    }

    static end() {
        exiftool.end();
    }
}

module.exports = Exiftool;
