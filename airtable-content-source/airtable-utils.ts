import Airtable from 'airtable';

import type { ModelMap, FieldSpecificProps, Document, DocumentField, DocumentFieldNonLocalized, DocumentValueFieldNonLocalized, Asset } from '@stackbit/types';

export async function fetchTable<Fields extends Airtable.FieldSet>(base: Airtable.Base, tableName: string): Promise<Airtable.Records<Fields>> {
    const table = base<Fields>(tableName);
    const query = table.select();
    return await query.all();
}

export type DocumentContext = {
    id: string;
}

const STATUS_MAP = {
    draft: 'added',
    changed: 'modified',
    deleted: 'deleted',
    published: 'published',
    'published-changed': 'published',
    'published-deleted': 'deleted'
} as const;

type Status = keyof typeof STATUS_MAP;

export function convertAirtableRecordsToStackbitDocuments(records: Airtable.Records<Airtable.FieldSet>, modelMap: ModelMap): Document<DocumentContext>[] {
    return records.map((record): Document<DocumentContext> => {
        const status = typeof record.fields.Status === 'string' && record.fields.Status in STATUS_MAP ? STATUS_MAP[record.fields.Status as Status] : 'added';
        const model = modelMap[record._table.name];
        return {
            type: 'document',
            // replace the id of a changed record to the id of the published document
            // this is to ensure that when published documents are edited, their ids in stackbit are preserved.
            id: record.fields.Status === 'changed' ? (record.fields.Related! as string[])[0] as string : record.id,
            manageUrl: 'https://www.example.com',
            modelName: record._table.name,
            status: status,
            createdAt: record._rawJson.createdTime,
            updatedAt: record._rawJson.createdTime,
            context: {
                id: record.id
            },
            fields: Object.entries(record.fields).reduce((fields, [fieldName, fieldValue]) => {
                const field = (model.fields || []).find((field) => field.name === fieldName);
                if (!field) {
                    return fields;
                }
                fields[fieldName] = convertField(field, fieldValue);
                return fields;
            }, {} as Record<string, DocumentField>)
        };
    });
}

export function convertAirtableRecordsToStackbitAssets(records: Airtable.Records<Airtable.FieldSet>): Asset[] {
    return records
        .map((record): Asset | null => {
            const asset = Array.isArray(record.fields.Asset) ? (record.fields.Asset[0] as Airtable.Attachment) : null;
            if (!asset) {
                return null;
            }
            return {
                type: 'asset',
                id: record.id,
                manageUrl: 'https://www.example.com',
                status: 'published',
                createdAt: record._rawJson.createdTime,
                updatedAt: record._rawJson.createdTime,
                context: null,
                fields: {
                    title: {
                        type: 'string',
                        value: record.fields.Title
                    },
                    file: {
                        type: 'assetFile',
                        url: asset.url,
                        fileName: asset.filename,
                        contentType: asset.type,
                        size: asset.size,
                        dimensions: {
                            // @ts-ignore
                            width: asset.width,
                            // @ts-ignore
                            height: asset.height
                        }
                    }
                }
            };
        })
        .filter((value): value is Asset => !!value);
}

function convertField(field: FieldSpecificProps, fieldValue: any): DocumentFieldNonLocalized {
    if (field.type === 'list') {
        if (!Array.isArray(fieldValue)) {
            return {
                type: 'list',
                items: []
            };
        }
        return {
            type: 'list',
            items: fieldValue.map((item) => convertField(field.items || { type: 'string' }, item))
        };
    }

    if (Array.isArray(fieldValue)) {
        fieldValue = fieldValue[0];
    }

    if (field.type === 'image') {
        return {
            type: 'reference',
            refType: 'asset',
            refId: fieldValue
        };
    } else if (field.type === 'reference') {
        return {
            type: 'reference',
            refType: 'document',
            refId: fieldValue
        };
    }

    return {
        type: field.type,
        value: fieldValue
    } as DocumentValueFieldNonLocalized;
}
