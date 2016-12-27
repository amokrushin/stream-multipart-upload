/* eslint-disable consistent-return */
const { Readable, Transform } = require('stream');
const uuid = require('uuid');
const _ = require('lodash');
const aws = require('aws-sdk');
const { CustomError, MissingRequiredParameter, InvalidChunk } = require('../errors');
const { PassThrough } = require('stream');

class S3UploadError extends CustomError {}

class StorageTempS3 extends Transform {
    /**
     * Saves a file to the temporary storage
     * @param {Object} options
     *      StorageTempS3 options
     * @param {string} options.bucket
     *      Bucket for temporary files
     * @param {string} [options.path='']
     *      Path (key name prefix), will be joined with filename with a `/` delimiter
     * @param {Object} [options.s3]
     *      S3 instance options
     *      See {@link http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property}
     * @param {string} [options.s3.apiVersion='2006-03-01']
     *      Default AWS S3 API version
     * @param {Object} [options.client=new S3(options.s3)]
     *      Override default S3 client instance
     * @extends Transform
     */
    constructor(options) {
        super({ objectMode: true, highWaterMark: 1 });

        if (!options || !options.bucket) {
            throw new MissingRequiredParameter('Missing required key `bucket` in options');
        }

        this.options = _.defaultsDeep({}, options, {
            s3: { apiVersion: '2006-03-01' },
            path: '',
        });

        this.s3 = this.options.client || new aws.S3(this.options.s3);
    }

    _transform(chunk, encoding, callback) {
        if (typeof chunk !== 'object' || !(chunk.file instanceof Readable)) {
            return callback(null, {
                errors: [new InvalidChunk('Invalid chunk format: `file` is not a readable stream')],
            });
        }

        const buffer = new PassThrough();

        chunk.file.pipe(buffer);

        const params = {
            Bucket: this.options.bucket,
            Key: uuid.v1(),
            Body: buffer,
        };

        this.s3.upload(params, (err, res) => {
            if (err) {
                callback(null, { errors: [new S3UploadError(err.message)] });
            } else {
                callback(null, {
                    metadata: {
                        s3TempBucket: res.Bucket,
                        s3TempKey: res.Key,
                    },
                });
            }
        });
    }

    /**
     * @typedef {Object} StorageTempS3~InputChunk
     * @property {Readable} file
     */

    /**
     * @typedef {Object} StorageTempS3~OutputChunk
     * @property {Object} metadata
     * @property {string} metadata.s3TempBucket
     * @property {string} metadata.s3TempKey
     * @property {Array<Error>} [errors]
     */

    /**
     * @function write
     * @memberof StorageTempS3#
     * @param {StorageTempS3~InputChunk} chunk
     * @param {function} callback
     */

    /**
     * @function read
     * @memberof StorageTempS3#
     * @returns {?StorageTempS3~OutputChunk}
     */
}

module.exports = StorageTempS3;
