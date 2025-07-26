#!/bin/bash

# Deployment script for GleisplanEditor
# This script builds the project and deploys it to a remote server using rsync.

# --- Configuration ---
# Replace the following placeholders with your actual server details.

# SSH user for your remote server
REMOTE_USER="mmetzdorf"

# Hostname or IP address of your remote server
REMOTE_HOST="zugfunk-podcast.de"

# The directory on your remote server where the files should be deployed.
# Example: /var/www/gleisplan-editor
REMOTE_TARGET_DIR="web/signal/bahnhof/"

# The local directory containing the build artifacts to be deployed.
# This should match the output path in your webpack.config.js
SOURCE_DIR="www/dist/"

# --- Deployment Steps ---

# 1. Build the project
echo "Building project for production..."
npm run build

# Check if the build was successful
if [ $? -ne 0 ]; then
  echo "❌ Build failed. Aborting deployment."
  exit 1
fi
echo "✅ Build complete."

# 2. Deploy files using rsync
# The -a flag is for archive mode (preserves permissions, etc.)
# The -v flag is for verbose output.
# The -z flag compresses file data during the transfer.
# The --delete flag removes files on the server that are not in the source directory.
echo "🚀 Deploying files to ${REMOTE_HOST}..."
sshpass -f .password rsync -avz --delete "${SOURCE_DIR}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_TARGET_DIR}"

# Check if rsync was successful
if [ $? -eq 0 ]; then
  echo "✅ Deployment successful!"
  echo "Visit your site to see the changes."
else
  echo "❌ Deployment failed."
  exit 1
fi 