/* eslint-disable consistent-return */
const { Transform } = require('stream');
const { chain, defaultsDeep, omit, pick, kebabCase } = require('lodash');
const uuid = require('uuid');
const path = require('path');
const async = require('async');
const EventEmitter = require('events');
const aws = require('aws-sdk');
const { CustomError, MissingRequiredParameter } = require('../errors');
const { testRequiredChunkFields } = require('../util');

class S3CopyError extends CustomError {}
class S3DeleteError extends CustomError {}

class ChunkHandler extends EventEmitter {
    constructor(metadata, errors, s3, options) {
        super();
        this.options = options;
        this.s3 = s3;
        this._state = {
            tempStorage: pick(metadata, ['s3TempBucket', 's3TempKey']),
            metadata: this.options.skipDeleteTemp
                ? Object.assign({}, metadata)
                : omit(metadata, ['s3TempBucket', 's3TempKey']),
            errors: chain(errors || []).castArray().compact().value(),
        };

        async.series([
            /* eslint-disable no-confusing-arrow */
            cb => this._state.errors.length ? cb() : this.copyObject(cb),
            cb => this.options.skipDeleteTemp ? cb() : this.deleteObject(cb),
            /* eslint-enable no-confusing-arrow */
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
        const { s3TempBucket, s3TempKey } = this._state.tempStorage;
        const filename = this.getTargetFilename();
        const key = this.options.path ? `${path.posix.join(this.options.path, filename)}` : filename;

        this.s3.copyObject(Object.assign(
            {
                CopySource: `${s3TempBucket}/${s3TempKey}`,
                Bucket: this.options.bucket,
                Key: key,
                ContentType: this._state.metadata.contentType,
                Metadata: this.options.saveMetadata
                    ? chain(this._state.metadata).mapKeys((v, p) => kebabCase(p)).mapValues(String).value()
                    : undefined,
                MetadataDirective: 'REPLACE',
                StorageClass: this.options.storageClass || 'STANDARD',
            }
        ), (err) => {
            if (err) {
                this._state.errors.push(new S3CopyError(err.message));
            } else {
                Object.assign(this._state.metadata, {
                    s3Bucket: this.options.bucket,
                    s3Key: key,
                });
            }
            callback();
        });
    }

    deleteObject(callback) {
        const { s3TempBucket, s3TempKey } = this._state.tempStorage;
        this.s3.deleteObject({
            Bucket: s3TempBucket,
            Key: s3TempKey,
        }, (err) => {
            if (err) {
                this._state.errors.push(new S3DeleteError(err.message));
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
        filename += path.extname(this._state.metadata.filename);
        return filename;
    }
}

class StorageS3 extends Transform {
    /**
     * Moves a file from the temporary storage to the permanent one
     * @param {Object} options
     *      StorageS3 options
     * @param {string} options.bucket
     *      Bucket for uploaded files
     * @param {string} [options.path='']
     *      Path (key name prefix), will be joined with filename with a `/` delimiter
     * @param {boolean} [options.saveMetadata=false]
     *      Store the metadata with the object in S3. Metadata keys will be converted to `kebab-case`.
     *      See {@link http://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#object-metadata}
     * @param {Object} [options.s3]
     *      S3 instance options
     *      See {@link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property}
     * @param {string} [options.s3.apiVersion='2006-03-01']
     *      Default AWS S3 API version
     * @param {string} [options.filenameProperty]
     *      A `metadata` field name to select filename from.
     * @param {function(object):string} [options.filenameFn]
     *      A function for selecting target filename, `metadata` object passed as argument.
     * @param {Object} [options.client=new S3(options.s3)]
     *      Override default S3 client instance
     * @param {boolean} [options.skipDeleteTemp=false]
     *      Do not automatically delete temp files
     * @extends Transform
     */
    constructor(options) {
        super({ objectMode: true });

        if (!options || !options.bucket) {
            throw new MissingRequiredParameter('Missing required key `bucket` in options');
        }

        this.options = defaultsDeep({}, options, {
            s3: { apiVersion: '2006-03-01' },
            path: '',
            saveMetadata: false,
            skipDeleteTemp: false,
        });

        this.s3 = this.options.client || new aws.S3(this.options.s3);
    }

    _transform({ metadata, errors = [] }, encoding, callback) {
        const missingFields = testRequiredChunkFields(metadata, [
            'filename',
            'contentType',
            's3TempBucket',
            's3TempKey',
        ], this.constructor.name, 'metadata');

        if (missingFields) {
            return callback(null, { metadata, errors: errors.concat(missingFields) });
        }

        new ChunkHandler(metadata, errors, this.s3, this.options)
            .once('done', result => callback(null, result));
    }

    /**
     * @function write
     * @memberof StorageS3#
     * @param {StorageS3~InputChunk} chunk
     * @param {function} callback
     */

    /**
     * @typedef {Object} StorageS3~InputChunk
     * @property {Object} metadata
     * @property {string} metadata.filename
     * @property {string} metadata.contentType
     * @property {string} metadata.s3TempBucket
     * @property {string} metadata.s3TempKey
     * @property {*} [metadata....]
     *      Extra metadata fields
     * @property {Error|Array<Error>} [errors]
     */

    /**
     * @function read
     * @memberof StorageS3#
     * @returns {?StorageS3~OutputChunk}
     */

    /**
     * @typedef {Object} StorageS3~OutputChunk
     * @property {Object} metadata
     * @property {string} metadata.filename
     * @property {string} metadata.contentType
     * @property {string} metadata.s3Bucket
     * @property {string} metadata.s3Key
     * @property {*} [metadata....]
     *      Extra metadata fields
     * @property {Error|Array<Error>} [errors]
     */
}

module.exports = StorageS3;
