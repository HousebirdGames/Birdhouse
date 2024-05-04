/*
This feature is in an experimental state and may not be suitable for all use cases. Please use with caution and report any issues you encounter.


This Node.js script, starts the local server for Birdhouse.
*/

const server = require('./server');

server.start(process.argv.includes('-findPort'));