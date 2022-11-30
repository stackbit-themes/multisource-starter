import { createClient, Entry } from 'contentful';

export async function getEntries({ isPreview, query }: { isPreview: boolean, query: any }): Promise<Entry<any>[]> {
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
    const entries = await client.getEntries(query);
    return entries.items;
}
