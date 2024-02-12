/**
 * This script automates the release process of a progressive web application via sftp.
 * 
 * To use this script:
 * 
 * 1. Install the necessary dependencies by running `npm install` in the terminal.
 * 2. Run the script with `node pipeline.js -init`. This will initialize the project by copying the necessary files and creating the config files.
 * 3. Run the script with `node pipeline.js -h`. This will display the help message.
 * 4. If you want to release to production, add the `-production` or `-p` flag.
 * 
 * Please ensure that you have the necessary permissions to read from and write to the specified directories and files,
 * and to connect to the SFTP server.
 */
process.chdir('..');

const startTime = new Date();

const fs = require('fs');
const { promises: fsPromises, statSync } = require('fs');
const path = require('path');
const ProgressBar = require('progress');
let chalk = null;
const SftpClient = require('ssh2-sftp-client');
const UglifyJS = require("uglify-js");
const CleanCSS = require('clean-css');
const sharp = require('sharp');
const vm = require('vm');

const pathSegments = path.dirname(__dirname).split(path.sep);
const localhostPath = pathSegments[pathSegments.length - 1];

const defaultConfig = {
    version: "1.0.0.0",
    pageTitle: "My Web App",
    cookieIdentifier: "my_unique_identifier_that_could_be_the_page_title_and_should_never_change_and_should_be_unique_on_the_domain_and_should_be_much_shorter_than_this_one",
    foundationYear: 2024,
    pageDescription: "",
    localhostPath: '/' + localhostPath,
    excludedPaths: [],
    openCookiePopupAtPageLoad: true,
    showNewUpdateNotes: true,
    maintenanceModeWithFailedBackend: false,
    enableInputValidation: true,
    enableImageComparisonSliders: true,
    enableInfoBar: false,
    userLoginEnabled: false,
};

const defaultPipelineConfig = {
    productionPath: 'my_app_production',
    stagingPath: 'my_app_staging',
    htaccessFile: 'UPLOAD-THIS.htaccess',
    databaseDir: 'database',
    uncompressedDir: 'img/uploads-uncompressed',
    compressedDir: 'uploads',
    faviconsInputPath: 'img/logos-originals/Birdhouse-Logo.jpg',
    faviconsOutputDir: 'img/favicons',
    faviconsBaseFileName: 'Favicon',
    faviconSizes: [],
    statisticsFile: 'pipeline-log.txt',
    ignoredFileTypes: ['.zip', '.rar', '.md', '.txt', '.psd', '.htaccess'],
    directoriesToInclude: ['src', 'fonts', 'img/logos', 'img/favicons', 'img/screenshots', 'fonts', 'uploads'],
    directoriesToExcludeFromCache: ['img/screenshots', 'uploads'],
};

const initializeFlag = process.argv.includes('-init') || process.argv.includes('-initialize');
let config = defaultPipelineConfig;
let sftpConfigFile = null;
if (!initializeFlag) {
    config = require('../pipeline-config.js');
    sftpConfigFile = require('../sftp-config.js');
}

const ignoredFileTypes = config.ignoredFileTypes ? config.ignoredFileTypes : [];
const directoriesToInclude = config.directoriesToInclude;
const cacheFile = './Birdhouse/filesToCache.js';
const applicationPaths = {
    production: config.productionPath,
    staging: config.stagingPath
};
const sftpConfig = {
    host: sftpConfigFile ? sftpConfigFile.sftpHost : 'localhost',
    port: sftpConfigFile ? sftpConfigFile.sftpPort : 22,
    username: sftpConfigFile ? sftpConfigFile.sftpUsername : 'anonymous',
    password: sftpConfigFile ? sftpConfigFile.sftpPassword : ''
};

const minifiedDirectory = 'Birdhouse/minified';
const faviconsBaseFileName = config.faviconsBaseFileName;
const faviconsInputPath = config.faviconsInputPath;
const faviconsOutputDir = config.faviconsOutputDir;
const statisticsFile = config.statisticsFile;
const compressedDir = config.compressedDir;
const uncompressedDir = config.uncompressedDir;
const htaccessFile = config.htaccessFile;
const databaseDir = config.databaseDir;
const faviconSizes = config.faviconSizes != [] ? config.faviconSizes : [16, 32, 48, 64, 72, 128, 152, 167, 180, 192, 196, 464, 3000];

const updateFlag = process.argv.includes('-update') || process.argv.includes('-u');
const updateRootFlag = process.argv.includes('-root') || process.argv.includes('-r');
const productionFlag = process.argv.includes('-production') || process.argv.includes('-p');
const stagingFlag = process.argv.includes('-staging') || process.argv.includes('-s');
const cacheFlag = process.argv.includes('-cache') || process.argv.includes('-c');
const rollbackFlag = process.argv.includes('-rollback') || process.argv.includes('-r');
const backupFlag = process.argv.includes('-backup') || process.argv.includes('-b');
const deleteFlag = process.argv.includes('-delete') || process.argv.includes('-d');
const versionFlagIndex = process.argv.findIndex(arg => arg === '-version' || arg === '-v');
const helpFlag = process.argv.includes('-help') || process.argv.includes('-h');
const infoFlag = process.argv.includes('-info') || process.argv.includes('-i');
const minifyFlag = process.argv.includes('-minify') || process.argv.includes('-m');
const skipCompressedUploadFlag = process.argv.includes('-skipCompU') || process.argv.includes('-su');
const disableStatisticsFlag = process.argv.includes('-nolog') || process.argv.includes('-nl');
const generateFaviconsFlag = process.argv.includes('-genfavicons') || process.argv.includes('-gf');
const fileTypeCounts = {};
let fileTypeSizes = {};

function help() {
    if (helpFlag || process.argv.length === 2) {
        console.log(`        Usage: node pipeline.js [options]

        The database folder is uploaded, but not added to the cached files.
    
        Options:
        -u, -update             Updates or creates the config.js and config-pipeline.js with necessary entries, orders them and exits
        -r, -root               Copies all files from /Birdhouse/root to the root directory and exits
        -v, -version <version>  Set the version number. Expected format is x, x.x, x.x.x, or x.x.x.x
        -v, -version            Increment the last part of the version number by 1
        -h, -help or [no flag]  Display this help message and exit
        -i, -info               Display detailed information about the process
        -c, -cache              (Re-)Generates the filesToCache.js file
        -d, -delete <-p|-s>     Deletes the application production or staging directory from the server
        -b, -backup             Creates a backup before deploying the new version that can be rolled back to.
        -r, -rollback           Rollback to the backup version, if on server (used with -p or -s)
        -nl,-nolog              No statistics logged and added to the log file
        -m, -minify             Minifies the files in filesToCache.js (before uploading them to the server)
        -p, -production         Release to production
        -s, -staging            Release to staging (is ignored if -p is set)
        -su,-skipCompU          Skips image compression and upload of the compressed folder
        -gf,-genfavicons        Creates favicons of all sizes from the original favicon and exits
        `);
        process.exit(0);
    }
}

async function main() {
    chalk = (await import('chalk')).default;
    console.log(chalk.green('Started Pipeline in ' + process.cwd()));

    help();

    console.log('');

    if (initializeFlag) {
        await initializeProject();
        process.exit(0);
    }

    if (updateFlag) {
        await updateConfig();
        await updatePipelineConfig();
        process.exit(0);
    }

    if (updateRootFlag) {
        await updateRoot();
        process.exit(0);
    }

    if (generateFaviconsFlag) {
        await generateFavicons();
        process.exit(0);
    }

    let missingConfigs = [];

    if (!config.ignoredFileTypes) missingConfigs.push('ignoredFileTypes');
    if (!config.directoriesToInclude) missingConfigs.push('directoriesToInclude');
    if (!config.productionPath) missingConfigs.push('productionPath');
    if (!config.stagingPath) missingConfigs.push('stagingPath');
    if (!sftpConfigFile.sftpHost) missingConfigs.push('sftpHost');
    if (!sftpConfigFile.sftpPort) missingConfigs.push('sftpPort');
    if (!sftpConfigFile.sftpUsername) missingConfigs.push('sftpUsername');
    if (!sftpConfigFile.sftpPassword) missingConfigs.push('sftpPassword');

    if (missingConfigs.length > 0) {
        console.error('Error: Missing necessary configuration values in sftp-config.js:', missingConfigs.join(', '));
        console.log('');
        process.exit(1);
    }

    const applicationPath = getApplicationPath();
    if (productionFlag || stagingFlag) {
        await updateRoot();
        console.log(chalk.green(`Starting ${productionFlag ? 'production' : 'staging'} ${deleteFlag ? 'deletion' : 'release'} process to ${applicationPath}...`));
    }

    const currentVersion = await getCurrentVersion();
    let version = currentVersion;
    console.log(`Current version: ${currentVersion}`);

    if (versionFlagIndex !== -1) {
        const newVersion = getNewVersion(currentVersion);
        version = newVersion;
        await updateVersion(newVersion);
    }

    await createConfigForServiceWorker();

    const filesToCache = await getFilesToCache();

    information(filesToCache);

    const cacheSize = await writeFilesToCacheFile(filesToCache);

    await checkFilesExist(filesToCache);

    let minifiedSize = '';
    if (!deleteFlag) {
        minifiedSize = await minifyFiles(filesToCache);
    }

    let filesUploaded = null;
    if (rollbackFlag) {
        await rollback(applicationPath);
    }
    else if (deleteFlag) {
        await deleteDirectoryFromServer(applicationPath);
    }
    else {
        await compressImages();
        filesUploaded = await uploadFilesToServer(filesToCache, applicationPath) | 0;
    }

    console.log('');
    if ((productionFlag || stagingFlag) && !deleteFlag && !rollbackFlag && filesUploaded > 0) {
        console.log(chalk.green(`Release process of version ${version} completed successfully.`));
    }
    else {
        console.log(chalk.green('Done.'));
    }

    const endTime = new Date();
    const elapsedTime = endTime - startTime;
    const minutes = Math.floor(elapsedTime / 60000);
    const seconds = ((elapsedTime % 60000) / 1000).toFixed(0);

    console.log(chalk.gray(`Elapsed time: ${minutes}:${seconds} minutes`));

    await addStatistics(`${minutes}:${seconds} minutes`, version, filesUploaded, filesToCache.length, cacheSize, minifiedSize);

    console.log('');
}

async function initializeProject() {
    const sourceDir = './Birdhouse/root_EXAMPLE';
    const targetDir = './';

    console.log('');
    console.log(chalk.gray('If you just want to update your config.js and your pipeline-config.js, use the "-update"-flag.'));
    console.log(chalk.gray('If you just want to move your root files to the root directory, use the "-root"-flag.'));
    console.log('');

    if (!fs.existsSync(sourceDir)) {
        console.log(chalk.yellow('The root_EXAMPLE directory does not exist. Please pull/download the framework again. Skipping initialization.'));
        console.log('');
    } else {
        console.log(chalk.green('Initializing project...'));
        await copyDirectory(sourceDir, targetDir);
        await updateConfig();
        await updatePipelineConfig();
        await updateRoot();
        console.log('');
        await generateFavicons();
        console.log(chalk.green('Project initialized'));
        console.log('');
    }
}

async function copyDirectory(source, target) {
    infoFlag && console.log(chalk.gray(`    Copying from ${source} to ${target}...`));
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
    }

    const files = fs.readdirSync(source);

    for (let file of files) {
        const sourcePath = path.join(source, file);
        const targetPath = path.join(target, file);

        if (fs.existsSync(targetPath)) {
            console.log(chalk.grey(`    File ${targetPath} already exists. Skipping.`));
            continue;
        }

        if (fs.lstatSync(sourcePath).isDirectory()) {
            copyDirectory(sourcePath, targetPath);
        } else {
            if (file === '.htaccess') {
                let content = fs.readFileSync(sourcePath, 'utf8');
                content = content.replace(/LOCALHOST_PATH/g, defaultConfig.localhostPath);
                fs.writeFileSync(targetPath, content, 'utf8');
            } else {
                fs.copyFileSync(sourcePath, targetPath);
            }
        }
    }
    infoFlag && console.log(chalk.gray(`    Copy successful`));
}

async function checkFilesExist(files) {
    let filesMissing = false;
    await Promise.all(files.map(async (file) => {
        try {
            await fsPromises.access(file, fs.constants.F_OK);
        } catch (err) {
            console.log(chalk.red(`    File does not exist: ${file}`));
            filesMissing = true;
        }
    }));

    if (filesMissing) {
        console.log('');
        throw new Error('One or more files are missing');
    } else {
        console.log(chalk.green('All files exist.'));
    }
}

function information(filesToCache) {
    if (infoFlag) {
        console.log('');
        console.log(chalk.green(`Information:`));
        console.log('');
        console.log(`    Production path: ${applicationPaths.production}`);
        console.log(`    Staging path: ${applicationPaths.staging}`);
        console.log('');
        console.log(chalk.yellow(`    Included ${filesToCache.length} files`));

        console.log('');
        for (const fileType in fileTypeCounts) {
            console.log(chalk.gray(`    ${fileType ? fileType : 'NO EXT'}: ${fileTypeCounts[fileType]}x${fileTypeSizes[fileType] ? ` > ${(fileTypeSizes[fileType] / 1048576).toFixed(2)} MB` : ''}`));
        }
    }
}

async function minifyFiles(filesToCache) {
    if (!minifyFlag) return null;

    if (!minifiedDirectory) {
        console.log(chalk.yellow('No minified directory specified. Skipping minification.'));
        return null;
    }

    console.log('');
    console.log(chalk.gray(`Minifying ${filesToCache.length} files...`));

    await fsPromises.mkdir(minifiedDirectory, { recursive: true });

    let oldTotalSize = 0;
    let totalSize = 0;

    const bar = new ProgressBar('    Minifying files [:bar] :percent :etas', {
        complete: '=',
        incomplete: ' ',
        width: 24,
        total: filesToCache.length
    });

    for (const file of filesToCache) {
        const outputPath = path.join(minifiedDirectory, path.basename(file));

        const originalStats = await fsPromises.stat(file);
        const originalSizeKB = (originalStats.size / 1024).toFixed(2);
        oldTotalSize += originalStats.size;

        if (file.endsWith('.js')) {
            const fileContent = await fsPromises.readFile(file, 'utf8');
            const result = UglifyJS.minify(fileContent);
            if (result.error) throw result.error;
            await fsPromises.writeFile(outputPath, result.code, 'utf8');
        } else if (file.endsWith('.css')) {
            const fileContent = await fsPromises.readFile(file, 'utf8');
            const result = new CleanCSS({}).minify(fileContent);
            if (result.errors.length > 0) throw result.errors;
            await fsPromises.writeFile(outputPath, result.styles, 'utf8');
        }
        else {
            if (!infoFlag) bar.tick();
            continue;
        }

        const minifiedStats = await fsPromises.stat(outputPath);
        totalSize += minifiedStats.size;

        if (infoFlag) {
            console.log(chalk.gray(`    Minified ${path.basename(file)}: ${originalSizeKB} KB > ${(minifiedStats.size / 1024).toFixed(2)} KB`));
        }
        else {
            bar.tick();
        }
    }

    if (infoFlag) {
        bar.tick(filesToCache.length);
    }

    const oldFileSize = (oldTotalSize / 1048576).toFixed(2);
    const newFileSize = (totalSize / 1048576).toFixed(2);

    console.log('');
    console.log(`Total minified size: ${oldFileSize} MB > ${newFileSize} MB`);

    return newFileSize;
}

async function addStatistics(time, version, uploadedFiles, cachedFiles, cacheFileSize, minifiedSize) {
    if (disableStatisticsFlag) return;

    if (!statisticsFile) {
        console.log(chalk.yellow('No statistics file specified. Skipping statistics.'));
        return;
    }

    let currentTime = new Date();
    currentTime = currentTime.toLocaleString('en-GB').replace(',', '');
    const scriptArguments = process.argv
        .slice(2)
        .map(arg => path.basename(arg))
        .join(' ');
    const statistics = `Version:         ${version}\nFinished:        ${currentTime}\nArguments:       ${scriptArguments}\nProcess Time:    ${time}\nUploaded files:  ${uploadedFiles ? uploadedFiles : '0'}\nCached files:    ${cachedFiles}\nCache file size: ${(cacheFileSize / 1048576).toFixed(2)} MB${minifiedSize ? `\nMinified size:   ${minifiedSize} MB` : ''}\n\n`;

    try {
        const data = await fsPromises.readFile(statisticsFile, 'utf8');
        await fsPromises.writeFile(statisticsFile, statistics + (data || ''), 'utf8');
        console.log(chalk.gray('Statistics saved'));
    } catch (error) {
        if (error.code === 'ENOENT') {
            try {
                await fsPromises.writeFile(statisticsFile, statistics, 'utf8');
                console.log(chalk.green(`Statistics file created: ${statisticsFile} and statistics saved`));
            } catch (writeError) {
                console.error(`Error creating file: ${writeError}`);
            }
        } else {
            console.error(`Error: ${error}`);
        }
    }
}

async function updateConfig() {
    console.log(chalk.gray('Updating config.js...'));
    const configPath = './config.js';

    if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        const configMatch = fileContent.match(/export default (\{[\s\S]*\});/);
        let newConfig;
        if (configMatch) {
            const configString = configMatch[1];
            const script = new vm.Script(`obj = ${configString}`);
            const context = { obj: {} };
            script.runInNewContext(context);
            const existingConfig = context.obj;
            newConfig = { ...defaultConfig, ...existingConfig };
        } else {
            console.log(chalk.yellow('Could not parse config.js, writing default config'));
            newConfig = defaultConfig;
        }
        fs.writeFileSync(configPath, `export default ${JSON.stringify(newConfig, null, 2)};`);
    } else {
        console.log(chalk.white('config.js does not exist, creating default config'));
        fs.writeFileSync(configPath, `export default ${JSON.stringify(defaultConfig, null, 2)};`);
    }
    console.log(chalk.green('config.js updated'));
    console.log('');
}

async function updatePipelineConfig() {
    console.log(chalk.gray('Updating pipeline-config.js...'));
    const configPath = './pipeline-config.js';

    if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        const configMatch = fileContent.match(/module\.exports = (\{[\s\S]*\});/);
        let newConfig;
        if (configMatch) {
            const configString = configMatch[1];
            const script = new vm.Script(`obj = ${configString}`);
            const context = { obj: {} };
            script.runInNewContext(context);
            const existingConfig = context.obj;
            newConfig = { ...defaultPipelineConfig, ...existingConfig };
        } else {
            console.log(chalk.yellow('Could not parse pipeline-config.js, writing default config'));
            newConfig = defaultPipelineConfig;
        }
        const configString = stringifyObject(newConfig);
        fs.writeFileSync(configPath, `module.exports = ${configString};`);
    } else {
        console.log(chalk.white('pipeline-config.js does not exist, creating default config'));
        const configString = stringifyObject(defaultPipelineConfig);
        fs.writeFileSync(configPath, `module.exports = ${configString};`);
    }
    console.log(chalk.green('pipeline-config.js updated'));
    console.log('');

    function stringifyObject(obj, indent = '    ') {
        if (Array.isArray(obj)) {
            const entries = obj.map(value => {
                if (typeof value === 'object' && value !== null) {
                    return `${indent}${stringifyObject(value, indent + '    ')}`;
                }
                return `${indent}${JSON.stringify(value)}`;
            });
            return `[\n${entries.join(',\n')}\n${indent}]`;
        } else {
            const entries = Object.entries(obj).map(([key, value]) => {
                if (typeof value === 'object' && value !== null) {
                    return `${indent}${key}: ${stringifyObject(value, indent + '    ')}`;
                }
                return `${indent}${key}: ${JSON.stringify(value)}`;
            });
            return `{\n${entries.join(',\n')}\n${indent}}`;
        }
    }
}

async function updateRoot() {
    console.log(chalk.gray('Updating root directory...'));
    const sourceDir = './Birdhouse/root';
    const destDir = './';

    const files = await fsPromises.readdir(sourceDir);
    for (const file of files) {
        const sourceFile = path.join(sourceDir, file);
        const destFile = path.join(destDir, file);
        await fsPromises.copyFile(sourceFile, destFile);
    }
    console.log(chalk.green('Root directory updated'));
}

async function compressImages() {
    if (skipCompressedUploadFlag) {
        console.log(chalk.grey('Skipping image compression, because compressed uploads are skipped.'));
        return;
    }

    if (!uncompressedDir) {
        console.log(chalk.yellow('No uncompressed directory specified. Skipping image compression.'));
        return;
    }
    else if (!compressedDir) {
        console.log(chalk.yellow('No compressed directory specified. Skipping image compression.'));
        return;
    }

    if (!fs.existsSync(compressedDir)) {
        fs.mkdirSync(compressedDir, { recursive: true });
    }

    fs.readdir(uncompressedDir, (err, files) => {
        if (err) {
            console.error(`Error reading directory: ${err}`);
            return;
        }

        if (files.length > 0) {
            console.log('');
            console.log(chalk.gray(`Compressing ${files.length} images...`));
        }

        files.forEach(file => {
            infoFlag && console.log(chalk.gray(`    Compressing: ${file}`));
            const uncompressedPath = path.join(uncompressedDir, file);
            const compressedPath = path.join(compressedDir, file);

            fs.access(compressedPath, fs.constants.F_OK, (err) => {
                if (err) {
                    sharp(uncompressedPath)
                        .resize(800)
                        .jpeg({ quality: 100 })
                        .toFile(compressedPath)
                        .then(() => infoFlag && console.log(chalk.gray(`Compressed: ${file}`)))
                        .catch(err => console.error(`Error compressing ${file}: ${err}`));
                }
            });
        });

        if (files.length > 0) console.log(chalk.green(`Compressed ${files.length} images.`));
    });
}

async function getCurrentVersion() {
    let data;
    try {
        data = await fsPromises.readFile('./config.js', 'utf8');
    } catch (err) {
        throw new Error('Could not read config.js: ' + err.message);
    }
    const versionMatch = data.match(/"version": "(.*?)",/);
    if (!versionMatch) throw new Error('Could not find version in config.js');
    return versionMatch[1];
}

function getNewVersion(currentVersion) {
    if (versionFlagIndex !== -1) {
        let newVersion = process.argv[versionFlagIndex + 1];
        if (newVersion === undefined || newVersion.startsWith('-')) {
            const versionParts = currentVersion.split('.');
            versionParts[3] = (parseInt(versionParts[3], 10) + 1).toString();
            return versionParts.join('.');
        } else if (!/^\d+(\.\d+){0,3}$/.test(newVersion)) {
            throw new Error('Invalid version number format. Expected format is x, x.x, x.x.x, or x.x.x.x');
        } else {
            const versionParts = newVersion.split('.');
            while (versionParts.length < 4) {
                versionParts.push('0');
            }
            return versionParts.join('.');
        }
    }

    return currentVersion;
}

async function updateVersion(newVersion) {
    const filePath = './config.js';
    let data = await fsPromises.readFile(filePath, 'utf8');
    data = data.replace(/("version": ")(.*?)(",)/, `$1${newVersion}$3`);
    await fsPromises.writeFile(filePath, data, 'utf8');
    await updateVersionOnServiceWorker(newVersion);
    console.log(`Version updated to: ${newVersion}`);
}

async function updateVersionOnServiceWorker(newVersion) {
    const filePath = './service-worker.js';
    let data = await fsPromises.readFile(filePath, 'utf8');
    data = data.replace(/self.CACHE_VERSION = "(.*?)";/, `self.CACHE_VERSION = "${newVersion}";`);
    await fsPromises.writeFile(filePath, data, 'utf8');
    console.log(chalk.gray(`Service Worker Version updated to: ${newVersion}`));
}

async function createConfigForServiceWorker() {
    const filePath = './config.js';
    const swFilePath = './config-sw.js';

    try {
        await fsPromises.access(filePath, fs.constants.F_OK);
    } catch (err) {
        const defaultConfig = `export default {
            "version": "1.0.0",
        };`;
        await fsPromises.writeFile(filePath, defaultConfig, 'utf8');
        console.log('Created default config.js');
    }

    try {
        await fsPromises.access(swFilePath, fs.constants.F_OK);
    } catch (err) {
        await fsPromises.writeFile(swFilePath, '', 'utf8');
        console.log('Created empty config-sw.js');
    }

    let data = await fsPromises.readFile(filePath, 'utf8');
    data = data.replace('export default {', 'self.config = {');
    await fsPromises.writeFile(swFilePath, data, 'utf8');
    console.log('Created config for the service worker');
}

async function getFilesToCache() {
    let filesToCache = [
        'index.html',
        'sitemap.xml',
        'robots.txt',
        'service-worker.js',
        'config-sw.js',
        'everywhere.js',
        'config.js',
        'updateNotes.js',
        'manifest.json',
        'admin-style.css',
        'style.css',
        'Birdhouse/default-style.css',
        'Birdhouse/filesToCache.js',
        'Birdhouse/service-worker-registration.js',
    ];

    if (infoFlag) {
        console.log(chalk.gray(`Specified files to cache:`));
        filesToCache.forEach(element => {
            console.log(chalk.gray(`    ${element}`));
        });
    }

    directoriesToInclude.push('Birdhouse/src');
    directoriesToInclude.push('Birdhouse/fonts');

    for (const dir of directoriesToInclude) {
        infoFlag && console.log(chalk.gray(`Reading files from ${dir}...`));
        await readFilesFromDirectory(dir, filesToCache);
    }

    return [...new Set(filesToCache)].sort();
}

async function readFilesFromDirectory(directory, filesToCache) {
    infoFlag && console.log(chalk.gray(`Reading files from ${directory}...`));
    const filesInDirectory = await fsPromises.readdir(directory);
    for (const file of filesInDirectory) {
        const fullPath = path.join(directory, file);
        if (fs.existsSync(fullPath)) {
            const stats = await fsPromises.stat(fullPath);
            if (stats.isDirectory()) {
                infoFlag && console.log(chalk.gray(`    Reading files from ${fullPath}...`));
                await readFilesFromDirectory(fullPath, filesToCache);
            } else {
                const fileType = path.extname(file);
                if (!ignoredFileTypes.includes(fileType)) {
                    infoFlag && console.log(chalk.gray(`    Adding ${fullPath} to files to cache...`));
                    filesToCache.push(fullPath.replace(/\//g, '/'));
                    fileTypeCounts[fileType] = (fileTypeCounts[fileType] || 0) + 1;
                    fileTypeSizes[fileType] = (fileTypeSizes[fileType] || 0) + stats.size;
                }
            }
        } else {
            console.log(`File does not exist: ${fullPath}`);
        }
    }
}

async function writeFilesToCacheFile(filesToCache) {
    console.log('');

    let totalSize = 0;
    const filteredFilesToCache = filesToCache.filter(file => {
        return !config.directoriesToExcludeFromCache.some(dir => file.startsWith(dir));
    });

    if (cacheFlag) {
        console.log(chalk.gray(`Writing ${filteredFilesToCache.length} files to ${cacheFile}...`));

        let fileContent = 'self.filesToCache = [\n';
        fileContent += filteredFilesToCache.map(f => `'/${f}',`.replace(/\\/g, '/')).join('\n');
        fileContent += '\n];';
        await fsPromises.writeFile(cacheFile, fileContent, 'utf8');
        const stats = statSync(cacheFile);
        totalSize += stats.size;
    }

    filteredFilesToCache.forEach(file => {
        infoFlag && console.log(chalk.gray(`    File: ${file}`));

        if (file != cacheFile) {
            const stats = statSync(file);
            totalSize += stats.size;
        }
    });


    console.log(chalk.yellow(`Wrote ${filesToCache.length} files (total size: ${(totalSize / 1048576).toFixed(2)} MB) to ${cacheFile}.`));

    return totalSize;
}

async function uploadFilesToServer(filesToCache, applicationPath) {
    if (!productionFlag && !stagingFlag) return;


    if (skipCompressedUploadFlag) {
        console.log(chalk.grey('Skipping files that are in the compressed directory.'))
        filesToCache = filesToCache.filter(file => !file.startsWith(config.compressed));
    }
    let filesToUpload = [...filesToCache, './Birdhouse/filesToCache.js'];

    if (databaseDir) {
        await readFilesFromDirectory(databaseDir, filesToUpload);
    }

    //service worker is uploaded last to not trigger recaching on clients before all files are uploaded
    filesToUpload.sort((a, b) => {
        if (path.basename(a) === 'service-worker.js') return 1;
        if (path.basename(b) === 'service-worker.js') return -1;
        return 0;
    });

    console.log('');
    console.log(chalk.grey(`Uploading ${filesToUpload.length} files to server:`))

    const sftp = new SftpClient();
    sftp.client.setMaxListeners((filesToUpload.length + 1));

    try {
        console.log(chalk.blue('    Attempting to connect to SFTP server...'));
        await sftp.connect(sftpConfig);
        console.log(chalk.green('    Successfully connected to SFTP server.'));

        console.log(chalk.blue('    Uploading files to server...'));
        await uploadFiles(filesToUpload, sftp, applicationPath);
        console.log(chalk.green('    Files successfully uploaded.'));
    } catch (error) {
        const endTime = new Date();
        const elapsedTime = endTime - startTime;
        console.error(`Error: ${error.message}. Elapsed time: ${elapsedTime} ms.`);
        return 0;
    } finally {
        console.log(chalk.blue('    Closing SFTP connection...'));
        await sftp.end();
        console.log(chalk.green('    SFTP connection closed.'));
    }
    console.log(chalk.gray('Upload complete.'));
    return filesToUpload.length;
}

async function createDirectoriesOnServer(filesToUpload, sftp, applicationPath) {
    applicationPath = `${applicationPath}`;
    const directories = Array.from(new Set(filesToUpload.map(file => path.dirname(file).replace(/\\/g, '/'))));
    directories.sort((a, b) => a.split('/').length - b.split('/').length);

    const dirBar = new ProgressBar('    Creating directories [:bar] :percent :etas', {
        complete: '=',
        incomplete: ' ',
        width: 24,
        total: directories.length - 1
    });

    for (const dir of directories) {
        if (dir === '.') continue;
        infoFlag && console.log(chalk.gray(`    Creating directory: ${dir}`));

        const remoteDir = `/${applicationPath}/` + (dir.startsWith('./') ? dir.slice(2) : dir);
        await sftp.mkdir(remoteDir, true);

        infoFlag || dirBar.tick();
    }
    infoFlag && dirBar.tick(directories.length - 1);
}

async function uploadFilesToDirectory(filesToUpload, sftp, applicationPath) {
    const uploadBar = new ProgressBar('    Uploading files [:bar] :percent :etas', {
        complete: '=',
        incomplete: ' ',
        width: 24,
        total: filesToUpload.length
    });

    await Promise.all(filesToUpload.map(async (file) => {
        infoFlag && console.log(chalk.gray(`    Uploading: ${file}`));

        const relativeFilePath = file.replace(/^\.\/|^\//, '');
        const remotePath = `/${applicationPath}/${relativeFilePath.replace(/\\/g, '/')}`;

        const minifiedFilePath = path.join(minifiedDirectory, path.basename(file));
        const localFilePath = fs.existsSync(minifiedFilePath) && minifyFlag ? minifiedFilePath : file;

        await sftp.fastPut(localFilePath, remotePath);
        uploadBar.tick();
    }));

    if (htaccessFile) {
        await sftp.fastPut(htaccessFile, `/${applicationPath}/.htaccess`);
    }
}

async function uploadFiles(filesToUpload, sftp, applicationPath) {
    const backupApplicationPath = `${applicationPath}_BACKUP`;

    if (backupFlag) {
        console.log(chalk.blue('    Starting Backup...'))
        if (await sftp.exists(applicationPath)) {
            if (await sftp.exists(backupApplicationPath)) {
                await deleteDirectory(sftp, backupApplicationPath);
            }

            await sftp.mkdir(backupApplicationPath);
            await copySFTPDirectory(sftp, applicationPath, backupApplicationPath, 'backup');
        }
        else {
            console.log(chalk.red('    No directory to backup.'));
        }
    }

    await createDirectoriesOnServer(filesToUpload, sftp, applicationPath);
    await uploadFilesToDirectory(filesToUpload, sftp, applicationPath);
}

async function copySFTPDirectory(sftp, src, dest, tempFolderName = 'temp') {
    const projectTempDir = path.join(__dirname, tempFolderName);
    console.log(chalk.gray(`    Checking if ${src} exists...`));

    const srcExists = await sftp.exists(src);
    if (!srcExists) {
        console.log(chalk.red(`    Source directory ${src} does not exist. Aborting copy operation.`));
        return;
    }

    console.log(chalk.gray(`    Copying ${src} to ${dest}...`));

    if (fs.existsSync(projectTempDir)) {
        fs.rmSync(projectTempDir, { recursive: true, force: true });
    }

    console.log(chalk.gray(`    Downloading from ${src}...`));
    const downloadInterval = spinner();
    await sftp.downloadDir(src, projectTempDir);
    clearInterval(downloadInterval);
    process.stdout.write('\r');

    console.log(chalk.gray(`    Uploading to ${dest}.`));
    const uploadInterval = spinner();
    await sftp.uploadDir(projectTempDir, dest);
    clearInterval(uploadInterval);
    process.stdout.write('\r');

    console.log(chalk.gray(`    Copy completed.`));
}

async function rollback(applicationPath) {
    console.log(chalk.grey('Rolling back to backup...'));

    const backupApplicationPath = `${applicationPath}_BACKUP`;

    const sftp = new SftpClient();
    try {
        console.log(chalk.blue('    Attempting to connect to SFTP server...'));
        await sftp.connect(sftpConfig);
        console.log(chalk.green('    Successfully connected to SFTP server.'));

        if (await sftp.exists(backupApplicationPath)) {
            sftp.client.setMaxListeners(200);


            await copySFTPDirectory(sftp, backupApplicationPath, applicationPath);

        } else {
            console.log(chalk.red('No backup version found for rollback.'));
        }
    } catch (error) {
        console.error(chalk.red('    An error occurred:', error.message));
    } finally {
        console.log(chalk.blue('    Closing SFTP connection...'));
        await sftp.end();
        console.log(chalk.green('    SFTP connection closed.'));
    }
    console.log('');
    console.log(chalk.green('Rollback complete.'));
}

async function deleteDirectory(sftp, path) {
    try {
        console.log(chalk.gray(`    Deleting ${path}...`));
        const interval = spinner();
        await sftp.rmdir(path, true);
        clearInterval(interval);
        process.stdout.write('\r');
        console.log(chalk.gray(`    Deleted ${path}.`));
    } catch (error) {
        clearInterval(interval);
        process.stdout.write('\r');
        console.error(chalk.red(`Failed to delete ${path}:`, error));
    }
}

async function deleteDirectoryFromServer(applicationPath) {
    if (!productionFlag && !stagingFlag) {
        console.log(chalk.red('No production (-p) or staging flag (-s) set. Aborting deletion.'))
        return;
    }
    else if (!deleteFlag) {
        console.log(chalk.red('No delete flag (-d) set. Aborting deletion.'))
        return;
    }

    console.log('');
    console.log(chalk.grey('Deleting directory from server:'))

    const sftp = new SftpClient();

    try {
        console.log(chalk.blue('    Attempting to connect to SFTP server...'));
        await sftp.connect(sftpConfig);
        console.log(chalk.green('    Successfully connected to SFTP server.'));

        console.log(chalk.blue('    Deleting directory from server...'));

        const interval = spinner();

        await sftp.rmdir(applicationPath, true);

        clearInterval(interval);
        process.stdout.write('\r');
        console.log(chalk.green('    Directory successfully deleted.'));
    } catch (error) {
        clearInterval(interval);
        process.stdout.write('\r');
        console.error(chalk.red('    An error occurred:', error.message));
    } finally {
        console.log(chalk.blue('    Closing SFTP connection...'));
        await sftp.end();
        console.log(chalk.green('    SFTP connection closed.'));
    }
    console.log(chalk.grey('Deletion complete.'));
}

function spinner() {
    const spinner = ['/', '-', '\\', '|'];
    let i = 0;
    return interval = setInterval(() => {
        process.stdout.write(`\r    ${spinner[i++ % spinner.length]}`);
    }, 250);
}

function getApplicationPath() {
    return productionFlag ? applicationPaths.production : applicationPaths.staging;
}

async function generateFavicons() {
    if (!faviconsInputPath) {
        console.log(chalk.yellow('No input path for the original favicon specified. Skipping favicon generation.'));
        return;
    }
    else if (!faviconsOutputDir) {
        console.log(chalk.yellow('No output directory specified. Skipping favicon generation.'));
        return;
    }
    else if (!faviconsBaseFileName) {
        console.log(chalk.yellow('No base file name specified. Skipping favicon generation.'));
        return;
    }

    console.log(chalk.grey(`Generating favicons...`));

    if (!fs.existsSync(faviconsOutputDir)) {
        console.log(chalk.grey(`Creating output directory: ${faviconsOutputDir}`));
        fs.mkdirSync(faviconsOutputDir, { recursive: true });
    }

    for (const size of faviconSizes) {
        try {
            const outputPath = path.join(faviconsOutputDir, `${faviconsBaseFileName}-${size}x${size}.png`);
            await sharp(faviconsInputPath)
                .resize(size, size)
                .toFile(outputPath);
            infoFlag && console.log(chalk.grey(`    Resized image to ${size}x${size} and saved to ${outputPath}`));
        } catch (err) {
            console.error(`Error resizing image to ${size}x${size}:`, err);
        }
    }

    console.log(chalk.green(`Favicons generated successfully`));
    console.log('');
}

main().catch(err => console.error(chalk.red('An error occurred in the pipeline:', err.message)));