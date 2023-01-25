import Airtable from 'airtable';
import type {
    ContentSourceInterface,
    InitOptions,
    Logger,
    Model,
    ModelMap,
    Locale,
    Document,
    Asset,
    ContentChangeEvent,
    UpdateOperation,
    UpdateOperationField,
    ValidationError
} from '@stackbit/types';

import {
    DocumentContext,
    AssetContext,
    convertAirtableModelsToStackbitModels,
    convertAirtableRecordsToStackbitDocuments,
    convertAirtableAssetRecordsToStackbitAssets,
    convertOperationFieldToAirtableField
} from './content-source-utils';
import { AirtableApiClient, AssetRecordFields, StateFields, StatefulRecord } from '../airtable-api-client/airtable-api-client';

interface UserContext {
    // Add user-specific properties like OAuth accessToken.
    // This requires an OAuth flow integration with Stackbit.
    // Please reach out to the Stackbit team for more info.
}

export type ContentSourceOptions = {
    personalAccessToken: string;
    baseId: string;
    assetsTableName?: string;
};

/**
 * The AirtableContentSource allows Stackbit to use Airtable as a content source
 * with content publishing workflows similar to other content management systems.
 */

export class AirtableContentSource implements ContentSourceInterface<UserContext, DocumentContext, AssetContext> {
    private readonly personalAccessToken: string;
    private readonly baseId: string;
    private readonly manageUrl: string;
    private logger!: Logger;
    private userLogger!: Logger;
    private airtableClient!: AirtableApiClient;
    private onContentChange?: (contentChangeEvent: ContentChangeEvent<DocumentContext, AssetContext>) => void;
    private onSchemaChange?: () => void;
    private assetsTableName: string;
    private assetsTableId?: string;
    private tableModelNameToIdMap?: Record<string, string>;
    private tableModelIdToNameMap?: Record<string, string>;
    private getModelMap: undefined | (() => ModelMap);
    private airtableWebhookCursor: number = 1;
    private airtableWebhookId?: string;

    constructor({ personalAccessToken, baseId, assetsTableName }: ContentSourceOptions) {
        if (!personalAccessToken) {
            throw new Error('AirtableContentSource requires personalAccessToken');
        }
        if (!baseId) {
            throw new Error('AirtableContentSource requires baseId');
        }
        this.personalAccessToken = personalAccessToken;
        this.baseId = baseId;
        this.manageUrl = `https://airtable.com/${this.baseId}`;
        this.assetsTableName = assetsTableName ?? 'Assets';
    }

    /**
     * The `getContentSourceType()` method should return the type of the content
     * source. The content source type must be unique among other content
     * sources used by the same project.
     */
    getContentSourceType(): string {
        return 'airtable';
    }

    /**
     * The `getProjectId()` method should return the unique identifier of the
     * content source instance. In other words, the returned value must be
     * unique among other instances of the same content source.
     */
    getProjectId(): string {
        return this.baseId;
    }

    /**
     * The `getProjectEnvironment()` method should return a string representing
     * additional segmentation of a particular content source instance. This
     * might be useful when a content source supports projects with multiple
     * environments.
     */
    getProjectEnvironment(): string {
        return 'master';
    }

    /**
     * The `getProjectManageUrl()` method should return the URL address of the
     * underlying content source's web application. Stackbit uses this URL to
     * render links to the content source in its UI.
     */
    getProjectManageUrl(): string {
        return this.manageUrl;
    }

    /**
     * The `init()` method should initialize the content source instance. This
     * is a good place to create and initialize API clients, fetch and cache
     * meta-data that does not frequently change, such as locales, users,
     * plugins, etc.
     *
     * This method also receives a single object parameter with the following
     * properties:
     *
     * @param options
     * @param options.logger A logger object used to log messages to the terminal
     *   console. Messages logged with this logger will be visible in the console
     *   when running `stackbit dev`. To configure what log levels will be
     *   printed by `stackbit dev`, use the `--log-level` argument. Example:
     *   `stackbit dev --log-level debug`
     * @param options.userLogger A logger object used to log messages to the
     *   "log" panel in the Stackbit client application.
     * @param options.localDev A boolean flag indicating if the content source
     *   is running in local development mode using the `stackbit dev` command
     *   (true), or if it is running in Stackbit cloud project (false).
     * @param options.webhookUrl A string representing a Stackbit webhook URL
     *   that the content source module can use to create webhooks between the
     *   content source and Stackbit. Webhooks need to be set once. Use
     *   hard-coded webhook names to check that the webhook was already created.
     *   This parameter is empty when `localDev` is `true`.
     */
    async init({ logger, userLogger, localDev, webhookUrl }: InitOptions): Promise<void> {
        this.airtableClient = new AirtableApiClient({
            baseId: this.baseId,
            personalAccessToken: this.personalAccessToken
        });
        this.logger = logger.createLogger({ label: 'airtable' });
        this.userLogger = userLogger.createLogger({ label: 'airtable' });
        this.logger.debug(`initialized AirtableContentSource, baseId: ${this.baseId}`);

        if (webhookUrl) {
            this.logger.debug(`checking if webhook for ${webhookUrl} exists`);
            let webhook = await this.airtableClient.getWebhook({ webhookUrl });
            if (!webhook) {
                this.logger.debug(`no webhook for ${webhookUrl}, creating a new webhook`);
                const newWebhook = await this.airtableClient.createWebhook({ webhookUrl });
                if (newWebhook) {
                    webhook = await this.airtableClient.getWebhook({ webhookId: newWebhook.id });
                }
            }
            if (webhook) {
                this.airtableWebhookId = webhook.id;
                this.airtableWebhookCursor = webhook.cursorForNextPayload;
                this.logger.debug(`next airtable webhook cursor: ${this.airtableWebhookCursor}`);
            }
        }
    }

    /**
     * The `reset()` method should reset the internal state and clean up any
     * instance variables, and cached meta-data fetched in the `init` method and
     * re-fetch it again.
     */
    async reset(): Promise<void> {
        this.assetsTableId = undefined;
    }

    /**
     * Stackbit calls the `onFilesChange()` method when it detects changes in
     * the project files. This method is optional and should be used when the
     * content source stores its schema or content in files within the project
     * repository. In other words, if your content source relies on files within
     * the project repository, you don't need to set up any file-watching
     * processes. Stackbit does it for you.
     *
     * When this method is called, the content source module should
     * check if some of the changed files represent a document or a model and
     * return a matching result.
     *
     * @param updatedFiles The list of updated files. The file paths are
     *   relative to the project root folder.
     */
    async onFilesChange?({ updatedFiles }: { updatedFiles: string[] }): Promise<{
        schemaChanged?: boolean | undefined;
        contentChangeEvent?: ContentChangeEvent<DocumentContext, AssetContext> | undefined;
    }> {
        return {};
    }

    /**
     * Stackbit calls the `onWebhook()` method when the underlying content
     * source calls a previously configured webhook.
     *
     * The content source module can set up webhooks between the underlying
     * content source and Stackbit. Stackbit passes the webhook URL to the
     * `init` method inside the `webhookUrl` property of the `InitOptions`
     * object. When the underlying content source calls the webhook, Stackbit
     * passes the webhook request to this method with its data and request
     * headers. Webhooks can be used to trigger the `onContentChange`, and the
     * `onSchemaChange` callbacks passed to the `startWatchingContentUpdates`
     * method.
     *
     * This method is not called in local development (when localDev is true).
     * To debug webhooks locally, you will need to create a public URL that
     * forwards external webhooks to stackbit dev's internal port: `localhost:8090`.
     * You can use a tool like 'ngrok' and run `ngrok http 8090` to create a
     * public URL that forwards webhooks to stackbit dev. Ngrok will print the
     * public URL it created (e.g., https://xyz.ngrok.io).
     * Use this URL when running stackbit dev:
     * `stackbit dev --log-level=debug --csi-webhook-url=https://xyz.ngrok.io/_stackbit/onWebhook`
     */
    async onWebhook(data: { data: { base: { id: string }; webhook: { id: string }; timestamp: string }; headers: Record<string, string> }): Promise<void> {
        const webhookData = data.data;
        this.logger.debug(`onWebhook => base.id = ${webhookData.base.id} webhook.id = ${webhookData.webhook.id}`);
        if (webhookData.webhook.id !== this.airtableWebhookId) {
            this.logger.debug(`webhook webhook.id '${webhookData.webhook.id}' doesn't match the stored webhook ID ${this.airtableWebhookId}, ignoring webhook`);
            return;
        }
        const modelMap = this.getModelMap?.()!;
        let schemaChanged = false;
        let mightHaveMore = true;
        const createdAndUpdatedRecordIdPairs: string[] = [];
        const createdAndUpdatedAssetIds: string[] = [];
        const deletedRecordIdPairs: string[] = [];
        const deletedAssetIds: string[] = [];
        while (mightHaveMore) {
            const result = await this.airtableClient.getWebhookPayloads({
                webhookId: webhookData.webhook.id,
                cursor: this.airtableWebhookCursor
            });
            const payloads = result.payloads;
            for (const payload of payloads) {
                if (schemaChanged) {
                    break;
                }
                if (payload.destroyedTableIds || payload.createdTablesById) {
                    schemaChanged = true;
                    break;
                }
                if (payload.changedTablesById) {
                    for (const [tableId, changedTableData] of Object.entries(payload.changedTablesById)) {
                        if (
                            changedTableData.changedMetadata ||
                            changedTableData.changedFieldsById ||
                            changedTableData.createdFieldsById ||
                            changedTableData.destroyedFieldIds
                        ) {
                            schemaChanged = true;
                            break;
                        }
                        if (changedTableData.createdRecordsById) {
                            if (tableId === this.assetsTableId) {
                                createdAndUpdatedAssetIds.push(...Object.keys(changedTableData.createdRecordsById));
                            } else {
                                createdAndUpdatedRecordIdPairs.push(
                                    ...Object.keys(changedTableData.createdRecordsById).map((recordId) => `${tableId}:${recordId}`)
                                );
                            }
                        }
                        if (changedTableData.changedRecordsById) {
                            if (tableId === this.assetsTableId) {
                                createdAndUpdatedAssetIds.push(...Object.keys(changedTableData.changedRecordsById));
                            } else {
                                createdAndUpdatedRecordIdPairs.push(
                                    ...Object.keys(changedTableData.changedRecordsById).map((recordId) => `${tableId}:${recordId}`)
                                );
                            }
                        }
                        if (changedTableData.destroyedRecordIds) {
                            if (tableId === this.assetsTableId) {
                                deletedAssetIds.push(...changedTableData.destroyedRecordIds);
                            } else {
                                deletedRecordIdPairs.push(...changedTableData.destroyedRecordIds.map((recordId) => `${tableId}:${recordId}`));
                            }
                        }
                    }
                }
            }
            this.airtableWebhookCursor = result.cursor;
            mightHaveMore = result.mightHaveMore;
        }
        if (schemaChanged) {
            this.onSchemaChange?.();
        } else if (createdAndUpdatedRecordIdPairs.length || createdAndUpdatedAssetIds.length || deletedRecordIdPairs.length || deletedAssetIds.length) {
            const createdAndUpdatedRecordIdsArr = [...Array.from(new Set(createdAndUpdatedRecordIdPairs))];
            const createdAndUpdatedAssetIdsArr = [...Array.from(new Set(createdAndUpdatedAssetIds))];
            const createdAndUpdatedRecords: StatefulRecord<StateFields>[] = [];
            const updatedAssetRecords: Airtable.Record<AssetRecordFields>[] = [];
            for (const idPair of createdAndUpdatedRecordIdsArr) {
                const [tableId, recordId] = idPair.split(':');
                const record = await this.airtableClient.getStatefulRecordById({
                    tableId: tableId,
                    tableName: this.tableModelIdToNameMap?.[tableId] ?? tableId,
                    recordId: recordId,
                    preview: true,
                    includeToBeDeleted: true
                });
                if (record) {
                    createdAndUpdatedRecords.push(record);
                }
            }
            for (const assetId of createdAndUpdatedAssetIdsArr) {
                const assetRecord = await this.airtableClient.getAirtableRecordById<AssetRecordFields>({
                    tableId: this.assetsTableId!,
                    recordId: assetId
                });
                if (assetRecord) {
                    updatedAssetRecords.push(assetRecord);
                }
            }
            const documents = convertAirtableRecordsToStackbitDocuments(createdAndUpdatedRecords, modelMap, this.manageUrl);
            const assets = convertAirtableAssetRecordsToStackbitAssets(updatedAssetRecords, `${this.manageUrl}/${this.assetsTableId}`);
            const contentChanges: ContentChangeEvent<DocumentContext, AssetContext> = {
                documents: documents,
                assets: assets,
                deletedDocumentIds: [...Array.from(new Set(deletedRecordIdPairs))],
                deletedAssetIds: [...Array.from(new Set(deletedAssetIds))]
            };
            this.onContentChange?.(contentChanges);
        }
    }

    /**
     * Stackbit calls the startWatchingContentUpdates() after it has fetched all
     * models and content and is ready to receive content or schema updates.
     *
     * This method should start watching for content and schema changes using
     * any available synchronization technique, for example, polling the
     * underlying API, setting up server-to-server listeners, and webhooks.
     *
     * When the content source module identifies a content or schema update,
     * it should call the `onContentChange` or the `onSchemaChange` callbacks.
     *
     * The content source module should remain stateless. It should not store
     * models, documents, or assets. If you need to access models, documents, or
     * assets previously returned by `getModels`, `getDocuments`, or `getAssets`
     * methods, use `getModelMap`, `getDocument`, or `getAsset` functions
     * provided to this and other methods.
     */
    startWatchingContentUpdates(options: {
        getModelMap: () => ModelMap;
        getDocument: ({ documentId }: { documentId: string }) => Document<DocumentContext> | undefined;
        getAsset: ({ assetId }: { assetId: string }) => Asset<AssetContext> | undefined;
        onContentChange: (contentChangeEvent: ContentChangeEvent<DocumentContext, AssetContext>) => Promise<void>;
        onSchemaChange: () => void;
    }): void {
        this.getModelMap = options.getModelMap;
        this.onContentChange = options.onContentChange;
        this.onSchemaChange = options.onSchemaChange;
    }

    /**
     * Stackbit calls the `stopWatchingContentUpdates()` method to stop
     * receiving content and schema change updates.
     *
     * This method should stop watching for content and schema updates and stop
     * calling the `onContentChange` or the `onSchemaChange` callbacks until the
     * `startWatchingContentUpdates()` method is called again.
     */
    stopWatchingContentUpdates(): void {
        this.onContentChange = undefined;
    }

    /**
     * The `getModels()` method should fetch the content models from the content
     * source and convert them to an array of Stackbit Models.
     */
    async getModels(): Promise<Model[]> {
        this.logger.debug('getModels => fetch table models from Airtable');
        const airtableModels = await this.airtableClient.getTableModels({ includeAssetsTable: true, assetsTableName: this.assetsTableName });
        this.assetsTableId = airtableModels.find((table) => table.name === this.assetsTableName)?.id;
        this.tableModelNameToIdMap = airtableModels.reduce((accum: Record<string, string>, airtableModel) => {
            accum[airtableModel.name] = airtableModel.id;
            return accum;
        }, {});
        this.tableModelIdToNameMap = airtableModels.reduce((accum: Record<string, string>, airtableModel) => {
            accum[airtableModel.id] = airtableModel.name;
            return accum;
        }, {});
        this.logger.debug(`fetched ${airtableModels.length} table models from Airtable`);
        return convertAirtableModelsToStackbitModels(airtableModels);
    }

    /**
     * The `getLocales()` method should fetch the available locales from the
     * content source and convert them to an array of Stackbit Locales.
     */
    async getLocales(): Promise<Locale[]> {
        return [];
    }

    /**
     * The `getDocuments()` method should fetch all the documents from the
     * content source and convert them to Stackbit Documents. You can use
     * `DocumentContext` to extend Stackbit Documents with additional data that
     * your content source needs. Stackbit will cache the documents with their
     * DocumentContext data and pass it back to methods that need to access
     * the documents.
     *
     * @param {Object} options
     * @param {ModelMap} options.modelMap A map of models by their names as
     *   returned by `getModels()` method.
     */
    async getDocuments(options: { modelMap: ModelMap }): Promise<Document<DocumentContext>[]> {
        this.logger.debug('getDocuments => fetch records from Airtable');
        const records = await this.airtableClient.getAllStatefulRecords({ preview: true, includeToBeDeleted: true });
        this.logger.debug(`fetched ${records.length} records from airtable`);
        return convertAirtableRecordsToStackbitDocuments(records, options.modelMap, this.manageUrl);
    }

    /**
     * The `getAssets()` method should fetch all the assets from the content
     * source and convert them to Stackbit Assets. You can use `AssetContext` to
     * extend Stackbit Assets with additional data that your content source
     * needs. Stackbit will cache the assets with their AssetContext data and
     * pass it back to methods that need to access the assets.
     */
    async getAssets(): Promise<Asset<AssetContext>[]> {
        this.logger.debug('getAssets => fetch assets from Airtable');
        if (!this.assetsTableId) {
            return [];
        }
        const assetRecords = await this.airtableClient.getAirtableRecordsForTable<AssetRecordFields>({ tableId: this.assetsTableId });
        this.logger.debug(`fetched ${assetRecords.length} assets from Airtable`);
        return convertAirtableAssetRecordsToStackbitAssets(assetRecords, `${this.manageUrl}/${this.assetsTableId}`);
    }

    /**
     * The `hasAccess()` method should check if the current user has read/write
     * access to the content source. Stackbit will pass the `userContext` for
     * content sources having OAuth flow integration with Stackbit. Please get
     * in touch with Stackbit support if you want to integrate your content
     * source's OAuth flow with Stackbit.
     */
    async hasAccess(options: { userContext?: UserContext }): Promise<{
        hasConnection: boolean;
        hasPermissions: boolean;
    }> {
        return { hasConnection: true, hasPermissions: true };
    }

    /**
     * The `createDocument()` method should create a document in the underlying
     * content source and return the created document as a Stackbit Document.
     *
     * @param {Object} options
     * @param {Record<string, UpdateOperationField>} options.updateOperationFields
     *   A map of update operation fields by field names.
     * @param {Model} options.model A model representing the document to be created.
     * @param {ModelMap} options.modelMap A map of models by their names as
     *   returned by `getModels()` method.
     * @param {string} options.locale A locale id for the document to be created.
     * @param {UserContext} options.userContext User properties provided by
     *   OAuth flow between Stackbit and the underlying content source.
     */
    async createDocument(options: {
        updateOperationFields: Record<string, UpdateOperationField>;
        model: Model;
        modelMap: ModelMap;
        locale?: string;
        userContext?: UserContext;
    }): Promise<Document<DocumentContext>> {
        this.logger.debug('createDocument => create Airtable record');
        const fields: Partial<StateFields> = {};
        for (const [fieldName, updateOperationField] of Object.entries(options.updateOperationFields)) {
            fields[fieldName] = convertOperationFieldToAirtableField(updateOperationField);
        }
        const record = await this.airtableClient.createRecord({
            tableId: this.tableModelNameToIdMap?.[options.model.name] ?? options.model.name,
            tableName: options.model.name,
            fields
        });
        this.logger.debug(`created Airtable record, id: ${record.id}`);
        const createdDocument = convertAirtableRecordsToStackbitDocuments([record], options.modelMap, this.manageUrl)[0];

        // Call onContentChange callback to let Stackbit know that the content was updated.
        // ⚠️ Note: calling onContentChange right after creating a document is
        // not always the best solution. Some content sources may have delays
        // between the time the response for document creation was returned and
        // the time the document became available for consumptions via its APIs.
        // Therefore, it is recommended to call `onContentChange` callback when
        // the underlying content source notifies, via webhook, server events,
        // or other synchronization techniques, that the updated content is
        // availability for consumption via API.
        this.onContentChange?.({
            documents: [createdDocument],
            assets: [],
            deletedDocumentIds: [],
            deletedAssetIds: []
        });

        return createdDocument;
    }

    /**
     * The `updateDocument()` method should update a document in the underlying
     * content source and return the updated document as a Stackbit Document.
     *
     * @param {Object} options
     * @param {Document} options.document A document to be updated.
     * @param {UpdateOperation[]} options.operations An array of update
     *   operations.
     * @param {ModelMap} options.modelMap A map of models by their names as
     *   returned by `getModels()` method.
     * @param {UserContext} options.userContext User properties provided by
     *   OAuth flow between Stackbit and the underlying content source.
     */
    async updateDocument(options: {
        document: Document<DocumentContext>;
        operations: UpdateOperation[];
        modelMap: ModelMap;
        userContext?: UserContext;
    }): Promise<Document<DocumentContext>> {
        this.logger.debug('updateDocument => update Airtable record');
        const updatedFields: Partial<StateFields> = {};
        for (const operation of options.operations) {
            if (operation.opType === 'set') {
                const { field, fieldPath } = operation;
                updatedFields[fieldPath[0]] = convertOperationFieldToAirtableField(field);
            } else if (operation.opType === 'unset') {
                const { fieldPath, modelField } = operation;
                switch (modelField.type) {
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
                        updatedFields[fieldPath[0]] = undefined;
                        break;
                    case 'reference':
                        updatedFields[fieldPath[0]] = [];
                        break;
                    case 'cross-reference':
                    case 'richText':
                    case 'json':
                    case 'style':
                    case 'image':
                    case 'file':
                    case 'object':
                    case 'model':
                    case 'list':
                        throw new Error(`updating field of type ${modelField.type} not implemented`);
                    default:
                        const _exhaustiveCheck: never = modelField;
                        break;
                }
            } else if (['insert', 'remove', 'reorder'].includes(operation.opType)) {
                throw new Error(`'${operation.opType}' operation not implemented`);
            }
        }
        const updatedRecord = await this.airtableClient.updateRecord({
            tableId: options.document.context.tableId,
            tableName: options.document.modelName,
            recordId: options.document.id,
            fields: updatedFields
        });
        this.logger.debug(`update Airtable record, id: ${updatedRecord.id}`);
        const updatedDocument = convertAirtableRecordsToStackbitDocuments([updatedRecord], options.modelMap, this.manageUrl)[0];

        // Call onContentChange callback to let Stackbit know that the content was updated.
        this.onContentChange?.({
            documents: [updatedDocument],
            assets: [],
            deletedDocumentIds: [],
            deletedAssetIds: []
        });

        return updatedDocument;
    }

    /**
     * The `deleteDocument()` method should delete a document from the underlying
     * content source.
     *
     * @param {Object} options
     * @param {Document} options.document A document to be deleted.
     * @param {UserContext} options.userContext User properties provided by
     *   OAuth flow between Stackbit and the underlying content source.
     */
    async deleteDocument(options: { document: Document<DocumentContext>; userContext?: UserContext }): Promise<void> {
        const deletedRecord = await this.airtableClient.deleteRecord({
            tableId: options.document.context.tableId,
            tableName: options.document.modelName,
            recordId: options.document.id
        });

        // Call onContentChange callback to let Stackbit know that the content was updated.
        this.onContentChange?.({
            documents: [],
            assets: [],
            deletedDocumentIds: [deletedRecord.id],
            deletedAssetIds: []
        });
    }

    /**
     * The `uploadAsset()` method should upload an asset to the underlying
     * content source and return the upload asset as a Stackbit Asset.
     */
    async uploadAsset(options: {
        url?: string | undefined;
        base64?: string | undefined;
        fileName: string;
        mimeType: string;
        locale?: string | undefined;
        userContext?: UserContext;
    }): Promise<Asset<AssetContext>> {
        this.logger.debug('uploadAsset => upload Asset to Airtable');

        if (!options.url) {
            throw new Error('uploading assets from base64 is not supported');
        }

        if (!this.assetsTableId) {
            throw new Error('no assets table was found');
        }

        const assetRecord = await this.airtableClient.createAsset({
            url: options.url,
            filename: options.fileName,
            assetsTableId: this.assetsTableId
        });
        const assetDocuments = convertAirtableAssetRecordsToStackbitAssets([assetRecord], `${this.manageUrl}/${this.assetsTableId}`);
        return assetDocuments[0]!;
    }

    /**
     * The `validateDocuments()` method should validate documents according to
     * the underlying content source validation rules and return
     * DocumentValidationErrors in case the documents do not pass validation.
     */
    async validateDocuments(options: {
        documents: Document<DocumentContext>[];
        assets: Asset<AssetContext>[];
        locale?: string | undefined;
        userContext?: UserContext;
    }): Promise<{ errors: ValidationError[] }> {
        return { errors: [] };
    }

    /**
     * The `publishDocuments()` method should publish documents in the
     * underlying content source.
     */
    async publishDocuments(options: { documents: Document<DocumentContext>[]; assets: Asset<AssetContext>[]; userContext?: UserContext }): Promise<void> {
        const publishResult = await this.airtableClient.publishRecords({
            recordsMeta: options.documents.map((document) => {
                return {
                    tableId: document.context.tableId,
                    tableName: document.modelName,
                    recordId: document.id
                };
            })
        });

        const modelMap = this.getModelMap?.();
        if (!modelMap) {
            return;
        }

        // Call onContentChange callback to let Stackbit know that the content was updated.
        this.onContentChange?.({
            documents: convertAirtableRecordsToStackbitDocuments(publishResult.publishedRecords, modelMap, this.manageUrl),
            assets: [],
            deletedDocumentIds: publishResult.deletedRecordsIds,
            deletedAssetIds: []
        });
    }
}
