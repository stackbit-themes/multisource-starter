import path from 'path';

import { defineStackbitConfig } from '@stackbit/types';
import { ContentfulContentSource } from '@stackbit/cms-contentful';
import { SanityContentSource } from '@stackbit/cms-sanity';

import { AirtableContentSource } from './airtable-content-source/airtable-content-source';

export default defineStackbitConfig({
    stackbitVersion: '~0.5.0',
    ssgName: 'nextjs',
    nodeVersion: '16',

    // contentSources is a list of modules implementing the ContentSourceInterface
    contentSources: [
        new ContentfulContentSource({
            spaceId: process.env.CONTENTFUL_SPACE_ID!,
            environment: process.env.CONTENTFUL_ENVIRONMENT || 'master',
            previewToken: process.env.CONTENTFUL_PREVIEW_TOKEN!,
            accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN!,
            useLocalizedAssetFields: false
        }),

        new SanityContentSource({
            projectId: process.env.SANITY_PROJECT_ID!,
            token: process.env.SANITY_TOKEN!,
            dataset: process.env.SANITY_DATASET || 'production',
            rootPath: __dirname,
            studioPath: path.resolve(__dirname, 'studio'),
            studioUrl: process.env.SANITY_STUDIO_URL || 'https://www.example.com'
        }),

        new AirtableContentSource({
            personalAccessToken: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN!,
            baseId: process.env.AIRTABLE_BASE_ID!
        })
    ],

    // Override and extend content source models with Stackbit specific features
    modelExtensions: [
        // Mark the Contentful's 'page' model to have type 'page' and add 'urlPath'
        // This allows Stackbit to generate a sitemap and provide in-context editing
        // experience when navigating site pages.
        {
            name: 'page',
            srcType: 'contentful',
            type: 'page',
            urlPath: '/{slug}',
            fields: [
                // Override Contentful's "crossReferenceSections" field type
                // from "list of strings" to "list of cross-reference".
                // Stackbit will continue storing the value of this field as
                // list of strings. However, this will enable Stackbit users to
                // pick an object from a list of objects matching the models and
                // the content sources defined in this field.
                {
                    type: 'list',
                    name: 'crossReferenceSections',
                    items: {
                        type: 'cross-reference',
                        models: [
                            {
                                srcType: 'contentful',
                                modelName: 'contentfulSection'
                            },
                            {
                                srcType: 'sanity',
                                modelName: 'sanitySection'
                            },
                            {
                                srcType: 'airtable',
                                modelName: 'Sections'
                            }
                        ]
                    }
                }
            ]
        },
        // Change model labels
        {
            name: 'contentfulSection',
            srcType: 'contentful',
            label: 'Contentful Section'
        },
        {
            name: 'sanitySection',
            srcType: 'sanity',
            label: 'Sanity Section'
        },
        {
            name: 'Sections',
            srcType: 'airtable',
            label: 'Airtable Section'
        }
    ]
});
