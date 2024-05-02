/*
This feature is in an experimental state and may not be suitable for all use cases. Please use with caution and report any issues you encounter.


This Node.js script automates the local development process by watching for file changes, running the build pipeline,
and restarting a local server. It is designed solely for local development, not for production use, and simulates an Apache server
environment to maintain consistency between development and production setups.


The script uses Chokidar to monitor changes in the project root, excluding its own directory, and manages a local server
process that is restarted whenever the build completes successfully.


Please note that you will still need to manually reload your browser to see the changes.
To use the script, cd into the 'Birdhouse' directory and then use `node server` or `npm run serve`.


To specify the port the server should run on, you can pass it as an argument, e.g., `node serve 3000` or `npm run serve 3000`.


You can utilize all standard pipeline flags such as -c, -v, -m, -forced, -silent, and -nl to customize the automatic build process.
By default, the build is configured with -c -v -m -l -forced -nl. The -l flag is always included to ensure the build is local,
overriding any -production (-p) or -staging (-s) flags.
*/

const fs = require('fs');
const { spawn, exec } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const lockFilePath = path.join(projectRoot, 'Birdhouse/pipeline.lock');
const defaultPort = 4200;
let isBuilding = false;
let serverProcess = null;

function startServer(port = defaultPort) {
    if (serverProcess) {
        console.log('Stopping the current server...');
        serverProcess.kill('SIGTERM');
    }

    console.log(`Starting the server on port ${port}...`);
    serverProcess = spawn('node', ['server.js', port], {
        cwd: path.join(projectRoot, 'Birdhouse'),
        stdio: 'inherit'
    });

    serverProcess.on('close', (code) => {
        if (code !== null) {
            console.log(`Server process exited with code ${code}`);
        }
    });
}

const runPipelineAndRestartServer = () => {
    if (fs.existsSync(lockFilePath)) {
        return;
    }

    if (isBuilding) {
        return;
    }
    isBuilding = true;
    console.log('Changes detected. Running the build pipeline...');

    const args = process.argv.slice(2);

    let port = defaultPort;
    const flags = [];

    if (!isNaN(args[0]) && Number.isInteger(parseFloat(args[0]))) {
        port = parseInt(args[0]);
        args.shift();
    }

    flags.push(...args.filter(arg => arg.startsWith('-')));

    if (flags.length === 0) {
        args.push('-c', '-v', '-m', '-l', '-forced', '-nl');
    }

    if (!args.includes('-l')) {
        args.push('-l');
    }

    const pipeline = exec(`node pipeline ${args.join(' ')}`, {
        cwd: path.join(projectRoot, 'Birdhouse')
    });

    pipeline.stdout.on('data', (data) => {
        console.log(data.toString());
    });

    pipeline.stderr.on('data', (data) => {
        console.error(data.toString());
    });

    pipeline.on('close', (code) => {
        isBuilding = false;
        if (code === 0) {
            console.log('Restarting...');
            startServer(port);
        } else {
            console.error(`Build failed with exit code ${code}`);
        }
    });
};

const watcher = chokidar.watch(projectRoot, {
    ignored: [path.join(projectRoot, 'Birdhouse/**'), /(^|[\/\\])\../],
    ignoreInitial: true
});

watcher.on('change', runPipelineAndRestartServer);
watcher.on('add', runPipelineAndRestartServer);

runPipelineAndRestartServer();

console.log('Watching for file changes in the project root...');