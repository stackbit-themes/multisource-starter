import Airtable from 'airtable';
import type { Model } from '@stackbit/types';

export const HeroSectionModel: Model = {
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
        },
        {
            type: 'enum',
            name: 'Status',
            options: ['draft', 'changed', 'deleted', 'published', 'published-changed', 'published-deleted'],
            hidden: true
        },
        {
            type: 'reference',
            name: 'Related',
            models: ['HeroSection'],
            hidden: true
        }
    ]
};

export type HeroSectionFields = {
    Title?: string;
    Subtitle?: string;
    Buttons?: string[];
    Asset?: string[];
    Status: 'draft' | 'changed' | 'deleted' | 'published' | 'published-changed' | 'published-deleted';
    Related?: string[];
};

export const ButtonModel: Model = {
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
        },
        {
            type: 'enum',
            name: 'Status',
            options: ['draft', 'changed', 'deleted', 'published', 'published-changed', 'published-deleted'],
            hidden: true
        },
        {
            type: 'reference',
            name: 'Related',
            models: ['Button'],
            hidden: true
        }
    ]
};

export type ButtonFields = {
    Label?: string;
    Slug?: string;
    Status: 'draft' | 'changed' | 'deleted' | 'published' | 'published-changed' | 'published-deleted';
    Related?: string[];
};

export type AssetFields = {
    Title?: string;
    Asset: Airtable.Attachment[];
};
