const fs    = require('fs');
const path  = require('path');
const exec  = require('child_process').exec;

const sdsFile  = process.argv[2];
if(sdsFile === undefined) {
    throw new Error("No sdsFile in script arguments");
}

const PDSregex = /([a-zA-Z0-9_-]+)\s+(PDS_PCH|PDS_I|PDS_PDS|PDS_VOID|PDS_PPDS)\s+[0-9]+\s?(.*)/gm;
const noRegex = /([a-zA-Z0-9_-]+):\s+([0-9]+)/gm;
function parse(str) {
    let results, PPDS_Name, CurrentPDS;
    let parseMap = new Map();

    const tObject = {};

    while( ( results = noRegex.exec(str) ) !== null) {
        const varName     = results[1];
        const varResult   = results[2];
        tObject[varName]  = varResult;
    }
    parseMap.set('pds_vars',tObject);

    while( ( results = PDSregex.exec(str) ) !== null) {
        let varName     = results[1];
        let varType     = results[2];
        let varValue    = results[3];

        if(varType === 'PDS_PCH' || varType === 'PDS_I') {
            const convertedValue = (varType === 'PDS_I') ? parseInt(varValue) : varValue;
            if(CurrentPDS !== undefined) {
                if(PPDS_Name !== undefined) {
                    parseMap.get(PPDS_Name)[CurrentPDS][varName] = convertedValue;
                }
                else {
                    parseMap.get(CurrentPDS).set(varName,convertedValue);
                }
            }
            else {
                parseMap.set(varName,convertedValue);
            }
        }
        else if(varType === 'PDS_PPDS') {
            PPDS_Name = varName;
            parseMap.set(varName,[]);
        }
        else if(varType === 'PDS_PDS') {
            CurrentPDS = varName;
            if(PPDS_Name === undefined) {
                parseMap.set(varName,new Map());
            }
            else {
                if(/^\d+$/.test(CurrentPDS)) {
                    parseMap.get(PPDS_Name)[varName] = {};
                }
                else {
                    PPDS_Name = null;
                    parseMap.set(varName,new Map());
                }
            }
        }
    }

    return parseMap;
}
 
/*exec(`qtool.exe -D out.txt -f ${sdsFile} -l -a -M2000 > output.txt`, (err, stdout, stderr) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(stdout);
});*/

console.time('start_parse');

const buf = fs.readFileSync('log.txt');
const lineStr = buf.toString().split('\n');
const pdsTables = [];

let finalStr;
lineStr.forEach( str => {
    if(str.includes('count')) {
        if(finalStr !== undefined) {
            pdsTables.push(finalStr);
        }
        finalStr = '';
        finalStr+=str;
    }
    else {
        finalStr+=str;
    }
});
const finalTables = [];

for(let i = 0;i<pdsTables.length;i++) {
    const str = parse(pdsTables[i]);
    if(str !== undefined) {
        finalTables.push(str);
    }
}

console.timeEnd('start_parse');

console.log(finalTables[0]);
