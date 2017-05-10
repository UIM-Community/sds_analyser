const fs        = require('fs');
const path      = require('path');
const exec      = require('child_process').exec;

const config    = require('./config.json');
const filters   = config.filters;

const sdsFile   = process.argv[2];
if(sdsFile === undefined) {
    throw new Error("No sdsFile in script arguments");
}

const PDSregex = /([a-zA-Z0-9_-]+)\s+(PDS_PCH|PDS_I|PDS_PDS|PDS_VOID|PDS_PPDS)\s+[0-9]+\s?(.*)/gm;
const noRegex = /([a-zA-Z0-9_-]+):\s+([0-9]+)/gm;
function parse(str) {
    let results, PPDS_Name, CurrentPDS;
    let parseMap = new Map();

    while( ( results = noRegex.exec(str) ) !== null) {
        parseMap.set(results[1],results[2]);
    }

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
let finalTables = [];

for(let i = 0;i<pdsTables.length;i++) {
    const str = parse(pdsTables[i]);
    if(str !== undefined) {
        finalTables.push(str);
    }
}

finalTables = finalTables.filter( PDS => {
    for(let k in filters) {
        let fStr = filters[k];
        let fRegex;
        let find = false;

        try {
            if(PDS.get('udata').get('values').has(k) === true) {
                fRegex = PDS.get('udata').get('values').get(k);
                find = true;
            }
        }
        catch(Err) {};

        try {
            if(PDS.get('udata').has(k) === true && find === false) {
                fRegex = PDS.get('udata').get(k);
                find = true;
            }
        }
        catch(Err) {};

        if(find === false) {
            if(PDS.has(k) === false) return false;
            fRegex = PDS.get(k);
        }

        try {
            if(new RegExp(fStr).test(fRegex) === false) return false;
        }
        catch(Err) {
            return false;
        }
    }
    return true;
})

const wS = fs.createWriteStream('final_pds.txt');
finalTables.forEach( eMap => {
    wS.write(JSON.stringify([...eMap])+"\n");
});

wS.on('end',() => {
    process.exit(0);
});
