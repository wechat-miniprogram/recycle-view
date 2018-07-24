const fs = require('fs');
const path = require('path');

const colors = require('colors');
const through = require('through2');

/**
 * async function wrapper
 */
function wrap(func, scope) {
    return function(...args) {
        if (args.length) {
            let temp = args.pop();
            if (typeof temp !== 'function') {
                args.push(temp);
            }
        }

        return new Promise(function(resolve, reject) {
            args.push(function(err, data) {
                if(err) reject(err);
                else resolve(data);
            });

            func.apply((scope || null), args);
        });
    };
}

const accessSync = wrap(fs.access);
const readFileSync = wrap(fs.readFile);
const writeFileSync = wrap(fs.writeFile);

/**
 * transform path segment separator
 */
function transformPath(filePath, sep = '/') {
  return filePath.replace(/[\\\/]/g, sep);
}

/**
 * check file exists
 */
async function checkFileExists(filePath) {
    try {
        await accessSync(filePath);
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * read json
 */
function readJson(filePath) {
    try {
        let content = require(filePath);
        delete require.cache[require.resolve(filePath)];
        return content;
    } catch (err) {
        return null;
    }
}

/**
 * read file
 */
async function readFile(filePath) {
    return await readFileSync(filePath, 'utf8');
}

/**
 * time format
 */
function format(time, reg) {
    let date = typeof time === 'string' ? new Date(time) : time;
    let map = {};
    map.yyyy = date.getFullYear();
    map.yy = ('' + map.yyyy).substr(2);
    map.M = date.getMonth() + 1;
    map.MM = (map.M < 10 ? '0' : '') + map.M;
    map.d = date.getDate();
    map.dd = (map.d < 10 ? '0' : '') + map.d;
    map.H = date.getHours();
    map.HH = (map.H < 10 ? '0' : '') + map.H;
    map.m = date.getMinutes();
    map.mm = (map.m < 10 ? '0' : '') + map.m;
    map.s = date.getSeconds();
    map.ss = (map.s < 10 ? '0' : '') + map.s;

    return reg.replace(/\byyyy|yy|MM|M|dd|d|HH|H|mm|m|ss|s\b/g, $1 => {
        return map[$1];
    });
}

/**
 * logger plugin
 */
function logger(action = 'copy') {
    return through.obj(function(file, enc, cb) {
        let type = path.extname(file.path).slice(1).toLowerCase();

        console.log(`[${format(new Date(), 'yyyy-MM-dd HH:mm:ss').grey}] [${action.green} ${type.green}] ${'=>'.cyan} ${file.path}`);

        this.push(file);
        cb();
    });
}

/**
 * compare arrays
 */
function compareArray(arr1, arr2) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
    if (arr1.length !== arr2.length) return false;

    for (let i = 0, len = arr1.length; i < len; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }

    return true;
}

module.exports = {
    wrap,
    writeFileSync,
    transformPath,

    checkFileExists,
    readJson,
    readFile,

    logger,
    format,
    compareArray,
};
