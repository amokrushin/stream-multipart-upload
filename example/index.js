const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const aws = require('aws-sdk');
const {
    Multipart,
    MultipartError,
    Pick,
    FileSize,
    FileHash,
    StorageTempLocal,
    StorageTempS3,
    Exiftool,
    Zip,
    Merge,
    StorageLocal,
    StorageS3,
    StringifyError,
    JsonStream,
} = require('..');
// replace with require('stream-multipart-upload')

aws.config.credentials = new aws.SharedIniFileCredentials({ profile: 'test-stream-multipart-upload' });

const server = http.createServer((req, res) => {
    const multipart = req.pipe(new Multipart({ headers: req.headers }));
    const zip = new Zip();
    const FS_UPLOADS_DIR = '/var/www/uploads';
    const S3_BUCKET = 'test-stream-multipart-upload';
    const S3_UPLOADS_PATH = 'uploads';
    const S3_TEMP_PATH = 'temp';

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
    multipart.pipe(new Pick('metadata')).pipe(zip);
    multipart.pipe(new FileSize()).pipe(zip);
    multipart.pipe(new FileHash({ encoding: 'bs58' })).pipe(zip);
    multipart.pipe(new StorageTempLocal()).pipe(zip);
    multipart.pipe(new StorageTempS3({ bucket: S3_BUCKET, path: S3_TEMP_PATH })).pipe(zip);
    multipart.pipe(new Exiftool()).pipe(zip);

    zip
        .pipe(new Merge())
        .pipe(new StorageLocal({ dir: FS_UPLOADS_DIR }))
        .pipe(new StorageS3({ bucket: S3_BUCKET, path: S3_UPLOADS_PATH, saveMetadata: true }))
        .pipe(new StringifyError())
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
            // eslint-disable-next-line no-console
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
        metadata: {
            fieldname: 'file',
            encoding: 'binary',
            contentType: 'image/jpeg',
            filename: 'img_1771.jpg',
            size: 32764,
            sha1: '2nzCcEDVvAHT9PBgeVMu2UJJgeGF',
            create: '2003.12.14 12:01:44',
            modify: '2003.12.14 12:01:44',
            width: 480,
            height: 360,
            orientation: 1,
            cameraModel: 'Canon PowerShot S40',
            cameraAperture: 'f/4.9',
            cameraExposureTime: '1/500s',
            cameraFocalLength: '21.3125mm',
            cameraDatetime: '2003.12.14 12:01:44',
            cameraFlashMode: 24,
            cameraFlashFired: false,
            storageLocalFilename: 'd778e9c0-cbba-11e6-8a9c-1dfcd06b3d4a.jpg',
            storageLocalFilepath: '/var/www/uploads/d778e9c0-cbba-11e6-8a9c-1dfcd06b3d4a.jpg',
            s3Bucket: 'test-stream-multipart-upload',
            s3Key: 'uploads/d7803cc0-cbba-11e6-8a9c-1dfcd06b3d4a.jpg'
        }
    },
    {
        metadata: {
            fieldname: 'file',
            encoding: 'binary',
            contentType: 'image/jpeg',
            filename: 'withIptcExifGps.jpg',
            size: 44606,
            sha1: '42GT1NsqAggW2mzxTCRbKyzkMDwn',
            create: '2002.07.13 15:58:28',
            modify: '2002.07.19 13:28:10',
            width: 600,
            height: 400,
            orientation: 1,
            gpsLatitude: 54.9896666666667,
            gpsLongitude: 1.91416666666667,
            cameraModel: 'FUJIFILM FinePixS1Pro',
            cameraAperture: 'f/0.64',
            cameraDatetime: '2002.07.13 15:58:28',
            cameraFlashMode: 0,
            cameraFlashFired: false,
            storageLocalFilename: 'd7e39270-cbba-11e6-8a9c-1dfcd06b3d4a.jpg',
            storageLocalFilepath: '/var/www/uploads/d7e39270-cbba-11e6-8a9c-1dfcd06b3d4a.jpg',
            s3Bucket: 'test-stream-multipart-upload',
            s3Key: 'uploads/d7e3e090-cbba-11e6-8a9c-1dfcd06b3d4a.jpg'
        }
    }
]

*/
