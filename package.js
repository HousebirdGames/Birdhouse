const fs = require('fs-extra');
const path = require('path');
const vm = require('vm');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

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

    // Read the config file
    const configFilePath = path.join(__dirname, 'build-temp', 'dist', 'config-sw.js');
    const configFileCode = fs.readFileSync(configFilePath, 'utf8');

    // Create a sandboxed environment with a `self` object
    const sandbox = { self: {} };
    vm.createContext(sandbox);

    // Execute the config file code in the sandboxed environment
    vm.runInContext(configFileCode, sandbox);

    // Extract the config object
    const config = sandbox.self.config;

    // Read the package.json file
    const packageJsonPath = path.join(__dirname, 'build-temp', 'package.json');
    const packageJson = require(packageJsonPath);

    // Update the properties
    packageJson.name = config.pageTitle;
    packageJson.version = config.version;
    packageJson.description = config.pageDescription;
    packageJson.icon = {
        "win32": "dist/" + config.appIcon + ".ico",
        "darwin": "dist/" + config.appIcon + ".icns"
    };

    // Write the updated package.json back to disk
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log('');

    console.log('Packaging...');
    const { stdout: packageOutput } = await exec(`cd build-temp && npm install --production && cd .. && electron-packager build-temp ${config.pageTitle}-${config.version} --overwrite --out=./builds --prune --icon=${packageJson.icon}`);
    console.log(packageOutput);
    console.log('Finished packaging.');

    console.log('');

    console.log('Starting postpackaging...');
    fs.removeSync(path.join(__dirname, 'build-temp'));
    console.log('Removed build-temp directory.');
    console.log('Finished postpackaging.');
    console.log('');
    console.log('Done.');
    console.log('');
}

packageApp();