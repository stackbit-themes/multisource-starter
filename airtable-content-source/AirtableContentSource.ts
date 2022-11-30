import Airtable from 'airtable';

import type * as StackbitTypes from '@stackbit/types';

import { ButtonModel, HeroSectionModel, HeroSectionFields, ButtonFields, AssetFields } from './models';
import { fetchTable, convertAirtableRecordsToStackbitDocuments, convertAirtableRecordsToStackbitAssets, DocumentContext } from './airtable-utils';

type UserContext = {};

export type ContentSourceOptions = {
    apiKey: string;
    baseId: string;
    manageUrl?: string;
};

/**
 * Airtable content source allows Stackbit to use Airtable as a content
 * management system with publishing workflows. To achieve that, every Airtable
 * record is extended with `State` and `Related` fields.
 *
 * The `Related` field is a link field that may reference a surrogate pair of
 * a published record. The published records represent the "production" content,
 * while their surrogate paris represent their copies with pending changes.
 *
 * The `State` field can have the following values:
 * - "draft": A record that has never been published. Only preview environment
 *       will show this record.
 * - "published": A published record that has no pending changes. Both preview
 *       and production environments will show this record.
 * - "published-changed": A published record that has a surrogate record with
 *       pending changes. In this state, the `Related` field will reference
 *       the surrogate record pair with the pending changes. The production
 *       environment will show this record, while the preview environment will
 *       show the surrogate "changed" record.
 * - "changed": A copy of a published record that has pending changes. In this
 *       state, the `Related` field will reference the surrogate record in the
 *       "published-changed" state. The preview environment will show this
 *       record, while the production environment will show the surrogate
 *       "published-changed" record.
 * - "published-deleted": A record that has been marked to be deleted but its
 *       deletion was not yet published. The production environment will
 *       continue showing this record until the deletion is published. The
 *       preview environment will not show this record.
 * - "deleted": A deleted record. Both preview and production environments will
 *       not show this record.
 *
 * When Airtable records converted to Stackbit documents and to ensure that
 * Stackbit "sees" the same document ids when users update and publish documents,
 * the ids of records in the "changed" state are replaced with ids of their
 * surrogate "published-changed" records. The original ids of the "changed"
 * records are stored in document.context.id.
 */

export class AirtableContentSource implements StackbitTypes.ContentSourceInterface<UserContext, DocumentContext> {
    private readonly apiKey: string;
    private readonly baseId: string;
    private readonly manageUrl?: string;
    private logger!: StackbitTypes.Logger;
    private userLogger!: StackbitTypes.Logger;
    private client!: Airtable;
    private base!: Airtable.Base;
    onContentChange: null | ((contentChangeEvent: StackbitTypes.ContentChangeEvent<DocumentContext, unknown>) => void) = null;

    constructor({ apiKey, baseId, manageUrl }: ContentSourceOptions) {
        this.apiKey = apiKey;
        this.baseId = baseId;
        this.manageUrl = manageUrl;
    }

    getContentSourceType(): string {
        return 'airtable';
    }

    getProjectId(): string {
        return this.baseId;
    }

    getProjectEnvironment(): string {
        return 'master';
    }

    getProjectManageUrl(): string {
        return this.manageUrl || 'https://www.example.com';
    }

    async init({ logger, userLogger, localDev }: StackbitTypes.InitOptions): Promise<void> {
        this.client = new Airtable({ apiKey: this.apiKey });
        this.base = this.client.base(this.baseId);
        this.logger = logger.createLogger({ label: 'airtable' });
        this.userLogger = userLogger.createLogger({ label: 'airtable' });
    }

    async reset(): Promise<void> {}

    async onFilesChange?({ updatedFiles }: { updatedFiles: string[] }): Promise<{
        schemaChanged?: boolean | undefined;
        contentChangeEvent?: StackbitTypes.ContentChangeEvent<DocumentContext, unknown> | undefined;
    }> {
        return {};
    }

    startWatchingContentUpdates(options: {
        getModelMap: () => StackbitTypes.ModelMap;
        getDocument: ({ documentId }: { documentId: string }) => StackbitTypes.Document<DocumentContext> | undefined;
        getAsset: ({ assetId }: { assetId: string }) => StackbitTypes.Asset<unknown> | undefined;
        onContentChange: (contentChangeEvent: StackbitTypes.ContentChangeEvent<DocumentContext, unknown>) => void;
        onSchemaChange: () => void;
    }): void {
        this.onContentChange = options.onContentChange;
    }

    stopWatchingContentUpdates(): void {
        this.onContentChange = null;
    }

    async getModels(): Promise<StackbitTypes.Model[]> {
        this.logger.debug('getModels');
        return [HeroSectionModel, ButtonModel];
    }

    async getLocales(): Promise<StackbitTypes.Locale[]> {
        return [];
    }

    async getDocuments(options: { modelMap: StackbitTypes.ModelMap }): Promise<StackbitTypes.Document<DocumentContext>[]> {
        this.logger.debug('getDocuments');
        const heroSections = await fetchTable<HeroSectionFields>(this.base, 'HeroSection');
        const buttons = await fetchTable<ButtonFields>(this.base, 'Button');
        const allRecords = [...heroSections, ...buttons];
        this.logger.debug(`fetched ${allRecords.length} records from airtable`);
        const records = [...heroSections, ...buttons].filter((record) => {
            return ['draft', 'changed', 'published', 'published-deleted'].includes(record.fields.Status);
        });
        this.logger.debug(`filtered ${records.length} records from airtable`);
        // @ts-ignore
        return convertAirtableRecordsToStackbitDocuments(records, options.modelMap);
    }

    async getAssets(): Promise<StackbitTypes.Asset<unknown>[]> {
        this.logger.debug('getAssets');
        const assets = await fetchTable<AssetFields>(this.base, 'Asset');
        this.logger.debug(`fetched ${assets.length} assets from airtable`);
        // @ts-ignore
        return convertAirtableRecordsToStackbitAssets(assets);
    }

    // @ts-ignore
    async hasAccess(options: { userContext?: UserContext }): Promise<{
        hasConnection: boolean;
        hasPermissions: boolean;
    }> {
        return {
            hasConnection: true,
            hasPermissions: true
        };
    }

    async createDocument(options: {
        updateOperationFields: Record<string, StackbitTypes.UpdateOperationField>;
        model: StackbitTypes.Model;
        modelMap: StackbitTypes.ModelMap;
        locale?: string;
        userContext?: UserContext;
    }): Promise<StackbitTypes.Document<DocumentContext>> {
        const record = await this.base(options.model.name).create({
            Status: 'draft'
        });
        const createdDocument = convertAirtableRecordsToStackbitDocuments([record], options.modelMap)[0];
        this.onContentChange?.({
            documents: [createdDocument],
            assets: [],
            deletedDocumentIds: [],
            deletedAssetIds: []
        });
        return createdDocument;
    }

    async updateDocument(options: {
        document: StackbitTypes.Document<DocumentContext>;
        operations: StackbitTypes.UpdateOperation[];
        modelMap: StackbitTypes.ModelMap;
        userContext?: UserContext;
    }): Promise<StackbitTypes.Document<DocumentContext>> {
        // throw new Error('Method not implemented.');
        const updatedFields: Record<string, any> = {};
        for (const operation of options.operations) {
            if (operation.opType === 'set') {
                const { field, fieldPath, locale, modelField } = operation;
                const fieldType = field.type;
                switch (fieldType) {
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
                        updatedFields[fieldPath[0]] = field.value;
                        break;
                    case 'richText':
                    case 'json':
                    case 'style':
                    case 'image':
                    case 'file':
                    case 'object':
                    case 'model':
                    case 'reference':
                    case 'list':
                        throw new Error(`updating field of type ${field.type} not implemented`);
                    default:
                        const _exhaustiveCheck: never = fieldType;
                        return _exhaustiveCheck;
                }
            }
        }
        if ((options.document.fields.Status as StackbitTypes.DocumentValueFieldNonLocalized).value === 'published') {
            const origRecord = await this.base(options.document.modelName).find(options.document.id);
            const changedRecord = await this.base(options.document.modelName).create({
                ...origRecord.fields,
                ...updatedFields,
                Related: [origRecord.id],
                Status: 'changed'
            });
            const publishedChangedRecord = await this.base(options.document.modelName).update(origRecord.id, {
                Related: [changedRecord.id],
                Status: 'published-changed'
            });
            const [publishedChangedDocument, changedDocument] = convertAirtableRecordsToStackbitDocuments(
                [publishedChangedRecord, changedRecord],
                options.modelMap
            );
            this.onContentChange?.({
                documents: [changedDocument],
                assets: [],
                deletedDocumentIds: [],
                deletedAssetIds: []
            });
            return publishedChangedDocument;
        } else {
            // the changed record has the id of the published one, use context.id to get the actual id
            const record = await this.base(options.document.modelName).update(options.document.context.id, updatedFields);
            const updatedDocument = convertAirtableRecordsToStackbitDocuments([record], options.modelMap)[0];
            this.onContentChange?.({
                documents: [updatedDocument],
                assets: [],
                deletedDocumentIds: [],
                deletedAssetIds: []
            });
            return updatedDocument;
        }
    }

    async deleteDocument(options: { document: StackbitTypes.Document<DocumentContext>; userContext?: UserContext }): Promise<void> {
        const docStatus = (options.document.fields.Status as StackbitTypes.DocumentValueFieldNonLocalized).value;
        const deletedDocumentIds: string[] = [];
        if (docStatus === 'published') {
            await this.base(options.document.modelName).update(options.document.id, {
                Status: 'published-deleted'
            });
            deletedDocumentIds.push(options.document.id);
        } else if (docStatus === 'draft') {
            await this.base(options.document.modelName).update(options.document.id, {
                Status: 'deleted'
            });
            deletedDocumentIds.push(options.document.id);
        } else if (docStatus === 'changed') {
            const publishedChangedId = (options.document.fields.Related as StackbitTypes.DocumentReferenceFieldNonLocalized).refId;
            await this.base(options.document.modelName).update(publishedChangedId, {
                Status: 'published-deleted'
            });
            // the changed record has the id of the published one, use context.id to get the actual id
            await this.base(options.document.modelName).destroy(options.document.context.id);
            deletedDocumentIds.push(options.document.context.id, publishedChangedId);
        }
        this.onContentChange?.({
            documents: [],
            assets: [],
            deletedDocumentIds: deletedDocumentIds,
            deletedAssetIds: []
        });
    }

    async uploadAsset(options: {
        url?: string | undefined;
        base64?: string | undefined;
        fileName: string;
        mimeType: string;
        locale?: string | undefined;
        userContext?: UserContext;
    }): Promise<StackbitTypes.Asset<unknown>> {
        throw new Error('Method not implemented.');
    }

    async validateDocuments(options: {
        documents: StackbitTypes.Document<DocumentContext>[];
        assets: StackbitTypes.Asset<unknown>[];
        locale?: string | undefined;
        userContext?: UserContext;
    }): Promise<{ errors: StackbitTypes.ValidationError[] }> {
        return { errors: [] };
    }

    async publishDocuments(options: {
        documents: StackbitTypes.Document<DocumentContext>[];
        assets: StackbitTypes.Asset<unknown>[];
        userContext?: UserContext;
    }): Promise<void> {
        for (const document of options.documents) {
            const docStatus = (document.fields.Status as StackbitTypes.DocumentValueFieldNonLocalized).value;
            if (docStatus === 'draft') {
                await this.base(document.modelName).update(document.id, {
                    Status: 'published'
                });
            } else if (docStatus === 'changed') {
                // the changed record has the id of the published one, use context.id to get the actual id
                const changedRecord = await this.base<HeroSectionFields>(document.modelName).find(document.context.id);
                await this.base<HeroSectionFields>(document.modelName).update(changedRecord.fields.Related![0], {
                    ...changedRecord.fields,
                    Related: [],
                    Status: 'published'
                });
                await this.base(document.modelName).destroy(document.context.id);
            } else if (docStatus === 'published-deleted') {
                await this.base<HeroSectionFields>(document.modelName).update(document.id, {
                    Status: 'deleted'
                });
            }
        }
    }
}
