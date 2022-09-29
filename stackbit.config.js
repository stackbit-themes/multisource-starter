const path = require('path');

const { ContentfulContentSource } = require('@stackbit/cms-contentful');
const { SanityContentSource } = require('@stackbit/cms-sanity');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

module.exports = {
    stackbitVersion: '~0.5.0',
    ssgName: 'nextjs',
    nodeVersion: '16',

    // contentSources is a list of modules implementing the ContentSourceInterface
    contentSources: [
        new ContentfulContentSource({
            spaceId: process.env.CONTENTFUL_SPACE_ID,
            environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
            previewToken: process.env.CONTENTFUL_PREVIEW_TOKEN,
            accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN
        }),
        new SanityContentSource({
            projectId: process.env.SANITY_PROJECT_ID,
            token: process.env.SANITY_TOKEN,
            dataset: process.env.SANITY_DATASET || 'production',
            rootPath: process.cwd(),
            studioPath: path.resolve(process.cwd(), 'studio')
        })
    ]
};
