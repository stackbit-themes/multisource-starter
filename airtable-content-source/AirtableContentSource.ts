import Airtable from 'airtable';

import type { Model } from '@stackbit/sdk';
import type { ContentSourceTypes } from '@stackbit/cms-core';

import { Button, HeroSection } from './models';
import { fetchTable, convertAirtableRecordsToStackbitDocuments, convertAirtableRecordsToStackbitAssets } from './airtable-utils';

type UserContext = {};

export type ContentSourceOptions = {
    apiKey: string;
    baseId: string;
    manageUrl?: string;
};

export class AirtableContentSource implements ContentSourceTypes.ContentSourceInterface<UserContext> {
    private readonly apiKey: string;
    private readonly baseId: string;
    private readonly manageUrl?: string;
    private logger!: ContentSourceTypes.Logger;
    private userLogger!: ContentSourceTypes.Logger;
    private client!: Airtable;
    private base!: Airtable.Base;
    onContentChange: null | ((contentChangeEvent: ContentSourceTypes.ContentChangeEvent<unknown, unknown>) => void) = null;

    constructor({ apiKey, baseId, manageUrl }: ContentSourceOptions) {
        this.apiKey = apiKey ?? process.env.AIRTABLE_API_KEY;
        this.baseId = baseId ?? process.env.AIRTABLE_BASE_ID;
        this.manageUrl = manageUrl ?? process.env.AIRTABLE_MANAGE_URL;
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
        return this.manageUrl ?? 'https://www.example.com';
    }

    async init({ logger, userLogger, localDev }: ContentSourceTypes.InitOptions): Promise<void> {
        this.client = new Airtable({ apiKey: this.apiKey });
        this.base = this.client.base(this.baseId);
        this.logger = logger.createLogger({ label: 'airtable' });
        this.userLogger = userLogger.createLogger({ label: 'airtable' });
    }

    async reset(): Promise<void> {}

    onFilesChange?({ updatedFiles }: { updatedFiles: string[] }): {
        schemaChanged?: boolean | undefined;
        contentChangeEvent?: ContentSourceTypes.ContentChangeEvent<unknown, unknown> | undefined;
    } {
        return {};
    }

    startWatchingContentUpdates(options: {
        getModelMap: () => ContentSourceTypes.ModelMap;
        getDocument: ({ documentId }: { documentId: string }) => ContentSourceTypes.Document<unknown> | undefined;
        getAsset: ({ assetId }: { assetId: string }) => ContentSourceTypes.Asset<unknown> | undefined;
        onContentChange: (contentChangeEvent: ContentSourceTypes.ContentChangeEvent<unknown, unknown>) => void;
        onSchemaChange: () => void;
    }): void {
        this.onContentChange = options.onContentChange;
    }

    stopWatchingContentUpdates(): void {
        this.onContentChange = null;
    }

    async getModels(): Promise<Model[]> {
        this.logger.debug('getModels');
        return [HeroSection, Button];
    }

    async getLocales(): Promise<ContentSourceTypes.Locale[]> {
        return [];
    }

    async getDocuments(options: { modelMap: ContentSourceTypes.ModelMap }): Promise<ContentSourceTypes.Document<unknown>[]> {
        this.logger.debug('getDocuments');
        const heroSections = await fetchTable(this.base, 'HeroSection');
        const buttons = await fetchTable(this.base, 'Button');
        const records = [...heroSections, ...buttons];
        this.logger.debug(`fetched ${records.length} records from airtable`);
        return convertAirtableRecordsToStackbitDocuments(records, options.modelMap);
    }

    async getAssets(): Promise<ContentSourceTypes.Asset<unknown>[]> {
        this.logger.debug('getAssets');
        const assets = await fetchTable(this.base, 'Asset');
        this.logger.debug(`fetched ${assets.length} assets from airtable`);
        return convertAirtableRecordsToStackbitAssets(assets);
    }

    async hasAccess(options: { userContext?: UserContext }): Promise<boolean> {
        return true;
    }

    async createDocument(options: {
        updateOperationFields: Record<string, ContentSourceTypes.UpdateOperationField>;
        model: Model;
        modelMap: ContentSourceTypes.ModelMap;
        locale?: string;
        userContext?: UserContext;
    }): Promise<ContentSourceTypes.Document> {
        throw new Error('Method not implemented.');
    }

    async updateDocument(options: {
        document: ContentSourceTypes.Document<unknown>;
        operations: ContentSourceTypes.UpdateOperation[];
        modelMap: ContentSourceTypes.ModelMap;
        userContext?: UserContext;
    }): Promise<ContentSourceTypes.Document<unknown>> {
        // throw new Error('Method not implemented.');
        const fields = {};
        for (const operation of options.operations) {
            if (operation.opType === 'set') {
                const { field, fieldPath, locale, modelField } = operation;
                // @ts-ignore
                fields[fieldPath[0]] = field.value;
            }
        }
        const records = await this.base('HeroSection').update([
            {
                id: options.document.id,
                fields: fields
            }
        ]);
        return convertAirtableRecordsToStackbitDocuments(records, options.modelMap)[0];
    }

    async deleteDocument(options: { document: ContentSourceTypes.Document<unknown>; userContext?: UserContext }): Promise<void> {
        throw new Error('Method not implemented.');
    }

    async uploadAsset(options: {
        url?: string | undefined;
        base64?: string | undefined;
        fileName: string;
        mimeType: string;
        locale?: string | undefined;
        userContext?: UserContext;
    }): Promise<ContentSourceTypes.Asset<unknown>> {
        throw new Error('Method not implemented.');
    }

    async validateDocuments(options: {
        documents: ContentSourceTypes.Document<unknown>[];
        assets: ContentSourceTypes.Asset<unknown>[];
        locale?: string | undefined;
        userContext?: UserContext;
    }): Promise<{ errors: ContentSourceTypes.ValidationError[] }> {
        throw new Error('Method not implemented.');
    }

    async publishDocuments(options: {
        documents: ContentSourceTypes.Document<unknown>[];
        assets: ContentSourceTypes.Asset<unknown>[];
        userContext?: UserContext;
    }): Promise<void> {
        throw new Error('Method not implemented.');
    }
}
