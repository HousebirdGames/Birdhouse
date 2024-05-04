/*
This feature is in an experimental state and may not be suitable for all use cases. Please use with caution and report any issues you encounter.


This Node.js script, provides the Electron packaging functionality for Birdhouse.
*/

const fs = require('fs-extra');
const path = require('path');
const vm = require('vm');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

function loadConfig() {
    const configFilePath = path.join(__dirname, 'dist', 'config-sw.js');
    const configFileCode = fs.readFileSync(configFilePath, 'utf8');

    const sandbox = { self: {} };
    vm.createContext(sandbox);

    vm.runInContext(configFileCode, sandbox);

    const config = sandbox.self.config;

    const newConfigFilePath = path.join(__dirname, 'dist', 'config.json');
    console.log('Writing config to', newConfigFilePath);
    fs.writeFileSync(newConfigFilePath, JSON.stringify(config, null, 2));

    return config;
}

async function packageApp() {
    console.log('Starting prepackaging...');
    fs.ensureDirSync(path.join(__dirname, 'build-temp', 'dist'));
    console.log('Created build-temp/dist directory.');
    fs.copySync(path.join(__dirname, 'dist'), path.join(__dirname, 'build-temp', 'dist'), {
        filter: (src, dest) => {
            const shouldCopy = !src.endsWith('.htaccess');
            if (!shouldCopy) {
                console.log(`Excluding ${src} from build.`);
            }
            return shouldCopy;
        }
    });
    console.log('Copied dist directory to build-temp/dist.');
    fs.copyFileSync(path.join(__dirname, 'server.js'), path.join(__dirname, 'build-temp', 'server.js'));
    console.log('Copied server.js to build-temp.');
    fs.copyFileSync(path.join(__dirname, 'package.json'), path.join(__dirname, 'build-temp', 'package.json'));
    console.log('Copied package.json to build-temp.');
    fs.copyFileSync(path.join(__dirname, 'electron-main.js'), path.join(__dirname, 'build-temp', 'electron-main.js'));
    console.log('Copied electron-main.js to build-temp.');
    console.log('Finished prepackaging.');

    const config = loadConfig();

    const packageJsonPath = path.join(__dirname, 'build-temp', 'package.json');
    const packageJson = require(packageJsonPath);

    packageJson.name = config.pageTitle;
    packageJson.version = config.version;
    packageJson.description = config.pageDescription;
    packageJson.icon = {
        "win32": path.resolve(__dirname, "dist", config.appIcon + ".ico"),
        "darwin": path.resolve(__dirname, "dist", config.appIcon + ".icns")
    };
    const iconPath = process.platform === 'win32' ? packageJson.icon.win32 : packageJson.icon.darwin;

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log('');

    console.log('Packaging...');
    const { stdout: packageOutput } = await exec(`cd build-temp && npm install --production && cd .. && electron-packager build-temp ${config.pageTitle}-${config.version} --overwrite --out=./builds --prune --icon=${iconPath}`);
    console.log(packageOutput);
    console.log('Finished packaging to', path.join(__dirname, 'builds', `${config.pageTitle}-${config.version}-win32-x64`));

    console.log('');

    console.log('Starting postpackaging...');
    fs.removeSync(path.join(__dirname, 'build-temp'));
    console.log('Removed build-temp directory.');
    console.log('Finished postpackaging.');
    console.log('');
    console.log('Done.');
    console.log('');
}

module.exports = {
    packageApp,
    loadConfig
}