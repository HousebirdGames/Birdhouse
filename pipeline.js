/*
This script automates the release process of a progressive web application via sftp.


To use this script:


1. Install the necessary dependencies by running [i]npm install[/i] in the terminal.


2. Run the script with [i]node pipeline.js -init[/i]. This will initialize the project by copying the necessary files and creating the config files.


3. Run the script with [i]node pipeline.js -h[/i]. This will display the help message.


4. If you want to release to production, add the [i]-production[/i] or [i]-p[/i] flag.


Please ensure that you have the necessary permissions to read from and write to the specified directories and files, and to connect to the SFTP server.
*/
process.chdir('..');

const startTime = new Date();

console.log('');
console.log('Started Pipeline in ' + process.cwd());

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
const { parse } = require('node-html-parser');
const { exec } = require('child_process');
const util = require('util');
const toIco = require('to-ico');
const { loadConfig } = require('./package.js');

const execAsync = util.promisify(exec);

const pathSegments = path.dirname(__dirname).split(path.sep);
const localhostPath = pathSegments[pathSegments.length - 1];

const lockFilePath = './Birdhouse/pipeline.lock';

const infoFlag = process.argv.includes('-info') || process.argv.includes('-i');

removeLock();

function createLock() {
    fs.writeFileSync(lockFilePath, 'locked');
    infoFlag && console.log('Pipeline lock created.');
}

function removeLock() {
    if (fs.existsSync(lockFilePath)) {
        fs.unlinkSync(lockFilePath);
        infoFlag && console.log('Pipeline lock removed.');
    }
}

function exitPipeline() {
    removeLock();
    process.exit(0);
}

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
    redirect404ToRoot: false,
    appIcon: 'img/app-icons/icon',
    trustedImageDomains: [],
    useMouseDown: false,
    backNavigationClosesPopups: true,
    scrollPositionRecallLimit: 20,
};

const defaultPipelineConfig = {
    sftpConfigFile: '../sftp-config.js',
    productionPath: 'my_app_production',
    stagingPath: 'my_app_staging',
    distPath: 'Birdhouse/dist',
    htaccessFile: 'UPLOAD-THIS.htaccess',
    basePath: '/',
    databaseDir: 'database',
    uncompressedDir: 'img/uploads-uncompressed',
    compressedDir: 'uploads',
    faviconPath: 'img/logos-originals/Birdhouse-Logo.jpg',
    faviconsOutputDir: 'img/favicons',
    faviconsFileName: 'Favicon',
    faviconSizes: [],
    manifestIconPath: 'img/logos-originals/Birdhouse-Logo.png',
    manifestIconOutputDir: 'img/icons',
    manifestIconFileName: 'Icon',
    manifestIconSizes: [],
    statisticsFile: 'pipeline-log.txt',
    ignoredFileTypes: ['.zip', '.rar', '.md', '.psd', '.htaccess'],
    directoriesToInclude: ['src', 'fonts', 'img/favicons', 'img/icons', 'img/app-icons', 'img/screenshots', 'uploads'],
    directoriesToExcludeFromCache: ['img/screenshots', 'uploads'],
    preReleaseScripts: [],
    postReleaseScripts: [],
    appIconSourcePath: 'img/logos-originals/Birdhouse-Logo.jpg',
    appIconOutputDir: 'img/app-icons',
};

const initializeFlag = process.argv.includes('-init') || process.argv.includes('-initialize');
const updateFlag = process.argv.includes('-update') || process.argv.includes('-u');
const updateRootFlag = process.argv.includes('-root') || process.argv.includes('-r');
const productionFlag = process.argv.includes('-production') || process.argv.includes('-p');
const stagingFlag = process.argv.includes('-staging') || process.argv.includes('-s');
const cacheFlag = process.argv.includes('-cache') || process.argv.includes('-c');
const rollbackFlag = process.argv.includes('-rollback') || process.argv.includes('-r');
const backupFlag = process.argv.includes('-backup') || process.argv.includes('-b');
const deleteFlag = process.argv.includes('-delete') || process.argv.includes('-d');
const versionFlagIndex = process.argv.findIndex(arg => arg === '-version' || arg === '-v');
const forcedUpdateFlag = process.argv.includes('-forced') || process.argv.includes('-force');
const silentUpdateFlag = process.argv.includes('-silent');
const helpFlag = process.argv.includes('-help') || process.argv.includes('-h');
const minifyFlag = process.argv.includes('-minify') || process.argv.includes('-m');
const skipCompressedUploadFlag = process.argv.includes('-skipCompU') || process.argv.includes('-su');
const disableStatisticsFlag = process.argv.includes('-noLog') || process.argv.includes('-nl');
const generateFaviconsFlag = process.argv.includes('-genFavicons') || process.argv.includes('-gf');
const generateIconsFlag = process.argv.includes('-genIcons') || process.argv.includes('-gi');
const generateAppIconsFlag = process.argv.includes('-genAppIcons') || process.argv.includes('-ga');
const localFlag = process.argv.includes('-l') || process.argv.includes('-local');

function help() {
    if (helpFlag || process.argv.length === 2) {
        console.log(`        Usage: node pipeline [options]
        
        Options:
        -u, -update             Updates or creates the config.js and config-pipeline.js with necessary entries, orders them and exits
        -r, -root               Copies all files from /Birdhouse/root to the root directory and exits
        -v, -version <version>  Set the version number. Expected format is x, x.x, x.x.x, or x.x.x.x
        -v, -version            Increment the last part of the version number by 1
        -h, -help or [no flag]  Display this help message and exit
        -i, -info               Display detailed information about the process
        -c, -cache              (Re-)Generates the filesToCache.js file
        -d, -delete <-p|-s|-l>  Deletes the application production or staging directory from the server or clears the local dist directory
        -b, -backup             Creates a backup before deploying the new version that can be rolled back to.
        -r, -rollback           Rollback to the backup version, if on server (used with -p or -s)
        -nl,-nolog              No statistics logged and added to the log file
        -m, -minify             Minifies the files in filesToCache.js (before uploading them to the server)
        -p, -production         Release to production
        -s, -staging            Release to staging (is ignored if -p is set)
        -l, -local              Builds the project to the local dist directory and thereby skips the upload to the server (so -p and -s are ignored)
        -forced <-p|-s|-l>      Forces the update (triggers a page reload after the new version is cached on the user's device), without notifying the user
        -silent <-p|-s|-l>      Performs a silent update which does not display the update notification and becomes active after the next page reload
        -su,-skipCompU          Skips image compression and upload of the compressed folder
        -gf,-genFavicons        Creates favicons of all sizes from the original favicon and exits
        -gi,-genIcons           Creates icons of all sizes from the original icon and exits
        -ga,-genAppIcons        Creates .icon from the original icon and exits
        Note: The database folder is uploaded, but not added to the cached files.
        `);
        exitPipeline();
    }
}

let config = defaultPipelineConfig;
let sftpConfigFile = null;
if (!initializeFlag) {

    help();

    try {
        config = require('../pipeline-config.js');
    } catch (error) {
        console.log(`Error loading pipeline - config.js: ${error.message}`);
        process.exit(1);
    }

    if (!localFlag) {
        const sftpConfigFilePath = '../' + (config.sftpConfigFile ? config.sftpConfigFile : '../sftp-config.js');
        try {
            sftpConfigFile = require(sftpConfigFilePath);
        } catch (error) {
            console.log(`Error loading sftp config file(${sftpConfigFilePath}): ${error.message}`);
            process.exit(1);
        }
    }
}

async function importChalk() {
    if (!chalk) {
        chalk = (await import('chalk')).default;
    }
}

const ignoredFileTypes = config.ignoredFileTypes ? config.ignoredFileTypes : [];
const directoriesToInclude = config.directoriesToInclude;
const cacheFile = './Birdhouse/filesToCache.js';
const applicationPaths = {
    production: config.productionPath,
    staging: config.stagingPath
};

const sftpConfig = localFlag ? null : {
    host: sftpConfigFile ? sftpConfigFile.sftpHost : 'localhost',
    port: sftpConfigFile ? sftpConfigFile.sftpPort : 22,
    username: sftpConfigFile ? sftpConfigFile.sftpUsername : 'anonymous',
    password: sftpConfigFile ? sftpConfigFile.sftpPassword : ''
};

const minifiedDirectory = 'Birdhouse/minified';
const faviconsFileName = config.faviconsFileName;
const faviconPath = config.faviconPath;
const faviconsOutputDir = config.faviconsOutputDir;
const faviconSizes = config.faviconSizes.length > 0 ? config.faviconSizes : [16, 32, 64, 128, 152, 167, 180, 192, 196];
const statisticsFile = config.statisticsFile;
const compressedDir = config.compressedDir;
const uncompressedDir = config.uncompressedDir;
const htaccessFile = config.htaccessFile;
const databaseDir = config.databaseDir;
const manifestIconFileName = config.manifestIconFileName;
const manifestIconPath = config.manifestIconPath;
const manifestIconOutputDir = config.manifestIconOutputDir;
const manifestIconSizes = config.faviconSizes.length > 0 ? config.faviconSizes : [48, 72, 464, 3000];
const appIconSourcePath = config.appIconSourcePath;
const appIconOutputDir = config.appIconOutputDir;

const fileTypeCounts = {};
let fileTypeSizes = {};

async function main() {
    await importChalk();

    if (localFlag || productionFlag || stagingFlag) {
        createLock();
    }

    console.log('');

    if (initializeFlag) {
        console.log(chalk.green('Initializing project in ' + process.cwd()));
        await initializeProject();
        exitPipeline();
    }

    if ((productionFlag || stagingFlag || localFlag) && !deleteFlag && !rollbackFlag && config.preReleaseScripts.length > 0) {
        await runScriptsSequentially(config.preReleaseScripts)
            .then(() => {
                console.log('Execution of all pre release scripts finished.')
                console.log('');
            })
            .catch(error => console.error('An error occurred during pre release script execution:', error));
    }

    if (updateFlag) {
        await updateConfig();
        await updatePipelineConfig();
        exitPipeline();
    }

    if (updateRootFlag) {
        await updateRoot();
        exitPipeline();
    }

    if (generateFaviconsFlag) {
        await generateImageSizes(faviconPath, faviconsOutputDir, faviconsFileName, faviconSizes);
        exitPipeline();
    }

    if (generateIconsFlag) {
        await generateImageSizes(manifestIconPath, manifestIconOutputDir, manifestIconFileName, manifestIconSizes);
        exitPipeline();
    }

    if (generateAppIconsFlag) {
        await generateAppIcons(appIconSourcePath, appIconOutputDir);
        exitPipeline();
    }

    let missingConfigs = [];

    if (!config.ignoredFileTypes) missingConfigs.push('ignoredFileTypes');
    if (!config.directoriesToInclude) missingConfigs.push('directoriesToInclude');
    if (!config.productionPath) missingConfigs.push('productionPath');
    if (!config.stagingPath) missingConfigs.push('stagingPath');

    if (sftpConfigFile) {
        if (!sftpConfigFile.sftpHost) missingConfigs.push('sftpHost');
        if (!sftpConfigFile.sftpPort) missingConfigs.push('sftpPort');
        if (!sftpConfigFile.sftpUsername) missingConfigs.push('sftpUsername');
        if (!sftpConfigFile.sftpPassword) missingConfigs.push('sftpPassword');
    }

    if (missingConfigs.length > 0 && !localFlag) {
        console.error(`Error: Missing necessary configuration values in ${config.sftpConfigFile}:`, missingConfigs.join(', '));
        console.log('');
        process.exit(1);
    }

    const applicationPath = getApplicationPath();
    if (productionFlag || stagingFlag || localFlag) {
        await updateRoot();
        if (localFlag) {
            console.log(chalk.green(`Starting build process to ${config.distPath}...`));
        }
        else {
            console.log(chalk.green(`Starting ${productionFlag ? 'production' : 'staging'} ${deleteFlag ? 'deletion' : 'release'} process to ${applicationPath}...`));
        }
    }

    const currentVersion = await getCurrentVersion();
    let version = currentVersion;
    console.log(`Current version: ${currentVersion}`);

    if (versionFlagIndex !== -1) {
        const newVersion = getNewVersion(currentVersion);
        version = await updateVersion(newVersion);
    }
    else {
        version = await updateVersion(currentVersion);
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
    if (rollbackFlag && !localFlag) {
        await rollback(applicationPath);
    }
    else if (deleteFlag) {
        if (localFlag) {
            await clearDirectory(config.distPath);
        }
        else {
            await deleteDirectoryFromServer(applicationPath);
        }
    }
    else {
        await compressImages();

        if (localFlag) {
            console.log('');
            let filesToUpload = filesToCache;
            if (databaseDir) {
                filesToUpload = await readFilesFromDirectory(databaseDir, [...filesToCache]);
            }

            await copyFilesToLocalDirectory(filesToUpload, config.distPath, true);

            if (htaccessFile) {
                infoFlag && console.log(chalk.gray(`Copying ${htaccessFile} file as ".htacces" to ${config.distPath}...`));
                await fsPromises.copyFile(htaccessFile, path.join(config.distPath, '.htaccess'));
                infoFlag && console.log(chalk.gray('Copy successful'));
                infoFlag && console.log('');
            }

            console.log(chalk.green(`Build process to ${config.distPath} finished.`));
        } else {
            filesUploaded = await uploadFilesToServer(filesToCache, applicationPath) | 0;
        }
    }

    console.log('');
    if ((productionFlag || stagingFlag || localFlag) && !deleteFlag && !rollbackFlag && (filesUploaded > 0 || localFlag)) {
        console.log(chalk.green(`${localFlag ? 'Build' : 'Release'} process of version ${version} completed successfully.`));

        if ((productionFlag || stagingFlag) && !deleteFlag && !rollbackFlag && config.postReleaseScripts.length > 0) {
            await runScriptsSequentially(config.postReleaseScripts)
                .then(() => {
                    console.log('Execution of all post release scripts finished.')
                    console.log('');
                })
                .catch(error => console.error('An error occurred during post release script execution:', error));
        }

        if (localFlag) {
            loadConfig();
        }
    }
    else {
        console.log(chalk.green('Done.'));
    }

    const endTime = new Date();
    const elapsedTime = endTime - startTime;
    let minutes = Math.floor(elapsedTime / 60000);
    let seconds = ((elapsedTime % 60000) / 1000).toFixed(0);

    minutes = String(minutes).padStart(2, '0');
    seconds = String(seconds).padStart(2, '0');

    console.log(chalk.gray(`Elapsed time: ${minutes}:${seconds} minutes`));

    await addStatistics(`${minutes}:${seconds} minutes`, version, filesUploaded, filesToCache.length, cacheSize, minifiedSize);

    console.log('');
}

async function runScriptsSequentially(scriptPaths) {
    for (const scriptPath of scriptPaths) {
        console.log(`Executing script: ${scriptPath}`);
        try {
            const { stdout, stderr } = await execAsync(`node ${scriptPath}`);
            if (stdout) console.log(stdout);
            if (stderr) console.error('Error:', stderr);
        } catch (error) {
            console.error(`Failed to execute script ${scriptPath}:`, error);
        }
    }
    console.log(`${scriptPaths.length} ${scriptPaths.length > 1 ? 'scripts have' : 'script has'} been executed.`);
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
        console.log(chalk.yellow('Initializing project...'));
        console.log('');
        console.log('Copying files from root_EXAMPLE to root...');
        await copyDirectory(sourceDir, targetDir);
        console.log('');
        await updateConfig();
        await updatePipelineConfig();
        await updateRoot();
        console.log('');
        await generateImageSizes(faviconPath, faviconsOutputDir, faviconsFileName, faviconSizes);
        await generateImageSizes(manifestIconPath, manifestIconOutputDir, manifestIconFileName, manifestIconSizes);

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
            const minifiedStats = await fsPromises.stat(outputPath);
            totalSize += minifiedStats.size;
            if (infoFlag) {
                console.log(chalk.gray(`    Minified ${path.basename(file)}: ${originalSizeKB} KB > ${(minifiedStats.size / 1024).toFixed(2)} KB`));
            }
        } else if (file.endsWith('.css')) {
            const fileContent = await fsPromises.readFile(file, 'utf8');
            const result = new CleanCSS({}).minify(fileContent);
            if (result.errors.length > 0) throw result.errors;
            await fsPromises.writeFile(outputPath, result.styles, 'utf8');
            const minifiedStats = await fsPromises.stat(outputPath);
            totalSize += minifiedStats.size;
            if (infoFlag) {
                console.log(chalk.gray(`    Minified ${path.basename(file)}: ${originalSizeKB} KB > ${(minifiedStats.size / 1024).toFixed(2)} KB`));
            }
        }
        else {
            totalSize += originalStats.size;
            if (infoFlag) {
                console.log(chalk.gray(`    No minification for ${path.basename(file)}: ${originalSizeKB} KB`));
            }
        }

        bar.tick();
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
    console.log('');
    console.log(chalk.gray(`Compressing images...`));
    const compressedFiles = await compressImagesInDirectory(uncompressedDir, compressedDir);
    console.log(chalk.green(`Compressed ${compressedFiles} images`));

}

function isImageFile(filename) {
    const imageExtensions = ['.jpg', '.jpeg', '.png'];
    return imageExtensions.includes(path.extname(filename).toLowerCase());
}

async function compressImagesInDirectory(sourceDir, targetDir) {

    await ensureDirectoryExists(sourceDir);
    await ensureDirectoryExists(targetDir);

    let compressedFiles = 0;
    try {
        const entries = await fsPromises.readdir(sourceDir, { withFileTypes: true });

        for (const entry of entries) {
            const sourcePath = path.join(sourceDir, entry.name);
            const targetPath = path.join(targetDir, entry.name);

            if (entry.isDirectory()) {
                await fsPromises.mkdir(targetPath, { recursive: true });
                compressedFiles += await compressImagesInDirectory(sourcePath, targetPath);
            } else if (entry.isFile() && isImageFile(entry.name)) {
                if (infoFlag) console.log(chalk.gray(`Compressing: ${entry.name}`));

                try {
                    await sharp(sourcePath)
                        .resize(800)
                        .jpeg({ quality: 100 })
                        .toFile(targetPath);
                    compressedFiles++;
                    if (infoFlag) console.log(chalk.gray(`Compressed: ${entry.name}`));
                } catch (err) {
                    console.error(`Error compressing ${entry.name}: ${err}`);
                }
            }
        }
    } catch (err) {
        console.error(`Error reading directory: ${err}`);
    }
    return compressedFiles;
}

async function ensureDirectoryExists(dir) {
    try {
        await fsPromises.access(dir);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(chalk.gray(`Creating directory: ${dir}`));
            await fsPromises.mkdir(dir, { recursive: true });
        } else {
            throw error;
        }
    }
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
    newVersion = newVersion.replace(/-f|-s/g, '');
    console.log(forcedUpdateFlag ? 'Type: Forced Update' : silentUpdateFlag ? 'Type: Silent Update' : 'Type: Regular Update')
    newVersion = `${newVersion}${forcedUpdateFlag ? '-f' : silentUpdateFlag ? '-s' : ''}`;
    data = data.replace(/("version": ")(.*?)(",)/, `$1${newVersion}$3`);
    await fsPromises.writeFile(filePath, data, 'utf8');
    await updateVersionOnServiceWorker(newVersion);
    console.log(`Version updated to: ${newVersion}`);
    return newVersion;
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

async function readFilesFromDirectory(directory, files = []) {
    await ensureDirectoryExists(directory);

    infoFlag && console.log(chalk.gray(`Reading files from ${directory}...`));
    const filesInDirectory = await fsPromises.readdir(directory);
    for (const file of filesInDirectory) {
        const fullPath = path.join(directory, file);
        if (file.startsWith('.')) {
            infoFlag && console.log(chalk.gray(`    Skipping hidden file/folder: ${fullPath}`));
        }
        else if (fs.existsSync(fullPath)) {
            const stats = await fsPromises.stat(fullPath);
            if (stats.isDirectory()) {
                infoFlag && console.log(chalk.gray(`    Reading files from ${fullPath}...`));
                await readFilesFromDirectory(fullPath, files);
            } else {
                const fileType = path.extname(file);
                if (!ignoredFileTypes.includes(fileType)) {
                    infoFlag && console.log(chalk.gray(`    Adding ${fullPath} to files to cache...`));
                    files.push(fullPath.replace(/\//g, '/'));
                    fileTypeCounts[fileType] = (fileTypeCounts[fileType] || 0) + 1;
                    fileTypeSizes[fileType] = (fileTypeSizes[fileType] || 0) + stats.size;
                }
            }
        } else {
            console.log(`File does not exist: ${fullPath}`);
        }
    }
    return files;
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
        filesToCache = filesToCache.filter(file => !file.startsWith(config.compressedDir));
        if (infoFlag) {
            console.log(chalk.grey(`Files to cache after skipping compressed files in ${config.compressedDir}: `));
            filesToCache.forEach(file => console.log(chalk.grey(`    ${file} `)));
        }
    }
    let filesToUpload = [...filesToCache, './Birdhouse/filesToCache.js'];

    if (databaseDir) {
        await readFilesFromDirectory(databaseDir, filesToUpload);
    }

    //service worker is uploaded last to not trigger recaching on clients before all files are uploaded
    filesToUpload.sort((a, b) => {
        const filenameA = path.basename(a);
        const filenameB = path.basename(b);

        if (filenameA === 'service-worker.js') return 1;
        if (filenameB === 'service-worker.js') return -1;
        if (filenameA === 'config-sw.js') return 1;
        if (filenameB === 'config-sw.js') return -1;
        if (filenameA === 'config.js') return 1;
        if (filenameB === 'config.js') return -1;

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
        complete: '+',
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
        complete: '>',
        incomplete: ' ',
        width: 24,
        total: filesToUpload.length
    });

    for (const file of filesToUpload) {
        infoFlag && console.log(chalk.gray(`    Uploading: ${file}`));

        const preparedFilePath = await prepareFile(file);

        const relativeFilePath = file.replace(/^\.\/|^\//, '');
        const remotePath = `/${applicationPath}/${relativeFilePath.replace(/\\/g, '/')}`;

        await sftp.fastPut(preparedFilePath, remotePath);
        uploadBar.tick();

        if (preparedFilePath.endsWith('.temp')) {
            await fsPromises.unlink(preparedFilePath);
        }
    }

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

async function generateImageSizes(inputPath, outputDir, fileName, sizes) {
    if (!inputPath) {
        console.log(chalk.yellow('No input path for the original image specified. Skipping generation.'));
        return;
    }
    else if (!outputDir) {
        console.log(chalk.yellow('No output directory specified. Skipping generation.'));
        return;
    }
    else if (!fileName) {
        console.log(chalk.yellow('No file name specified. Skipping generation.'));
        return;
    }

    console.log(chalk.grey(`Generating ${sizes.length} "${fileName}"-images...`));

    if (!fs.existsSync(outputDir)) {
        console.log(chalk.grey(`Creating output directory: ${outputDir}`));
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const size of sizes) {
        try {
            const outputPath = path.join(outputDir, `${fileName}-${size}x${size}.png`);
            await sharp(inputPath)
                .resize(size, size)
                .toFile(outputPath);
            infoFlag && console.log(chalk.grey(`    Resized image to ${size}x${size} and saved to ${outputPath}`));
        } catch (err) {
            console.error(`Error resizing image to ${size}x${size}:`, err);
        }
    }

    console.log(chalk.green(`Images generated successfully`));
    console.log('');
}

async function generateAppIcons(inputPath, outputDir) {
    const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
    const fileName = path.basename(inputPath, path.extname(inputPath));

    console.log(chalk.grey(`Generating "${fileName}" app icons...`));

    if (!fs.existsSync(outputDir)) {
        console.log(chalk.grey(`Creating output directory: ${outputDir}`));
        fs.mkdirSync(outputDir, { recursive: true });
    }
    else {
        infoFlag && console.log(chalk.grey(`Output directory already exists: ${outputDir}`));
    }

    const icoImages = [];
    /* const icnsImages = []; */

    for (const size of sizes) {
        try {
            infoFlag && console.log(`    Resizing image to ${size}x${size}...`);
            const imgBuffer = await sharp(inputPath)
                .resize(size, size)
                .png()
                .toBuffer();

            if (size <= 256) {
                icoImages.push(imgBuffer);
            }

            /* if ([16, 32, 48, 128, 256, 512, 1024].includes(size)) {
                icnsImages.push({ size: `${size}x${size}`, data: imgBuffer });
            } */
        } catch (err) {
            console.error(chalk.grey(`    Error resizing image to ${size}x${size}:`, err));
        }
    }

    try {
        console.log('Generating ICO...');
        const ico = await toIco(icoImages);
        console.log('Writing ICO to disk...');
        fs.writeFileSync(path.join(outputDir, `${fileName}.ico`), ico);
        console.log(chalk.green(`ICO generated successfully`));
    } catch (err) {
        console.error('Error generating ICO:', err);
    }

    console.log('');
}

async function prepareFile(file) {
    infoFlag && console.log(chalk.grey(`    Preparing file: ${file}`));
    let localFilePath = path.join(minifiedDirectory, path.basename(file));
    localFilePath = fs.existsSync(localFilePath) && minifyFlag ? localFilePath : file;

    if (file.endsWith('index.html')) {
        const content = await fsPromises.readFile(localFilePath, 'utf-8');
        const root = parse(content);
        const baseTag = root.querySelector('base');

        if (config.basePath) {
            if (baseTag) {
                baseTag.setAttribute('href', config.basePath);
            } else {
                const head = root.querySelector('head');
                const newBaseTag = document.createElement('base');
                newBaseTag.setAttribute('href', config.basePath);
                head.prepend(newBaseTag);
            }
        } else {
            baseTag && baseTag.remove();
        }

        localFilePath += '.temp';
        await fsPromises.writeFile(localFilePath, root.toString());
    }
    return localFilePath;
}

async function copyFilesToLocalDirectory(filesToUpload, dir, clear = false) {
    infoFlag && console.log(chalk.grey(`Copying ${filesToUpload.length} files to local directory: ${dir}`));

    if (!dir) {
        console.log(chalk.yellow('No directory specified. Skipping copying.'));
        return;
    }

    if (typeof dir !== 'string') {
        throw new Error('The "dir" argument must be of type string. Received ' + typeof dir);
    }

    const distDir = path.resolve(dir);

    if (clear) {
        await clearDirectory(distDir);
    }

    await ensureDirectoryExists(distDir);

    for (const file of filesToUpload) {
        const preparedFile = await prepareFile(file);
        const relativePath = path.relative(process.cwd(), file);
        const destPath = path.join(distDir, relativePath);
        await ensureDirectoryExists(path.dirname(destPath));
        await fsPromises.copyFile(preparedFile, destPath);
        infoFlag && console.log(`File copied to dist directory: ${destPath}`);

        if (preparedFile.endsWith('.temp')) {
            await fsPromises.unlink(preparedFile);
        }
    }
}

async function ensureDirectoryExists(dir) {
    infoFlag && console.log(chalk.grey(`Ensuring directory exists: ${dir}`));
    try {
        await fsPromises.access(dir);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fsPromises.mkdir(dir, { recursive: true });
            infoFlag && console.log(`Directory created: ${dir}`);
        } else {
            throw error;
        }
    }
}

async function clearDirectory(dir) {
    infoFlag && console.log(chalk.grey(`Clearing directory: ${dir}`));
    try {
        await fsPromises.access(dir);
        await fsPromises.rm(dir, { recursive: true, force: true });
        console.log(`Directory cleared: ${dir}`);
        await fsPromises.mkdir(dir, { recursive: true });
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Directory not found, nothing to clear: ${dir}`);
            await fsPromises.mkdir(dir, { recursive: true });
        } else {
            throw error;
        }
    }
}

main().catch(err => console.error(() => {
    chalk.red('An error occurred in the pipeline:', err.message);
    exitPipeline();
})).then(() => exitPipeline());