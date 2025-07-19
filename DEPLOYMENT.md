# Gleisplan Editor - Deployment Guide

## Overview

This guide covers everything you need to deploy the Gleisplan Editor project to production. The project uses webpack for bundling and can be deployed to any static web server.

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- A web server or hosting service

## Build Process

### Development Build
```bash
npm run build:dev
```
- Creates unminified bundle with source maps
- Larger file size (~699KB)
- Easier debugging
- Use for testing

### Production Build
```bash
npm run build
```
- Creates optimized, minified bundle (~101KB)
- Includes content hash for cache busting
- Smaller file size, faster loading
- Use for deployment

### Quick Deploy Command
```bash
npm run deploy
```
- Runs production build
- Shows confirmation message
- Files ready in `www/dist/`

## Files Required for Deployment

### Generated Files (from `www/dist/`)
After running `npm run build`, these files are automatically generated:

- `start.html` - Main application entry point (auto-generated with correct bundle references)
- `bundle.[hash].js` - Optimized JavaScript bundle
- `bundle.[hash].js.map` - Source map (optional, for debugging)

### Static Assets (from `www/`)
Copy these files and folders to your web server:

#### Required Files:
- `favicon.ico`
- `logo.svg` 
- `start.css`
- `gleisplan.png`
- `welcome.png`
- `train-front.svg`
- `check.svg`
- `zug.png`
- `prebuilds.xml`

#### Required Folders:
- `dev/` - Bootstrap, jQuery, CreateJS dependencies
- `font/` - Custom fonts
- `images/` - Signal and track images with JSON data
- `intro_1.jpg`, `intro_2.jpg`, `intro_3.jpg` - Intro images

## Deployment Steps

### Step 1: Build for Production
```bash
cd /path/to/your/project
npm run deploy
```

### Step 2: Prepare Deployment Package
Create a deployment folder with the following structure:
```
deployment/
├── index.html (copy from www/dist/start.html)
├── bundle.[hash].js (from www/dist/)
├── bundle.[hash].js.map (from www/dist/)
├── favicon.ico
├── logo.svg
├── start.css
├── gleisplan.png
├── welcome.png
├── train-front.svg
├── check.svg
├── zug.png
├── prebuilds.xml
├── dev/
│   ├── bootstrap-5.3.3/
│   ├── jquery-3.7.1.min.js
│   └── createjs.js
├── font/
│   ├── D-DINCondensed.otf
│   └── intodotmatrix.ttf
├── images/
│   ├── basis.json
│   ├── basis.png
│   ├── hv.json
│   ├── hv.png
│   ├── ks.json
│   ├── ks.png
│   ├── ls.json
│   ├── ls.png
│   ├── schwellen.png
│   ├── bumper1.svg
│   ├── weiche.svg
│   ├── weiche2.svg
│   ├── dkw.svg
│   ├── dkw2.svg
│   └── kleineisen.png
├── intro_1.jpg
├── intro_2.jpg
└── intro_3.jpg
```

### Step 3: Upload to Server
Upload all files to your web server's document root or a subdirectory.


### Essential Commands
```bash
# Install dependencies
npm install

# Development server
npm run start

# Development build
npm run build:dev

# Production build
npm run build

# Deploy (build + confirmation)
npm run deploy

# Analyze bundle
npm run analyze
```

### File Locations
- **Source**: `www/code/`
- **Build output**: `www/dist/`
- **Static assets**: `www/`
- **Config**: `webpack.config.js`
- **Dependencies**: `package.json`

This deployment guide should provide everything needed to successfully deploy the Gleisplan Editor project to production. 