const fs = require('fs');
const path = require('path');
const cp = require('cp');

const previousArtifactsPath = path.join(__dirname, 'artifacts');
const targetArtifactPath = path.join(__dirname, '.coverage_artifacts');

function copyFiles(config) {
    fs.readdir(previousArtifactsPath, (err, files) => {
        if (err) console.log(err);
        
        if (files) {
            files.forEach(file => {
                cp(path.join(previousArtifactsPath, file), path.join(targetArtifactPath, file), err => {
                    if (err) throw err;
                    console.log(`Moving ` + file);
                });
            })
        }
    })
}

module.exports = {
    providerOptions: {
        "default_balance_ether": 100000000000000,
        "total_accounts": 20
    },
    skipFiles: ['mock/'],
    istanbulReporter: ['html','json'],
    onCompileComplete: copyFiles
}
