#!/usr/bin/env node

const path = require('path');
const contentfulExport = require('contentful-export');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const managementToken = process.env.CONTENTFUL_MANAGEMENT_TOKEN || process.argv[2];
const spaceId = process.env.CONTENTFUL_SPACE_ID || process.argv[3];
const environmentId = process.env.CONTENTFUL_ENVIRONMENT || process.argv[4] || 'master';

if (!managementToken || !spaceId) {
    console.error('Contentful management token or space ID were not provided.\n\nUsage:\n./export.js <managementToken> <spaceId>\n');
    process.exit(1);
}

const options = {
    spaceId: spaceId,
    environmentId: environmentId,
    managementToken: managementToken,
    exportDir: __dirname,
    contentFile: 'export.json',
    downloadAssets: true,
    includeDrafts: true,
    skipWebhooks: true
};

contentfulExport(options)
    .then((result) => {
        console.log('Data exported successfully');
    })
    .catch((error) => {
        console.log('Error exporting content:', error);
    });
