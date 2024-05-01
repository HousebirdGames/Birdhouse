/*
Please note, that the local development server is not intended for production use and is only suitable for local development.
It is currently in an experimental state and may not be suitable for all use cases. Please use with caution and report any issues you encounter.


This Node.js script, serve.js, serves as a local development server by hosting static files and dynamically applying
HTTP headers based on a .htaccess-like configuration. It is designed to simulate an Apache server environment, ensuring
consistency between development and production setups.


The script uses the Express framework to serve content from the 'dist' directory and handle fallbacks to 'index.html'
for SPA (Single Page Application) routing. It dynamically loads and applies HTTP headers from an .htaccess file located
in the 'dist' directory to mirror Apache's .htaccess behavior.


While it can operate independently for basic serving needs, it is intended to be used in conjunction with a watcher script,
such as serve.js, which handles file watching, build pipeline execution, and server restarts.


Please note, this script does not replace a full Apache server and is intended for local development use only.
*/

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const htaccessPath = path.join(__dirname, 'dist/.htaccess');

let htaccessMiddleware = (req, res, next) => next();

const loadHtaccess = () => {
    fs.readFile(htaccessPath, 'utf8', (err, data) => {
        if (err) {
            console.error('Failed to read .htaccess file:', err);
            return;
        }
        htaccessMiddleware = (req, res, next) => next();

        const lines = data.split('\n');
        const newMiddleware = (req, res, next) => {
            lines.forEach(line => {
                if (line.startsWith('Header set ')) {
                    const parts = line.match(/^Header set (\S+) "(.*)"$/);
                    if (parts) {
                        res.setHeader(parts[1], parts[2]);
                    }
                }
            });
            next();
        };

        htaccessMiddleware = newMiddleware;
    });
};

app.use((req, res, next) => htaccessMiddleware(req, res, next));

app.use(express.static('dist'));

app.get('/*', (req, res) => {
    res.sendFile('index.html', { root: 'dist' });
});

loadHtaccess();

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});