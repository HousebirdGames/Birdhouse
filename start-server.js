const server = require('./server');

server.start(process.argv.includes('-findPort'));