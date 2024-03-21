<p align="center">
  <img src="https://birdhouse-js.com/img/icons/Icon-3000x3000.png" width="200">
</p>

# **Birdhouse**

## Introduction

**Birdhouse** is a Vanilla JavaScript framework for Single Page Applications and supports easy Progressive Web App rollouts through its NodeJS Pipeline. Birdhouse is primarily designed for deployment to Apache Webserver Webspaces via SFTP. However, with necessary modifications, it can also be adapted for use in other environments. Everything is provided as is.

The Framework is a lightweight way to have a web app that mainly utilizes the resources of the users device. You can always integrate a backend, that allows for more functionality, but this framework is aimed at providing full offline capabilities to the enduser.

## Quick Start

Follow these steps to get the project up and running on your local machine:

1. Clone the repository from GitHub. **The Birdhouse repo has to be in the `Birdhouse`-subdirectory of your project.** If you have [Git](https://git-scm.com/downloads) installed on your machine, you can do this by navigating to your project directory and executing the following command:

    ```bash
    git clone https://github.com/HousebirdGames/Birdhouse.git
    ```

    **OR**

    If your project is already using Git, it's recommended to add **Birdhouse** as a submodule (this can also be done later). To do this, use the following command:

    ```bash
    git submodule add https://github.com/HousebirdGames/Birdhouse ./Birdhouse
    ```

2. Change your current directory to the one that was created when you cloned the repository:

    ```bash
    cd Birdhouse
    ```

3. Install the project pipeline dependencies and initialize the project:

    ```bash
    npm start
    ```

**Note:** If you ever change the name of you project directory, remember to update the localhost `.htaccess` file to reflect the new directory name.

At this point, you're ready to configure your project. You'll find the configuration files your root directory:

- `config.js`: This file contains the main configuration for the project.
- `pipeline-config.js`: This file contains the configuration for the deployment pipeline.

Open these files in your text editor and adjust the settings to match your project's requirements.

Once you've finished configuring the project, you can run it on your local machine. If you're using [XAMPP](https://www.apachefriends.org/index.html), start the XAMPP control panel, ensure Apache is running, and then navigate to the project in your web browser.

**Important:** Do not change the service-worker.js. It will get recopied to root on deployment and on root updates.

## Project Structure

To utilize the pipeline, ensure you're in the Birdhouse directory by executing:

```bash
cd Birdhouse
```

Avoid making changes to the files in the Birdhouse directory, as future updates to the Birdhouse repository may overwrite them. To generate or update the configuration files (except `sftp-config.js`) in your root folder, execute the following command:
```NODE
node pipeline -u
```

To generate or update the necessary root files (including `sftp-config.js.EXAMPLE`), use this command:
```NODE
node pipeline -r
```

To learn more about the available command line options, keep reading the sections below.

**Important:** Keep all changes you make inside the `custom` folder, so that you can always update the framework or just put your `custom` folder in a new one.

## The Pipeline

### Key Features of `pipeline.js`:

- Incremental versioning control.
- Directory and file cache management.
- SFTP upload functionality.
- Support for multiple deployment paths (production/staging).
- Clean and user-friendly console interface with progress indicators and colored output.
- Command line flexibility for different deployment scenarios.
  
Ensure to keep the `pipeline-config.js` updated with any changes in project structure or deployment requirements.

## Release Process

**Note:** You should configure the `manifest.json`, `sitemap.xml` and `robots.txt` to fit your project.

The `pipeline.js` script streamlines the release process. It will automatically compress any images from `uncompressedDir` to the `compressedDir`.

### Steps:

**First:** Configure the pipeline in `pipeline-config.js`.
**Second:** Configure the `sftp-config.js`.

Make sure your are in the Birdhouse directory:
```bash
cd Birdhouse
```

1. Run `npm install` to install dependencies, if you haven't already.
2. Execute the script `node pipeline.js`. This begins the release process.
3. Use the `-c` option to update the cache file list and the `-m` option to minify .js and .css files before uploading them.
4. Use `-p` to upload the web app via SFTP to production.
5. To specify a new version, use `-v` or `-version` followed by the number or without a number for an incremental version change.

**Example:**
```NODE
pipeline.js -p -c -m -v 1.2.3.4
```

**Important:** Some files (like `service-worker-js`) are placed within `Birdhouse/root` and will be copied to the root of the project. This will be done automatically on deployment, but can also be triggered with the `-root`-flag.

### Command Line Options (most can be combined):

- `-help`, `-h` or no flag: Display help message and exit. **(STRONGLY RECOMMENDED to get more detailed and up to date information)**
- `-update` or `-u`: Updates or creates the config.js and config-pipeline.js with necessary entries, orders them and exits.
- `-root` or `-r`: Copies all files from /Birdhouse/root to the root directory and exits.
- `-production` or `-p`: Release to the production environment.
- `-staging` or `-s`: Release to the staging environment.
- `-version` or `-v`: Update the version of the `service-worker.js`.
- `-cache` or `-c`: (Re-)Generate the `filesToCache.js` file.
- `-minify` or `-m`: Minifies the files in filesToCache.js (before uploading them to the server; if not set, the original files will be uploaded).
- `-delete` or `-d`: Delete the application directory (production or staging) from the server.
- `-backup` or `-b`: Creates a backup before deploying the new version that can be rolled back to.
- `-rollback` or `-r`: Rollback to the backup version of either staging (`-s`) or production (`-p`), when available on the server.
- `-info` or `-i`: Display detailed information about the process.
- `-skipCompU` or `-su`: Skips image compression and upload of the compressed folder, which is faster in some scenarios, where repeated uploads of the folder are not neccessary.
- `-genfavicons` or `-gf`: Creates favicons of all specified (or the default) sizes from the original favicon and exits after that.
- `-genicons` or `-gi`: Creates icons of all specified (or the default) sizes from the original icon and exits after that.

The script automates various tasks, including version number updates, cache list generation, and file uploads to the server. Ensure you have the necessary permissions for file operations and SFTP server access.
