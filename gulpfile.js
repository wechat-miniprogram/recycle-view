const path = require('path');

const gulp = require('gulp');
const clean = require('gulp-clean');
const less = require('gulp-less');
const rename = require('gulp-rename');
const gulpif = require('gulp-if');
const sourcemaps = require('gulp-sourcemaps');
const webpack = require('webpack');
const gulpWebpack = require('webpack-stream');
const gulpInstall = require('gulp-install');

const config = require('./tools/config');
const checkComponents = require('./tools/checkcomponents');
const _ = require('./tools/utils');

const srcPath = config.srcPath;
const distPath = config.distPath;
const wxssConfig = config.wxss || {};

let componentListMap = [];
let cachedComponentListMap = [];

/**
 * get wxss stream
 */
function wxss(wxssFileList) {
    if (!wxssFileList.length) return;

    return gulp.src(wxssFileList, { cwd: srcPath, base: srcPath })
        .pipe(gulpif(wxssConfig.less && wxssConfig.sourcemap, sourcemaps.init()))
        .pipe(gulpif(wxssConfig.less, less({ paths: [srcPath] })))
        .pipe(rename({ extname: '.wxss' }))
        .pipe(gulpif(wxssConfig.less && wxssConfig.sourcemap, sourcemaps.write('./')))
        .pipe(_.logger(wxssConfig.less ? 'generate' : undefined))
        .pipe(gulp.dest(distPath));
}

/**
 * get js stream
 */
const webpackWatcher = null;
function js(jsFileMap) {
    let webpackConfig = config.webpack;
    let webpackCallback = (err, stats) => {
        if (!err) {
            console.log(stats.toString({
                assets: true,
                cached: false,
                colors: true,
                children: false,
                errors: true,
                warnings: true,
                version: true,
                modules: false,
                publicPath: true,
            }));
        } else {
            console.log(err);
        }
    };

    webpackConfig.entry = jsFileMap;
    if (webpackWatcher) webpackWatcher.close();

    if (config.isWatch) {
        webpack(webpackConfig).watch({
            ignored: /node_modules/,
        }, webpackCallback);
    } else {
        webpack(webpackConfig).run(webpackCallback);
    }
}

/**
 * copy file
 */
function copy(copyFileList) {
    if (!copyFileList.length) return;

    return gulp.src(copyFileList, { cwd: srcPath, base: srcPath })
        .pipe(_.logger())
        .pipe(gulp.dest(distPath));
}

/**
 * install packages
 */
function install() {
    return gulp.series(async () => {
        let demoDist = config.demoDist;
        let demoPackageJsonPath = path.join(demoDist, 'package.json');
        let packageJson = _.readJson(path.resolve(__dirname, 'package.json'));
        let dependencies = packageJson.dependencies || {};

        await _.writeFileSync(demoPackageJsonPath, JSON.stringify({ dependencies }, null, '\t')); // write dev demo's package.json
    }, () => {
        let demoDist = config.demoDist;
        let demoPackageJsonPath = path.join(demoDist, 'package.json');

        return gulp.src(demoPackageJsonPath)
            .pipe(gulpInstall({ production: true }));

    });
}

/**
 * clean the dist folder
 */
gulp.task('clean-dist', () => {
    return gulp.src(distPath, { read: false, allowEmpty: true })
        .pipe(clean());
});

/**
 * clean the generated folders and files
 */
gulp.task('clean', gulp.series('clean-dist', () => {
    return gulp.src(config.demoDist, { read: false, allowEmpty: true })
        .pipe(clean());
}));

/**
 * copy demo to the dev folder
 */
let isDemoExists = false 
gulp.task('demo', gulp.series(async () => {
    let demoDist = config.demoDist;
    
    isDemoExists = await _.checkFileExists(path.join(demoDist, 'project.config.json'));
}, done => {
    if (!isDemoExists) {
        let demoSrc = config.demoSrc;
        let demoDist = config.demoDist;

        return gulp.src('**/*', { cwd: demoSrc, base: demoSrc })
            .pipe(gulp.dest(demoDist));
    }

    return done();
}));

/**
 * install packages for dev
 */
gulp.task('install', install());

/**
 * check custom components
 */
gulp.task('component-check', async () => {
    let newComponentListMap = await checkComponents();

    cachedComponentListMap = componentListMap;
    componentListMap = newComponentListMap;
});

/**
 * write json to the dist folder
 */
gulp.task('component-json', () => {
    return copy(componentListMap.jsonFileList);
});

/**
 * copy wxml to the dist folder
 */
gulp.task('component-wxml', done => {
    if (!_.compareArray(cachedComponentListMap.wxmlFileList, componentListMap.wxmlFileList)) {
        return copy(componentListMap.wxmlFileList);
    }

    done();
});

/**
 * generate wxss to the dist folder
 */
gulp.task('component-wxss', done => {
    if (!_.compareArray(cachedComponentListMap.wxssFileList, componentListMap.wxssFileList)) {
        return wxss(componentListMap.wxssFileList);
    }

    done();
});

/**
 * generate js to the dist folder
 */
gulp.task('component-js', done => {
    if (!_.compareArray(cachedComponentListMap.jsFileList, componentListMap.jsFileList)) {
        js(componentListMap.jsFileMap);
    }

    done();
});

/**
 * copy resources to dist folder
 */
gulp.task('copy', gulp.parallel(() => {
    let copyList = config.copy || [];
    let copyFileList = copyList.map(dir => path.join(dir, '**/*.!(wxss)'));

    return copy(copyFileList);
}, () => {
    let copyList = config.copy || [];
    let copyFileList = copyList.map(dir => path.join(dir, '**/*.wxss'));

    return wxss(copyFileList);
}));

/**
 * watch json
 */
gulp.task('watch-json', () => {
    return gulp.watch(componentListMap.jsonFileList, { cwd: srcPath, base: srcPath }, gulp.series('component-check', gulp.parallel('component-wxml', 'component-wxss', 'component-js', 'component-json')));
});

/**
 * watch wxml
 */
gulp.task('watch-wxml', () => {
    cachedComponentListMap.wxmlFileList = null;
    return gulp.watch(componentListMap.wxmlFileList, { cwd: srcPath, base: srcPath }, gulp.series('component-wxml'));
});

/**
 * watch wxss
 */
gulp.task('watch-wxss', () => {
    cachedComponentListMap.wxssFileList = null;
    return gulp.watch('**/*.wxss', { cwd: srcPath, base: srcPath }, gulp.series('component-wxss'));
});

/**
 * watch resources
 */
gulp.task('watch-copy', () => {
    let copyList = config.copy || [];
    let copyFileList = copyList.map(dir => path.join(dir, '**/*'));
    let watchCallback = (filePath, stats) => {
        if (path.extname(filePath) === '.wxss') {
            return wxss([filePath]);
        } else {
            return copy([filePath]);
        }
    };

    return gulp.watch(copyFileList, { cwd: srcPath, base: srcPath })
        .on('change', watchCallback)
        .on('add', watchCallback)
        .on('unlink', watchCallback);
});

/**
 * watch installed packages
 */
gulp.task('watch-install', () => {
    return gulp.watch(path.resolve(__dirname, 'package.json'), install());
});

/**
 * build custom component
 */
gulp.task('build', gulp.series('clean-dist', 'component-check', gulp.parallel('component-wxml', 'component-wxss', 'component-js', 'component-json', 'copy')));

gulp.task('watch', gulp.series('build', 'demo', 'install', gulp.parallel('watch-wxml', 'watch-wxss', 'watch-json', 'watch-copy', 'watch-install')));

gulp.task('dev', gulp.series('build', 'demo', 'install'));

gulp.task('default', gulp.series('build'));
