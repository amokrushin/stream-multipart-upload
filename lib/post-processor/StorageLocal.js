/* eslint-disable consistent-return */
const { Transform } = require('stream');
const fs = require('fs-extra');
const path = require('path');
const { chain, omit, pick } = require('lodash');
const uuid = require('uuid');
const { testRequiredChunkFields } = require('../util');
const { CustomError, MissingRequiredParameter } = require('../errors');
const async = require('async');
const EventEmitter = require('events');

class FsCopyError extends CustomError {}
class FsDeleteError extends CustomError {}

class ChunkHandler extends EventEmitter {
    constructor(metadata, errors, options) {
        super();
        this.options = options;
        this._state = {
            tempStorage: pick(metadata, ['localTmpFilepath']),
            metadata: omit(metadata, ['localTmpFilepath']),
            errors: chain(errors).castArray().compact().value(),
        };

        async.series([
            cb => (this._state.errors.length ? cb() : this.copyObject(cb)),
            cb => this.deleteObject(cb),
        ], this._response.bind(this));
    }

    _response() {
        process.nextTick(() => {
            const { metadata, errors } = this._state;
            if (errors.length) {
                this.emit('done', { metadata, errors });
            } else {
                this.emit('done', { metadata });
            }
        });
    }

    copyObject(callback) {
        const { localTmpFilepath } = this._state.tempStorage;
        const filename = this.getTargetFilename();
        const filepath = path.join(this.options.dir, `${filename}`);

        fs.move(localTmpFilepath, filepath, (err) => {
            if (err) {
                this._state.errors.push(new FsCopyError(err.message));
            } else {
                Object.assign(this._state.metadata, {
                    storageLocalFilename: filename,
                    storageLocalFilepath: filepath,
                });
            }
            callback();
        });
    }

    deleteObject(callback) {
        const { localTmpFilepath } = this._state.tempStorage;

        fs.remove(localTmpFilepath, (err) => {
            if (err) {
                this._state.errors.push(new FsDeleteError(err.message));
            }
            callback();
        });
    }

    getTargetFilename() {
        let filename = '';
        if (typeof this.options.filenameFn === 'function') {
            filename = this.options.filenameFn(this._state.metadata);
        } else if (this.options.filenameProperty && this._state.metadata[this.options.filenameProperty]) {
            filename = this._state.metadata[this.options.filenameProperty];
        } else {
            filename = uuid.v1();
        }
        filename += path.extname(this._state.metadata.filename).toLowerCase();
        return filename;
    }
}

class StorageLocal extends Transform {
    /**
     * Save temporary files.
     * @param {Object} options
     *      StorageLocal options.
     * @param {string} options.dir
     *      Directory for uploaded files.
     * @param {boolean} [options.ensureDir=true]
     *      Ensure that dir exists, create if not.
     * @param {string} [options.filenameProperty]
     *      A `metadata` field name to select filename from.
     * @param {function(object):string} [options.filenameFn]
     *      A function for selecting target filename, `metadata` object passed as argument.
     * @extends Transform
     */
    constructor(options) {
        super({ objectMode: true });

        if (!options || !options.dir) {
            throw new MissingRequiredParameter('Missing required key `dir` in options');
        }

        this.options = Object.assign({
            dir: '',
            ensureDir: true,
            filenameProperty: null,
            filenameFn: null,
        }, options);

        if (this.options.ensureDir !== false) {
            fs.ensureDirSync(this.options.dir);
        }

        // eslint-disable-next-line no-bitwise
        fs.accessSync(options.dir, fs.constants.R_OK | fs.constants.W_OK);
    }

    _transform({ metadata, errors = [] }, encoding, callback) {
        const missingFields = testRequiredChunkFields(metadata, [
            'filename',
            'localTmpFilepath',
        ], this.constructor.name, 'metadata');

        if (missingFields) {
            return callback(null, { metadata, errors: errors.concat(missingFields) });
        }

        new ChunkHandler(metadata, errors, this.options)
            .once('done', result => callback(null, result));
    }

    /**
     * @function write
     * @memberof StorageLocal#
     * @param {StorageLocal~InputChunk} chunk
     * @param {function} callback
     */

    /**
     * @typedef {Object} StorageLocal~InputChunk
     * @property {Object} metadata
     * @property {string} metadata.filename
     * @property {string} metadata.localTmpFilepath
     * @property {*} [metadata....]
     *      Extra metadata fields
     * @property {Error|Array<Error>} [errors]
     */

    /**
     * @function read
     * @memberof StorageLocal#
     * @returns {?StorageLocal~OutputChunk}
     */

    /**
     * @typedef {Object} StorageLocal~OutputChunk
     * @property {Object} metadata
     * @property {string} metadata.storageLocalFilename
     * @property {string} metadata.storageLocalFilepath
     * @property {*} [metadata....]
     *      Extra metadata fields
     * @property {Error|Array<Error>} [errors]
     */
}

module.exports = StorageLocal;
