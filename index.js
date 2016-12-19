/* eslint-disable global-require */
module.exports = Object.assign(
    require('./lib/pre-processor'),
    require('./lib/transform'),
    require('./lib/post-processor'),
    {
        Multipart: require('stream-multipart'),
        Zip: require('stream-zip'),
        TestServer: require('./test/util/TestServer'),
    }
);
