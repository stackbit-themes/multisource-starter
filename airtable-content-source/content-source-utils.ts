import Airtable from 'airtable';
import type {
    ModelMap,
    FieldSpecificProps,
    Document,
    DocumentStatus,
    DocumentField,
    Asset,
    Model,
    Field,
    DocumentListFieldItems,
    UpdateOperationField
} from '@stackbit/types';

import type { AirtableTableModel } from '../airtable-api-client/airtable-table-types';
import type { AirtableRecordPublishState, AssetRecordFields, StatefulRecord, StateFields, AirtableFieldType } from '../airtable-api-client/airtable-api-client';

export type DocumentContext = {
    tableId: string;
} & (
    | {
          status: 'draft';
      }
    | {
          status: 'changed';
          changedRecordId: string;
      }
    | {
          status: 'deleted';
      }
    | {
          status: 'published';
      }
    | {
          status: 'published-has-changes';
          changedRecordId: string;
      }
    | {
          status: 'published-to-be-deleted';
      }
);

export interface AssetContext {
    // Define a custom asset context that can be saved in Document's 'context' property
}

const STATUS_MAP: Record<AirtableRecordPublishState, DocumentStatus> = {
    draft: 'added',
    changed: 'modified',
    deleted: 'deleted',
    published: 'published',
    'published-has-changes': 'published',
    'published-to-be-deleted': 'deleted'
} as const;

export function convertAirtableModelsToStackbitModels(airtableModels: AirtableTableModel[]): Model[] {
    const models: Model[] = [];
    for (const airtableModel of airtableModels) {
        if (airtableModel.name === 'Assets') {
            continue;
        }
        models.push({
            type: 'data',
            name: airtableModel.name,
            label: airtableModel.name,
            labelField: airtableModel.fields.find((airtableField) => airtableField.id === airtableModel.primaryFieldId)?.name,
            description: airtableModel.description,
            fields: airtableModel.fields.map((airtableField): Field => {
                const commonFields = {
                    name: airtableField.name,
                    label: airtableField.name,
                    description: airtableField.description
                };
                switch (airtableField.type) {
                    case 'singleLineText':
                    case 'email':
                    case 'url':
                    case 'phoneNumber':
                        return { type: 'string', ...commonFields };
                    case 'multilineText':
                        return { type: 'text', ...commonFields };
                    case 'richText':
                        return { type: 'markdown', ...commonFields };
                    case 'multipleAttachments':
                        return { type: 'list', ...commonFields, items: { type: 'image' } };
                    case 'checkbox':
                        return { type: 'boolean', ...commonFields };
                    case 'date':
                        return { type: 'date', ...commonFields };
                    case 'dateTime':
                        return { type: 'datetime', ...commonFields };
                    case 'number':
                        return { type: 'number', ...commonFields };
                    case 'multipleRecordLinks': {
                        const linkedAirtableModel = airtableModels.find((airtableModel) => airtableModel.id === airtableField.options.linkedTableId);
                        if (linkedAirtableModel?.name === 'Assets') {
                            if (airtableField.options.prefersSingleRecordLink) {
                                return {
                                    type: 'image',
                                    ...commonFields
                                };
                            } else {
                                return {
                                    type: 'list',
                                    ...commonFields,
                                    items: { type: 'image' }
                                };
                            }
                        }
                        const models = linkedAirtableModel ? [linkedAirtableModel.name] : [];
                        if (airtableField.options.prefersSingleRecordLink) {
                            return {
                                type: 'reference',
                                ...commonFields,
                                models
                            };
                        } else {
                            return {
                                type: 'list',
                                ...commonFields,
                                items: { type: 'reference', models }
                            };
                        }
                    }
                    case 'singleSelect': {
                        const options = airtableField.options.choices.map((choice) => ({
                            label: choice.name,
                            value: choice.id
                        }));
                        return { type: 'enum', ...commonFields, options };
                    }
                    case 'multipleSelects': {
                        const options = airtableField.options.choices.map((choice) => ({
                            label: choice.name,
                            value: choice.id
                        }));
                        return {
                            type: 'list',
                            ...commonFields,
                            items: { type: 'enum', options }
                        };
                    }
                    default:
                        throw new Error(`airtable field type '${airtableField.type}' not implemented, this is only a demo`);
                }
            })
        });
    }
    return models;
}

export function convertAirtableRecordsToStackbitDocuments(
    records: StatefulRecord<StateFields>[],
    modelMap: ModelMap,
    manageUrl: string
): Document<DocumentContext>[] {
    return records.map((record: StatefulRecord<StateFields>): Document<DocumentContext> => {
        const status = STATUS_MAP[record.status] ?? 'added';
        const model = modelMap[record.tableName];
        return {
            type: 'document',
            id: record.id,
            manageUrl: `${manageUrl}/${record.tableId}/${record.id}`,
            modelName: record.tableName,
            status: status,
            createdAt: record.createdTime,
            updatedAt: record.createdTime,
            context: documentContextForRecord(record),
            fields: Object.entries(record.fields).reduce((fields: Record<string, DocumentField>, [fieldName, fieldValue]) => {
                const field = (model.fields || []).find((field) => field.name === fieldName);
                if (!field) {
                    return fields;
                }
                fields[fieldName] = convertAirtableRecordFieldToStackbitDocumentField(field, fieldValue);
                return fields;
            }, {})
        };
    });
}

function documentContextForRecord(record: StatefulRecord<StateFields>): DocumentContext {
    switch (record.status) {
        case 'draft':
        case 'published':
        case 'deleted':
        case 'published-to-be-deleted':
            return {
                tableId: record.tableId,
                status: record.status
            };
        case 'changed':
        case 'published-has-changes':
            return {
                tableId: record.tableId,
                status: record.status,
                changedRecordId: record.changedRecordId
            };
    }
}

function convertAirtableRecordFieldToStackbitDocumentField(field: FieldSpecificProps, fieldValue: Airtable.FieldSet[keyof Airtable.FieldSet]): DocumentField {
    switch (field.type) {
        case 'string':
            return { type: 'string', value: fieldValue };
        case 'text':
            return { type: 'text', value: fieldValue };
        case 'markdown':
            return { type: 'markdown', value: fieldValue };
        case 'boolean':
            return { type: 'boolean', value: fieldValue };
        case 'date':
            return { type: 'date', value: fieldValue };
        case 'datetime':
            return { type: 'datetime', value: fieldValue };
        case 'number':
            return { type: 'number', value: fieldValue };
        case 'enum':
            return { type: 'enum', value: fieldValue };
        case 'image':
            return {
                type: 'reference',
                refType: 'asset',
                refId: (fieldValue as string[])[0]
            };
        case 'reference':
            return {
                type: 'reference',
                refType: 'document',
                refId: (fieldValue as string[])[0]
            };
        case 'list':
            if (!Array.isArray(fieldValue)) {
                return {
                    type: 'list',
                    items: []
                };
            }
            return {
                type: 'list',
                items: fieldValue.map((item) => convertAirtableRecordFieldToStackbitDocumentField(field.items, item) as DocumentListFieldItems)
            };
        default:
            throw new Error(`stackbit field type '${field.type}' not implemented, this is only a demo`);
    }
}

export function convertAirtableAssetRecordsToStackbitAssets(records: Airtable.Records<AssetRecordFields>, manageUrl: string): Asset<AssetContext>[] {
    records = records.filter((record) => Array.isArray(record.fields.Asset) && record.fields.Asset.length > 0);
    return records.map((record): Asset<AssetContext> => {
        const asset = record.fields.Asset[0];
        return {
            type: 'asset',
            id: record.id,
            manageUrl: manageUrl,
            status: 'published',
            createdAt: record._rawJson.createdTime,
            updatedAt: record._rawJson.createdTime,
            context: {},
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
                        width: asset.width,
                        height: asset.height
                    }
                }
            }
        };
    });
}

export function convertOperationFieldToAirtableField(updateOperationField: UpdateOperationField): AirtableFieldType {
    switch (updateOperationField.type) {
        case 'string':
        case 'text':
        case 'markdown':
        case 'html':
        case 'url':
        case 'slug':
        case 'color':
        case 'enum':
        case 'number':
        case 'boolean':
        case 'date':
        case 'datetime':
            return updateOperationField.value;
        case 'reference':
            return [updateOperationField.refId];
        case 'cross-reference':
        case 'richText':
        case 'json':
        case 'style':
        case 'image':
        case 'file':
        case 'object':
        case 'model':
        case 'list':
            throw new Error(`operation with field of type ${updateOperationField.type} is not supported`);
        default:
            const _exhaustiveCheck: never = updateOperationField;
            return _exhaustiveCheck;
    }
}
