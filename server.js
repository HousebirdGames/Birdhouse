/*
This feature is in an experimental state and may not be suitable for all use cases. Please use with caution and report any issues you encounter.


This Node.js script, server.js, serves as a local development server by hosting static files and dynamically applying
HTTP headers based on a .htaccess-like configuration. It is designed to simulate an Apache server environment, ensuring
consistency between development and production setups.


The script uses the Express framework to serve content from the 'dist' directory and handle fallbacks to 'index.html'
for SPA (Single Page Application) routing. It dynamically loads and applies HTTP headers from an .htaccess file located
in the 'dist' directory to mirror Apache's .htaccess behavior.


While it can operate independently for basic serving needs, it is intended to be used in conjunction with a watcher script,
such as serve.js, which handles file watching, build pipeline execution, and server restarts.


To specify the port the server should run on, you can pass it as an argument, e.g., `node server 3000`.


Please note, this script does not replace a full Apache server and is intended for local development use only, not for production use.
*/

const express = require('express');
const fs = require('fs');
const path = require('path');
const portscanner = require('portscanner');

const app = express();
let port = process.env.PORT || parseInt(process.argv[2]) || 4200;
const htaccessPath = path.join(__dirname, 'dist/.htaccess');

const loadHtaccess = async () => {
    const data = await fs.promises.readFile(htaccessPath, 'utf8').catch(err => {
        console.error('Failed to read .htaccess file:', err);
        return '';
    });

    const lines = data.split('\n');

    return (req, res, next) => {
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
};

let htaccessMiddleware = (req, res, next) => next();

loadHtaccess().then(middleware => {
    htaccessMiddleware = middleware;
});

app.use((req, res, next) => htaccessMiddleware(req, res, next));

app.use(express.static(path.join(__dirname, 'dist')));

app.get('/*', (req, res) => {
    res.sendFile('index.html', { root: path.join(__dirname, 'dist') });
});

loadHtaccess();

const BLOCKED_PORTS_INFO = {
    1: "TCP Port Service Multiplexer (TCPMUX)",
    7: "ECHO",
    9: "DISCARD",
    11: "Active Users (systat service)",
    13: "DAYTIME",
    15: "Netstat service",
    17: "Quote of the Day (QOTD)",
    19: "CHARGEN",
    20: "FTP Data",
    21: "FTP Control",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    37: "TIME",
    42: "Host Name Server (Nameserv)",
    53: "DNS",
    69: "TFTP",
    79: "Finger",
    80: "HTTP",
    87: "TCP any private terminal link",
    95: "SUPDUP",
    101: "HOSTNAME",
    102: "ISO-TSAP",
    103: "Genesis Point-to-Point Trans Net",
    104: "ACR-NEMA Digital Imag. & Comm. 300",
    109: "POP2",
    110: "POP3",
    111: "Sun RPC",
    113: "Ident",
    115: "SFTP",
    117: "UUCP Path Service",
    119: "NNTP",
    123: "NTP",
    135: "Windows RPC",
    137: "NETBIOS-NS",
    138: "NETBIOS-DGM",
    139: "NETBIOS-SSN",
    143: "IMAP",
    161: "SNMP",
    162: "SNMPTRAP",
    177: "XDMCP",
    179: "BGP",
    194: "IRC",
    389: "LDAP",
    443: "HTTPS",
    445: "Microsoft-DS",
    465: "SMTPS",
    513: "Rlogin",
    515: "LPD",
    543: "KLogin",
    544: "Kshell",
    548: "AFP (Apple Filing Protocol)",
    554: "RTSP",
    587: "SMTP over TLS/SSL",
    593: "HTTP RPC Ep Map",
    636: "LDAPS",
    666: "DOOM",
    989: "FTPS Data",
    990: "FTPS Control",
    993: "IMAPS",
    995: "POP3S",
    1433: "Microsoft SQL Server",
    2049: "NFS",
    3306: "MySQL",
    3389: "RDP",
    3659: "APPLE-SASL / DMF",
    4045: "LOCKD",
    5000: "UPnP",
    6000: "X11",
    6665: "Alternate IRC [Apple addition]",
    6666: "Alternate IRC [Apple addition]",
    6667: "Standard IRC [Apple addition]",
    6668: "Alternate IRC [Apple addition]",
    6669: "Alternate IRC [Apple addition]",
    6697: "IRC + TLS"
};

function checkPortSafety(port) {
    if (BLOCKED_PORTS_INFO[port]) {
        console.warn(`Port ${port} (${BLOCKED_PORTS_INFO[port]}) is commonly blocked by network firewalls or browsers due to security risks or known vulnerabilities associated with this port. For local development, consider using a well-known development port like 3000.`);
    }
}

let server;

checkPortSafety(port);

function start(findAlternativePort = false) {
    checkPortStatusAndStart(findAlternativePort);
}

function checkPortStatusAndStart(findAlternativePort = false) {
    portscanner.checkPortStatus(port, 'localhost', function (error, status) {
        if (status === 'open') {
            console.warn(`Port ${port} is already in use..`);

            if (findAlternativePort) {
                console.warn(`Finding an alternative port...`);
                findUnusedPort(1024, 65535).then(newPort => {
                    console.log(`Found alternative port: ${newPort}`);
                    port = newPort;
                    checkPortStatusAndStart();
                }).catch(err => {
                    console.error('No unused port found:', err);
                });
            }
            else {
                console.warn(`Shutting down.`);
                process.exit(1);
            }
        }
        else {
            server = app.listen(port, () => {
                console.log(`Server running at http://localhost:${port}/`);
            });

            // In Unix-like systems, binding to ports below 1024 typically requires root privileges. This is not the case on Windows (win32).
            if (port < 1024 && process.platform !== 'win32') {
                console.warn('You are using a port below 1024, which might require root permissions on Unix-like systems. If the server fails to start or is not accessible, please try a port above 1024.');
            }

            server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.error(`Port ${port} is already in use. Please use a different port.`);
                    process.exit(1);
                } else {
                    console.error('An error occurred while starting the server:', error);
                }
            });
        }
    });
}

function findUnusedPort(start, end) {
    return portscanner.findAPortNotInUse(start, end, 'localhost');
}

module.exports = {
    start,
    server,
    port,
    close: () => {
        if (server && server.close) {
            server.close();
        }
    }
};