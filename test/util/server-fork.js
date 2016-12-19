const TestServer = require('./TestServer');

let server;

let timerId;

process.on('message', (msg) => {
    if (msg.action === 'start') {
        server = new TestServer(msg);
        server.listen(msg.port, (err, port) => {
            process.send({
                event: 'listening',
                port,
            });
        });
        timerId = setInterval(() => {
            process.send({
                event: 'stats',
                stats: server.stats,
            });
        }, 1000);
    }
    if (msg.action === 'stop') {
        clearInterval(timerId);
        if (server) {
            server.close();
        }
        process.exit(0);
    }
});
