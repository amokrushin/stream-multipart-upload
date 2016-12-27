const { createServer } = require('http');
const Multipart = require('stream-multipart');
const Zip = require('stream-zip');
const { Transform, PassThrough } = require('stream');
const {
    Merge,
    StorageLocal,
} = require('../../lib/post-processor');
const {
    Exiftool,
    FileHash,
    FileSize,
    MultipartError,
    StorageTempLocal,
} = require('../../lib/pre-processor');
const {
    Pick,
    StringifyError,
    JsonStream,
} = require('../../lib/transform');

const { debug, debugId } = require('../../lib/util/debug')('streammultipart', 'SMU');
const { version } = require('../../package.json');

debug('yellow', 'VERSION', `${version}`);

class TestServer {
    constructor({ tmpDir, uploadsDir, pickPlugins, omitPlugins }) {
        this.stats = {
            requests: {
                total: 0,
                finished: 0,
                unfinished: 0,
            },
            files: {
                total: 0,
                finished: 0,
                unfinished: 0,
            },
            size: 0,
        };

        this.server = createServer((req, res) => {
            const multipart = new Multipart({ headers: req.headers });
            const zip = new Zip();
            const merge = new Merge();
            const fastTransform = new Transform({
                objectMode: true,
                highWaterMark: 1,
                transform(chunk, encoding, callback) {
                    const id = debugId('fast-transform');
                    debug('red', 'FAST TRANSFORM CHUNK', id);
                    chunk.file.on('data', () => {});
                    chunk.file.once('end', () => {
                        debug('red', 'FAST TRANSFORM CHUNK END', id, this.push({}));
                        callback();
                    });
                },
            });
            const slowTransform = new Transform({
                objectMode: true,
                highWaterMark: 1,
                transform(chunk, encoding, callback) {
                    const id = debugId('slow-transform');
                    debug('red', 'SLOW TRANSFORM CHUNK', id);
                    const ps = new PassThrough();
                    chunk.file.pipe(ps);
                    setTimeout(() => {
                        ps.resume();
                    }, 200);
                    ps.once('end', () => {
                        debug('red', 'SLOW TRANSFORM CHUNK END', id, this.push({}));
                        callback();
                    });
                },
            });

            merge.once('data', () => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
            });

            multipart.once('error', (err) => {
                if (!res.headersSent) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });

            let includeStorageLocal = true;

            if (Array.isArray(pickPlugins)) {
                pickPlugins.includes('multipartError') && multipart.pipe(new MultipartError()).pipe(zip);
                pickPlugins.includes('fileSize') && multipart.pipe(new FileSize()).pipe(zip);
                pickPlugins.includes('pickMetadata') && multipart.pipe(new Pick('metadata')).pipe(zip);
                pickPlugins.includes('fileHash') && multipart.pipe(new FileHash({ encoding: 'bs58' })).pipe(zip);
                pickPlugins.includes('storageTempLocal') && multipart.pipe(new StorageTempLocal({ tmpDir })).pipe(zip);
                pickPlugins.includes('exiftool') && multipart.pipe(new Exiftool({ tmpDir })).pipe(zip);
                pickPlugins.includes('fastTransform') && multipart.pipe(fastTransform).pipe(zip);
                pickPlugins.includes('slowTransform') && multipart.pipe(slowTransform).pipe(zip);
                includeStorageLocal = pickPlugins.includes('storageLocal');
            } else if (Array.isArray(omitPlugins)) {
                !omitPlugins.includes('multipartError') && multipart.pipe(new MultipartError()).pipe(zip);
                !omitPlugins.includes('fileSize') && multipart.pipe(new FileSize()).pipe(zip);
                !omitPlugins.includes('pickMetadata') && multipart.pipe(new Pick('metadata')).pipe(zip);
                !omitPlugins.includes('fileHash') && multipart.pipe(new FileHash({ encoding: 'bs58' })).pipe(zip);
                !omitPlugins.includes('storageTempLocal') && multipart.pipe(new StorageTempLocal({ tmpDir })).pipe(zip);
                !omitPlugins.includes('exiftool') && multipart.pipe(new Exiftool({ tmpDir })).pipe(zip);
                !omitPlugins.includes('fastTransform') && multipart.pipe(fastTransform).pipe(zip);
                !omitPlugins.includes('slowTransform') && multipart.pipe(slowTransform).pipe(zip);
                includeStorageLocal = !omitPlugins.includes('storageLocal');
            } else {
                multipart.pipe(new MultipartError()).pipe(zip);
                multipart.pipe(new FileSize()).pipe(zip);
                multipart.pipe(new Pick('metadata')).pipe(zip);
                multipart.pipe(new FileHash({ encoding: 'bs58' })).pipe(zip);
                multipart.pipe(new StorageTempLocal({ tmpDir })).pipe(zip);
                multipart.pipe(new Exiftool({ tmpDir })).pipe(zip);
                multipart.pipe(slowTransform).pipe(zip);
            }

            if (includeStorageLocal) {
                zip
                    .pipe(merge)
                    .pipe(new StorageLocal({ dir: uploadsDir }))
                    .pipe(new StringifyError())
                    .pipe(new JsonStream())
                    .pipe(res);
            } else {
                zip
                    .pipe(merge)
                    .pipe(new StringifyError())
                    .pipe(new JsonStream())
                    .pipe(res);
            }

            req.pipe(multipart);

            this.stats.requests.total++;
            this.stats.requests.unfinished++;
            merge.on('data', ({ metadata, errors }) => {
                debug('green', 'MERGE CHUNK', { metadata, errors });
                this.stats.size += metadata.size;
            });
            res.once('finish', () => {
                debug('yellow', 'REQ FINISH');
                this.stats.requests.finished++;
                this.stats.requests.unfinished--;
            });
            req.once('end', () => {
                debug('yellow', 'REQ END');
            });
            multipart.once('finish', () => {
                debug('yellow', 'MULTIPART FINISH');
            });
            multipart.once('end', () => {
                debug('yellow', 'MULTIPART END');
            });
            multipart.on('data', (chunk) => {
                const id = debugId('multipart-chunk');
                debug('green', 'MULTIPART CHUNK START', id);
                this.stats.files.total++;
                this.stats.files.unfinished++;
                chunk.file.resume();
                chunk.file.once('end', () => {
                    debug('green', 'MULTIPART CHUNK END', id);
                    this.stats.files.finished++;
                    this.stats.files.unfinished--;
                });
            });
        });
    }

    listen(port = 0, callback) {
        this.server.listen(port);
        this.server.once('listening', () => {
            callback(null, this.server.address().port);
        });
    }

    close(callback) {
        Exiftool.end();
        this.server.close(callback);
    }
}

module.exports = TestServer;
