import { createClient, Entry } from 'contentful';

export interface ContentfulSectionFields {
    title?: string;
    subtitle?: string;
}

export interface ContentfulPageFields {
    title: string;
    slug: string;
    crossReferenceSections: string[];
}

export type ContentfulSectionEntry = Entry<ContentfulSectionFields>;
export type ContentfulPageEntry = Entry<ContentfulPageFields>;

export async function getEntries<Fields extends ContentfulSectionFields | ContentfulPageFields>({
    isPreview,
    query
}: {
    isPreview: boolean;
    query: any;
}): Promise<Entry<Fields>[]> {
    const spaceId = process.env.CONTENTFUL_SPACE_ID;
    if (!spaceId) {
        throw new Error('CONTENTFUL_SPACE_ID environment variable was not provided');
    }
    let accessToken;
    if (isPreview) {
        const previewToken = process.env.CONTENTFUL_PREVIEW_TOKEN;
        if (!previewToken) {
            throw new Error('CONTENTFUL_PREVIEW_TOKEN environment variable was not provided');
        }
        accessToken = previewToken;
    } else {
        const deliveryToken = process.env.CONTENTFUL_DELIVERY_TOKEN;
        if (!deliveryToken) {
            throw new Error('CONTENTFUL_DELIVERY_TOKEN environment variable was not provided');
        }
        accessToken = deliveryToken;
    }
    const client = createClient({
        space: spaceId,
        accessToken: accessToken,
        ...(isPreview ? { host: 'preview.contentful.com' } : {})
    });
    const entries = await client.getEntries<Fields>(query);
    return entries.items;
}
