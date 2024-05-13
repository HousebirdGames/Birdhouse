/*
This file, electron-main.js, serves as the main entry point for an Electron application.
It is still in an experimental phase and should not be used in production.


Electron is a framework that allows for the development of desktop applications using web technologies like HTML, CSS, and JavaScript.
The main process, which is initiated by this file, can create and manage BrowserWindow instances, handle system events, and control
the application's lifecycle.
*/

const { app, BrowserWindow, Menu, shell } = require('electron');
const server = require('./server');
const path = require('path');
const fs = require('fs');

server.start(true);

async function createWindow() {
    const configFilePath = path.join(__dirname, 'dist', 'config.json');
    const configFileContent = fs.readFileSync(configFilePath, 'utf8');
    const config = JSON.parse(configFileContent);
    const iconPath = path.join(__dirname, 'dist', config.appIcon + '.ico');

    console.log(`Icon: ${iconPath}`);

    const trustedImageDomains = config.trustedImageDomains.join(' ');
    const contentSecurityPolicy = `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' ${trustedImageDomains}; object-src 'none'; base-uri 'self'; frame-src 'none';`;

    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        resizable: true,
        fullscreenable: true,
        frame: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            contentSecurityPolicy
        },
        icon: iconPath,
    });

    console.log(`Using http://localhost:${server.port}`);

    mainWindow.loadURL(`http://localhost:${server.port}`);

    const handleRedirect = (event, url) => {
        if (url !== mainWindow.webContents.getURL() && !url.includes('localhost')) {
            event.preventDefault();
            shell.openExternal(url);
        }
    };

    mainWindow.webContents.on('new-window', handleRedirect);
    mainWindow.webContents.on('will-navigate', handleRedirect);

    //Uncomment the following line to open the dev tools on startup
    //mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();
    Menu.setApplicationMenu(null);
});

app.on('before-quit', () => {
    if (server && server.close) {
        server.close();
    }
});