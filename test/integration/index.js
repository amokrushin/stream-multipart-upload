const test = require('tape');
const http = require('http');
const fs = require('fs');
const path = require('path');
const oboe = require('oboe');
const FormData = require('form-data');
const Request = require('../../lib/util/Request');
const _ = require('lodash');

const {
    // eslint-disable-next-line no-unused-vars
    debugFlow,
    randomBoundary,
    dummyMultipartFile,
} = require('../util');
const {
    Exiftool,
    FileHash,
    FileSize,
    MultipartError,
    // StorageTempLocal,
    Multipart,
    Property,
    Zip,
    Merge,
    // StorageLocal,
    JsonStream,
} = require('../..');

const testData = require('../fixtures/test-data.json');
// const testData = require('../fixtures/test-data-fail.json');

function getTestData() {
    return testData
        .filter(obj => !/^dummy/.test(obj.filename))
        .map(obj => ({
            file: fs.createReadStream(path.resolve(__dirname, '../samples', obj.filename)),
            metadata: { filename: obj.filename, mimetype: obj.mimetype },
            expected: obj,
        }));
}

let server;

test('setup', (t) => {
    server = http.createServer((req, res) => {
        const multipart = new Multipart({ headers: req.headers });
        const zip = new Zip();

        multipart.once('data', () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
        });

        multipart.once('error', (err) => {
            if (!res.headersSent) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });

        multipart.pipe(new MultipartError()).pipe(zip);
        multipart.pipe(new FileSize()).pipe(zip);
        multipart.pipe(new Property('metadata')).pipe(zip);
        multipart.pipe(new FileHash({ encoding: 'bs58' })).pipe(zip);
        multipart.pipe(new Exiftool()).pipe(zip);

        zip
            .pipe(new Merge())
            .pipe(new JsonStream())
            .pipe(res);

        req.pipe(multipart);

        /*
        const debug1 = debugFlow(req);
        const debug2 = debugFlow(zip);
        setTimeout(() => {
            debug1.print();
            debug2.print();
        }, 1000);
        */
    });

    server.once('listening', () => t.end());
    server.listen(0);
});

test('example', (t) => {
    const form = new FormData();
    const rq = new Request({
        method: 'post',
        port: server.address().port,
        headers: form.getHeaders(),
    });

    let counter = 0;
    const td = getTestData();
    td.forEach(obj => form.append('file', obj.file));
    form.pipe(rq);

    form
        .once('end', () => {
            t.pass('form end emitted'); // 1
        });

    rq
        .once('finish', () => {
            t.pass('request finish emitted'); // 2
        })
        .once('end', () => {
            t.pass('request end emitted'); // 3
        });

    oboe(rq)
        .node('!*', (item) => {
            t.deepEqual(
                _.omit(item, ['fieldname', 'encoding', 'charset']),
                td[counter].expected,
                `${item.filename} metadata match`
            );
            counter++;
        })
        .done(() => {
            t.pass('json parser end emitted'); // 4
        });

    t.plan(4 + td.length);
});

test('should test broken boundary #1', (t) => {
    const form = new FormData();
    form._lastBoundary = () => `--invalid--${FormData.LINE_BREAK}`;
    form.append('file', new Buffer(13), {
        filename: 'file-1.raw',
        contentType: 'application/octet-stream',
        knownLength: 13,
    });
    form.append('file', new Buffer(13), {
        filename: 'file-2.raw',
        contentType: 'application/octet-stream',
        knownLength: 13,
    });
    form.append('file', new Buffer(13), {
        filename: 'file-3.raw',
        contentType: 'application/octet-stream',
        knownLength: 13,
    });

    form.submit({ hostname: 'localhost', port: server.address().port, path: '/' }, (err, res) => {
        let itemsCounter = 0;
        oboe(res)
            .node('!*', (item) => {
                itemsCounter++;
                if (itemsCounter === 3) {
                    t.ok(item.error, 'last item should have an error field');
                    t.equal(item.error, 'Part terminated early due to unexpected end of multipart data',
                        'error message match');
                } else if (item.error) {
                    t.fail('unexpected error');
                }
            })
            .done(() => {
                t.equal(itemsCounter, 3, 'response should has total 3 items');
                process.nextTick(() => t.end());
            });
    });
});

test('should test broken boundary #2', (t) => {
    const boundary = randomBoundary();
    const port = server.address().port;
    let itemsCounter = 0;

    const rq = new Request({
        method: 'post',
        port,
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    });

    oboe(rq)
        .node('!*', (item) => {
            itemsCounter++;
            if (itemsCounter === 2) {
                t.ok(item.error, 'last item should have an error field');
                t.equal(item.error, 'Part terminated early due to unexpected end of multipart data',
                    'error message match');
            } else if (item.error) {
                t.fail('unexpected error');
            }
        })
        .done(() => {
            t.equal(itemsCounter, 2, 'response should has total 2 items');
            process.nextTick(() => t.end());
        });

    rq.write(dummyMultipartFile(boundary, 1024));
    rq.write(dummyMultipartFile(boundary, 1024));
    rq.end();
});

test('teardown', (t) => {
    server.close(t.end);
    Exiftool.end();
});
