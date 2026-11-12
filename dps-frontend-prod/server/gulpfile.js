const { src, dest, series, parallel, task } = require('gulp');
const fs = require('fs');
const log = require('fancy-log');
const { exec } = require('child_process');
const { build } = require('esbuild');
const pj = require('../package.json');

const paths = {
  prod_build: "../release",
  public_dir: "../public",
  angular_src: "../dist/dps-frontend/browser/**/*",
  angular_dist: "/app",
  zipped_file_name: "angular-nodejs.zip",
};

function clean(cb) {
  log('Removing the old files in the directory');
  fs.rm(paths.prod_build, { force: true, recursive: true }, (err) => {
    if (!err) {
      cb();
    } else {
      log(err);
    }
  });
}

function getZipName(cb) {
  log('Getting timestamp');
  const now = new Date();
  const time = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const outFile = `${pj.name}-${time}.zip`;
  paths.zipped_file_name = outFile;
  cb();
}

function createProdBuildFolder() {
  const dir = paths.prod_build;
  log(`Creating the folder if not exist ${dir}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
    log('? folder created:', dir);
  }
  return Promise.resolve('the value is ignored');
}

function buildServer() {
  log('building express server code into the directory');
  return build({
    entryPoints: ['server/server.ts'],
    bundle: true,
    platform: 'node',
    target: ['node22'],
    outfile: `${paths.prod_build}/server.cjs`,
    minify: true,
    sourcemap: false,
  }).catch((err) => log(err));
}

function copyAngularCodeTask() {
  log('copying Angular code into the directory');
  return src(`${paths.angular_src}`, { encoding: false })
    .pipe(dest(`${paths.prod_build}${paths.angular_dist}`));
}

function copyPublicContents(){
  log('Copying contents of public directory to release');
  return src([
        `${paths.public_dir}/**/*`,
        `${paths.public_dir}/.**/**`
      ], { base: `${paths.public_dir}` }
    )
    .pipe(dest(`${paths.prod_build}`));
}

function copyNodeJSCodeTask() {
  log('building and copying server code into the directory');
  return src(['package.json'])
    .pipe(dest(`${paths.prod_build}`));
}

async function zippingTask() {
  const { default: zip } = await import('gulp-zip');
  log('zipping the code');
  return src([`${paths.prod_build}/**/*`, `${paths.prod_build}/.**/**`], { encoding: false })
    .pipe(zip(`${paths.zipped_file_name}`))
    .pipe(dest(`${paths.prod_build}`));
}

const defaultTask = series(clean, getZipName, createProdBuildFolder, buildServer, parallel(copyAngularCodeTask, copyPublicContents, copyNodeJSCodeTask), zippingTask);
task('default', defaultTask);

module.exports = defaultTask;
