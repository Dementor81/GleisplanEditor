# Gleisplan Editor - Deployment Guide

This document provides instructions for deploying the Gleisplan Editor project to a remote web server. The process is designed to be simple, secure, and automated.

## Deployment Overview

The deployment process is managed by a single command that automates the following steps:
1.  **Build:** The project is bundled for production using webpack. This process creates an optimized set of files in the `www/dist` directory.
2.  **Copy Assets:** All necessary static assets (images, fonts, stylesheets, etc.) are copied into the `www/dist` directory to create a self-contained, deployable package.
3.  **Deploy:** The contents of the `www/dist` directory are securely uploaded to the remote server using `rsync` over SSH.

## Key Components

### `npm run deploy`
This is the main command you will use to deploy the project. It's a script defined in `package.json` that executes the `deploy.sh` script.

### `deploy.sh`
This is the core deployment script. It handles the build process and the file transfer to the remote server. The script is configured with your server's details (user, host, and target directory).

### `sshpass` and the `.password` file
To handle the server login securely without SSH keys, we use `sshpass`. The script reads the server password from a local, untracked file named `.password`. This prevents your password from being stored in version control.

## Prerequisites

Before you can deploy, you need to have the following installed on your local machine:
- Node.js and npm
- `sshpass` (You can install it via Homebrew: `brew install sshpass`)

## One-Time Setup

1.  **Configure `deploy.sh`**:
    Open `deploy.sh` and ensure the following variables are set correctly for your server:
    - `REMOTE_USER`: Your SSH username.
    - `REMOTE_HOST`: Your server's hostname or IP address.
    - `REMOTE_TARGET_DIR`: The destination directory on your server.

2.  **Set Your Password**:
    Open the `.password` file in the root of the project and replace the placeholder text with your actual server password. This file is already in `.gitignore`, so it will not be committed.

## How to Deploy

Once the one-time setup is complete, you can deploy your project at any time by running a single command in your terminal:

```bash
npm run deploy
```

This command will build the latest version of your project and upload it to the server. You can monitor the progress in your terminal. When the script finishes, your changes will be live. 