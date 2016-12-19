/* eslint-disable no-console */
const test = require('tape');
const path = require('path');
const fs = require('fs-extra');
const { request, Agent } = require('http');
const async = require('async');
const _ = require('lodash');
const { fork } = require('child_process');
const oboe = require('oboe');

const keepAliveAgent = new Agent({ keepAlive: true });

const SAMPLES_DIR = path.resolve(__dirname, '../samples/exiftool');
const TMP_DIR = path.resolve(__dirname, '../../temp');
const UPLOADS_DIR = path.resolve(__dirname, '../../temp/uploads');

let serverProcess;
let port;
let size = 0;
let expectedSize = 0;
const samples = [];

test('setup', (t) => {
    serverProcess = fork(path.resolve(__dirname, '../util/server-fork.js'));
    serverProcess.on('message', (msg) => {
        if (msg.event === 'listening') {
            port = msg.port;
            t.end();
        }
    });
    serverProcess.send({
        action: 'start',
        tmpDir: TMP_DIR,
        uploadsDir: UPLOADS_DIR,
        omitPlugins: [
            'fastTransform',
            'slowTransform',
        ],
    });
});

test('collect samples', (t) => {
    fs.walk(SAMPLES_DIR)
        .on('data', (item) => {
            if (item.stats.isDirectory()) return;
            samples.push(item.path);
            expectedSize += fs.statSync(item.path).size;
        })
        .once('end', () => {
            t.pass(`${samples.length} sample images found`);
            t.pass(`total size ${(expectedSize / 1024 / 1024).toFixed(2)} Mb`);
            t.end();
        })
        .once('error', (err) => {
            throw err;
        });
});

function uploadSeries(files, callback) {
    const boundary = '96187754517167571559282392224318';
    const rq = request({
        method: 'post',
        port,
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        agent: keepAliveAgent,
    }, (res) => {
        if (res.statusCode !== 200) {
            throw new Error(`HTTP ${res.statusCode} ${res.statusMessage}\n`);
        }
        oboe(res)
            .node('!*', (item) => {
                size += item.size;
            })
            .done(callback);
    });

    async.eachSeries(files, (filePath, next) => {
        const file = fs.createReadStream(filePath);
        let needDrain = false;
        rq.write([
            `--${boundary}`,
            `Content-Disposition: form-data; name="file"; filename=${filePath}`,
            'Content-Type: image/jpeg',
            '',
        ].join('\r\n').concat('\r\n'));
        const onData = (data) => {
            needDrain = !rq.write(data);
            if (needDrain) {
                file.removeListener('data', onData);
                rq.once('drain', () => {
                    needDrain = false;
                    file.on('data', onData);
                });
            }
        };
        file.on('data', onData);
        file.once('end', () => {
            rq.write('\r\n');
            if (needDrain) {
                rq.once('drain', () => {
                    next();
                });
            } else {
                next();
            }
        });
    }, () => {
        rq.write(`--${boundary}--\r\n`);
        rq.end();
    });
}

test('upload files', (t) => {
    const LIMIT = Infinity;
    const FILES_PER_REQUEST = LIMIT;
    const CONCURRENCY = 1;
    const OFFSET = 0;
    const slice = samples.slice(OFFSET, OFFSET + Math.min(LIMIT, samples.length - OFFSET));
    const chunks = _.chunk(slice, FILES_PER_REQUEST);

    const timeStart = Date.now();

    async.eachLimit(chunks, CONCURRENCY, uploadSeries, () => {
        t.equal(size, expectedSize, 'total size match');
        t.pass(`done in ${Date.now() - timeStart} ms`);

        serverProcess.removeAllListeners('message');
        t.end();
    });
});

test('test uploaded files', (t) => {
    let uploadsSize = 0;
    let counter = 0;
    fs.walk(UPLOADS_DIR)
        .on('data', (item) => {
            if (item.stats.isDirectory()) return;
            uploadsSize += fs.statSync(item.path).size;
            counter++;
        })
        .once('end', () => {
            t.equal(counter, samples.length, 'uploaded files count size match');
            t.equal(uploadsSize, expectedSize, 'total size match');
            t.end();
        })
        .once('error', (err) => {
            throw err;
        });
});

test('cleanup', (t) => {
    async.series([
        cb => fs.remove(UPLOADS_DIR, cb),
        cb => fs.remove(TMP_DIR, cb),
    ], (err) => {
        if (err) throw err;
        t.pass('done');
        t.end();
    });
});

test('teardown', (t) => {
    keepAliveAgent.destroy();
    serverProcess.send({
        action: 'stop',
    });
    process.nextTick(() => {
        t.pass('done');
        t.end();
    });
});
