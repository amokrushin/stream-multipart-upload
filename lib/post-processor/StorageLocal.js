/* eslint-disable consistent-return */
const { Transform } = require('stream');
const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const uuid = require('uuid');

function done({ error, metadata, callback }) {
    const _metadata = _.omit(metadata, ['localTmpFilepath']);
    if (error && metadata.error) {
        return callback(null, Object.assign({}, _metadata, {
            error: _.castArray(metadata.error).concat(error),
        }));
    } else if (error || metadata.error) {
        return callback(null, Object.assign({}, _metadata, {
            error: error || metadata.error,
        }));
    }
    callback(null, _metadata);
}

class StorageTempLocal extends Transform {
    constructor(options, streamOptions) {
        super(Object.assign({}, streamOptions, { objectMode: true }));

        if (!options || !options.dir) {
            throw new Error('options.dir is not defined');
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

    _transform(metadata, encoding, callback) {
        if (metadata.error) {
            fs.remove(metadata.localTmpFilepath, (error) => {
                done({ error, metadata, callback });
            });
        } else {
            let filename = '';
            if (_.isFunction(this.options.filenameFn)) {
                filename = this.options.filenameFn(metadata);
            } else if (this.options.filenameProperty && metadata[this.options.filenameProperty]) {
                filename = metadata[this.options.filenameProperty];
            } else {
                filename = uuid.v1();
            }
            filename += path.extname(metadata.filename);

            const filepath = path.join(this.options.dir, `${filename}`);

            fs.move(metadata.localTmpFilepath, filepath, (error) => {
                if (error) return done({ error, metadata, callback });
                done({
                    metadata: Object.assign({}, metadata,
                        {
                            storageLocalFilename: filename,
                            storageLocalFilepath: filepath,
                        }),
                    callback,
                });
            });
        }
    }
}

module.exports = StorageTempLocal;
