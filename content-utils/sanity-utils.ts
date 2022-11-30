import createSanityClient from '@sanity/client';

const DRAFT_ID_PREFIX = 'drafts.';

function isDraftId(docId: string) {
    return docId && docId.startsWith(DRAFT_ID_PREFIX);
}

function getPureObjectId(docId: string) {
    return docId.replace(/^drafts\./, '');
}

function overlayDrafts(documents: any[]) {
    const draftDocumentIdMap = documents
        .filter((document) => isDraftId(document._id))
        .reduce((res, document) => {
            res[getPureObjectId(document._id)] = document;
            return res;
        }, {});

    return documents.filter((document) => {
        return isDraftId(document._id) || !(document._id in draftDocumentIdMap);
    }).map((document) => ({
        ...document,
        // replace draft id with pure id to ensure that cross-references are
        // linked correctly using the pure id.
        _id: getPureObjectId(document._id)
    }));
}

function withoutDrafts(documents: any[]) {
    return documents.filter((document) => {
        return !isDraftId(document._id);
    });
}

export async function getDocuments(isPreview: boolean) {
    const projectId = process.env.SANITY_PROJECT_ID;
    if (!projectId) {
        throw new Error('SANITY_PROJECT_ID environment variable was not provided');
    }
    const token = process.env.SANITY_TOKEN;
    if (!token) {
        throw new Error('SANITY_TOKEN environment variable was not provided');
    }
    const client = createSanityClient({
        projectId: projectId,
        dataset: 'production',
        apiVersion: '2021-03-25',
        token: token,
        useCdn: false
    });
    const sanityDocuments = await client.fetch('*[!(_id in path("_.**"))]');
    if (isPreview) {
        return overlayDrafts(sanityDocuments);
    } else {
        return withoutDrafts(sanityDocuments);
    }
}
