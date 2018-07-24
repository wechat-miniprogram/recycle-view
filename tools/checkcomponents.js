const path = require('path');

const _ = require('./utils');
const config = require('./config');

const srcPath = config.srcPath;

/**
 * check included components
 */
const checkProps = ['usingComponents', 'componentGenerics'];
async function checkIncludedComponents(jsonPath, componentListMap) {
    let json = _.readJson(jsonPath);
    if (!json) throw new Error(`json is not valid: "${jsonPath}"`);
    
    let dirPath = path.dirname(jsonPath);
    let fileName = path.basename(jsonPath, '.json');
    let relative = path.relative(srcPath, dirPath);
    let fileBase = path.join(relative, fileName);

    for (let checkProp of checkProps) {
        let checkPropValue = json[checkProp] || {};
        let keys = Object.keys(checkPropValue);

        for (let key of keys) {
            let value = typeof checkPropValue[key] === 'object' ? checkPropValue[key].default : checkPropValue[key];
            if (!value) continue;

            value = _.transformPath(value, path.sep);

            // check relative path
            let componentPath = `${path.join(dirPath, value)}.json`;
            let isExists = await _.checkFileExists(componentPath);
            if (isExists) {
                await checkIncludedComponents(componentPath, componentListMap);
            }
        }
    }

    // checked
    componentListMap.wxmlFileList.push(`${fileBase}.wxml`);
    componentListMap.wxssFileList.push(`${fileBase}.wxss`);
    componentListMap.jsonFileList.push(`${fileBase}.json`);
    componentListMap.jsFileList.push(`${fileBase}.js`);

    componentListMap.jsFileMap[fileBase] = `${path.join(dirPath, fileName)}.js`;
}

module.exports = async function() {
    let componentListMap = {
        wxmlFileList: [],
        wxssFileList: [],
        jsonFileList: [],
        jsFileList: [],

        jsFileMap: {}, // for webpack entry
    };
    let entry = path.join(srcPath, `${config.entry}.json`);

    let isExists = await _.checkFileExists(entry);
    if (!isExists) throw new Error(`json not exists: "${entry}"`);

    await checkIncludedComponents(entry, componentListMap);

    return componentListMap;
};
