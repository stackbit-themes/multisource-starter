import type { Model } from '@stackbit/sdk';

export const HeroSection: Model = {
    type: 'data',
    name: 'HeroSection',
    label: 'Hero Section',
    labelField: 'Title',
    fields: [
        {
            type: 'string',
            name: 'Title'
        },
        {
            type: 'markdown',
            name: 'Subtitle'
        },
        {
            type: 'list',
            name: 'Buttons',
            items: {
                type: 'reference',
                models: ['Button']
            }
        },
        {
            type: 'image',
            name: 'Asset'
        }
    ]
};

export const Button: Model = {
    type: 'data',
    name: 'Button',
    label: 'Button',
    labelField: 'Label',
    fields: [
        {
            type: 'string',
            name: 'Label'
        },
        {
            type: 'slug',
            name: 'Slug'
        }
    ]
};
