import Airtable from 'airtable';
import type { ContentSourceTypes } from '@stackbit/cms-core';
import type { FieldSpecificProps } from '@stackbit/sdk';

export async function fetchTable(base: Airtable.Base, tableName: string): Promise<Airtable.Records<Airtable.FieldSet>> {
    const query = base(tableName).select();
    return await query.all();
}

const STATUS_MAP = {
    draft: 'added',
    changed: 'modified',
    published: 'published',
    deleted: 'deleted'
} as const;

type Status = keyof typeof STATUS_MAP;

export function convertAirtableRecordsToStackbitDocuments(
    records: Airtable.Records<Airtable.FieldSet>,
    modelMap: ContentSourceTypes.ModelMap
): ContentSourceTypes.Document[] {
    return records.map((record): ContentSourceTypes.Document => {
        const status = typeof record.fields.Status === 'string' && record.fields.Status in STATUS_MAP ? STATUS_MAP[record.fields.Status as Status] : 'added';
        const model = modelMap[record._table.name];
        return {
            type: 'document',
            id: record.id,
            manageUrl: 'https://www.example.com',
            modelName: record._table.name,
            status: status,
            createdAt: record._rawJson.createdTime,
            updatedAt: record._rawJson.createdTime,
            context: null,
            fields: Object.entries(record.fields).reduce((fields, [fieldName, fieldValue]) => {
                const field = (model.fields ?? []).find((field) => field.name === fieldName);
                if (!field) {
                    return fields;
                }
                fields[fieldName] = convertField(field, fieldValue);
                return fields;
            }, {} as Record<string, ContentSourceTypes.DocumentField>)
        };
    });
}

export function convertAirtableRecordsToStackbitAssets(records: Airtable.Records<Airtable.FieldSet>): ContentSourceTypes.Asset[] {
    return records
        .map((record): ContentSourceTypes.Asset | null => {
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
        .filter((value): value is ContentSourceTypes.Asset => !!value);
}

function convertField(field: FieldSpecificProps, fieldValue: any): ContentSourceTypes.DocumentFieldNonLocalized {
    if (field.type === 'list') {
        if (!Array.isArray(fieldValue)) {
            return {
                type: 'list',
                items: []
            };
        }
        return {
            type: 'list',
            items: fieldValue.map((item) => convertField(field.items ?? { type: 'string' }, item))
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
    } as ContentSourceTypes.DocumentValueFieldNonLocalized;
}
