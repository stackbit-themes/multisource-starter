import path from 'path';
import dotenv from 'dotenv';

import { ContentfulContentSource } from '@stackbit/cms-contentful';
import { SanityContentSource } from '@stackbit/cms-sanity';

import { AirtableContentSource } from './airtable-content-source/AirtableContentSource';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

export default {
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
            rootPath: __dirname,
            studioPath: path.resolve(__dirname, 'studio'),
            studioUrl: process.env.SANITY_STUDIO_URL || 'https://www.example.com'
        }),

        new AirtableContentSource({
            apiKey: process.env.AIRTABLE_API_KEY,
            baseId: process.env.AIRTABLE_BASE_ID,
            manageUrl: process.env.AIRTABLE_MANAGE_URL ||  'https://www.example.com'
        })
    ],

    mapModels: ({ models }) => {

        return models.map((model) => {

            // change model labels to reflect their source
            model.label = `${model.label} (${model.srcType})`;

            // change the model type of Contentful's 'page' model to 'type: page'
            // to enable page editing and sitemap features in Stackbit
            if (model.name === 'page') {
                model = {
                    ...model,
                    type: 'page',
                    urlPath: '/{slug}'
                };
            }

            return model;
        });
    }

};
