#!/usr/bin/env node

const path = require('path');
const sanityClient = require('@sanity/client');
const exportDataset = require('@sanity/export');
const Configstore = require('configstore');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
const config = new Configstore('sanity', {}, { globalConfigPath: true });
const token = config.get('authToken');
const projectId = process.argv[2] || process.env.SANITY_PROJECT_ID;
const compress = true;

const client = sanityClient({
    projectId: projectId,
    dataset: process.env.SANITY_DATASET || 'production',
    token: process.env.SANITY_TOKEN || token,
    useCdn: false
});

let currentStep = null;
const options = {
    client: client,
    dataset: 'production',
    outputPath: path.join(__dirname, compress ? 'export.tar.gz' : 'export.json'),

    compress: compress,
    drafts: true,
    assets: true,
    raw: false,
    assetConcurrency: 5,
    // types: '',

    onProgress: ({ step, current, total, update }) => {
        if (currentStep !== step) {
            if (currentStep) {
                return;
            }
            currentStep = step;
            console.log(step);
        }
    }
};

console.log('Start Sanity export');
exportDataset(options).then(() => {
    console.log('Start export finished');
});
