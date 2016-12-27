const test = require('tape');
const http = require('http');
const async = require('async');
const _ = require('lodash');
const FormData = require('form-data');
const Request = require('../../lib/util/Request');
const {
    Exiftool,
    FileHash,
    FileSize,
    MultipartError,
    // StorageTempLocal,
    Multipart,
    Pick,
    Zip,
    Merge,
    // StorageLocal,
    StringifyError,
    JsonStream,
} = require('../..');

const samples = require('../fixtures/base64.json').map(s => new Buffer(s, 'base64'));

let server;

test('setup', (t) => {
    server = http.createServer((req, res) => {
        const tmpDir = `${process.cwd()}/temp`;
        const multipart = req.pipe(new Multipart({ headers: req.headers }));
        const zip = new Zip();

        multipart.once('data', () => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
        });

        multipart.pipe(new MultipartError()).pipe(zip);
        multipart.pipe(new Exiftool({ tmpDir })).pipe(zip);
        multipart.pipe(new FileSize()).pipe(zip);
        multipart.pipe(new FileHash({ encoding: 'bs58' })).pipe(zip);
        multipart.pipe(new Pick('metadata')).pipe(zip);

        zip
            .pipe(new Merge())
            .pipe(new StringifyError())
            .pipe(new JsonStream())
            .pipe(res);
    });

    server.once('listening', () => t.end());
    server.listen(0);
});

function getForm(seriesLength) {
    const form = new FormData();
    for (let i = 0; i < seriesLength; i++) {
        form.append('file', _.sample(samples));
    }
    return form;
}

test('upload files, 15 parallel requests of 8 files each', (t) => {
    const TIMES = 15;
    const SERIES_LENGTH = 4;
    const CONCURRENCY = TIMES;
    let counter = 0;

    async.timesLimit(TIMES, CONCURRENCY, (n, cb) => {
        const form = getForm(SERIES_LENGTH);
        const request = new Request({ method: 'post', port: server.address().port, headers: form.getHeaders() });
        form.pipe(request);

        request.on('data', (chunk) => {
            const str = chunk.toString();
            if (str[0] !== '[' && str[0] !== ',') return;
            if (!chunk.toString().includes('image/')) {
                t.fail(`response chunk not includes 'image/': ${JSON.stringify(str)}`);
            }
            counter++;
        });
        request.on('end', cb);
    }, () => {
        t.equal(counter, TIMES * SERIES_LENGTH, 'counter match');
        t.end();
    });
});

test('teardown', (t) => {
    server.close(t.end);
    Exiftool.end();
});
