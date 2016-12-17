const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const {
    Exiftool,
    FileHash,
    FileSize,
    MultipartError,
    StorageTempLocal,
    MultipartParser,
    Property,
    Zip,
    Merge,
    StorageLocal,
    JsonStream,
} = require('..');
// replace with require('stream-multipart-upload')

const server = http.createServer((req, res) => {
    const multipart = req.pipe(new MultipartParser({ headers: req.headers }));
    const zip = new Zip();
    const uploadsDir = '/var/www/uploads';

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
    multipart.pipe(new Property('metadata')).pipe(zip);
    multipart.pipe(new FileSize()).pipe(zip);
    multipart.pipe(new FileHash({ encoding: 'bs58' })).pipe(zip);
    multipart.pipe(new StorageTempLocal()).pipe(zip);
    multipart.pipe(new Exiftool()).pipe(zip);

    zip
        .pipe(new Merge())
        .pipe(new StorageLocal({ dir: uploadsDir }))
        .pipe(new JsonStream())
        .pipe(res);
});

server.once('listening', () => {
    const form = new FormData();
    let response = '';
    form.append('file', fs.createReadStream(path.join(__dirname, 'files/img_1771.jpg')));
    form.append('file', fs.createReadStream(path.join(__dirname, 'files/withIptcExifGps.jpg')));

    form.submit({ hostname: 'localhost', port: server.address().port }, (err, res) => {
        res.on('data', (data) => {
            response += data.toString();
        });
        res.on('end', () => {
            console.log(JSON.parse(response));
            server.close();
        });
    });
});

server.once('close', () => {
    Exiftool.end();
});

server.listen(0);

/*
Example output:
[
    {
        fieldname: 'file',
        filename: 'img_1771.jpg',
        encoding: 'binary',
        mimetype: 'image/jpeg',
        size: 32764,
        sha1: '2nzCcEDVvAHT9PBgeVMu2UJJgeGF',
        create: '2003.12.14 12:01:44',
        modify: '2003.12.14 12:01:44',
        width: 480,
        height: 360,
        orientation: 1,
        camera: {
            model: 'Canon PowerShot S40',
            aperture: 'f/4.9',
            exposureTime: '1/500s',
            focalLength: '21.3125mm',
            datetime: '2003.12.14 12:01:44',
            flashMode: 24,
            flashFired: false
        },
        storageLocalFilename: 'f2507890-c30d-11e6-b23f-e520b774e177.jpg',
        storageLocalFilepath: '/var/www/uploads/f2507890-c30d-11e6-b23f-e520b774e177.jpg'
    },
    {
        fieldname: 'file',
        filename: 'withIptcExifGps.jpg',
        encoding: 'binary',
        mimetype: 'image/jpeg',
        size: 44606,
        sha1: '42GT1NsqAggW2mzxTCRbKyzkMDwn',
        create: '2002.07.13 15:58:28',
        modify: '2002.07.19 13:28:10',
        width: 600,
        height: 400,
        orientation: 1,
        gps: { latitude: 54.9896666666667, longitude: 1.91416666666667 },
        camera: {
            model: 'FUJIFILM FinePixS1Pro',
            aperture: 'f/0.640234375',
            datetime: '2002.07.13 15:58:28',
            flashMode: 0,
            flashFired: false
        },
        storageLocalFilename: 'f2570840-c30d-11e6-b23f-e520b774e177.jpg',
        storageLocalFilepath: '/var/www/uploads/f2570840-c30d-11e6-b23f-e520b774e177.jpg'
    }
]
*/
