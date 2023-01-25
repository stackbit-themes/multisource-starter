import { AirtableApiClient, StateFields, StatefulRecord } from '../airtable-api-client/airtable-api-client';

export interface AirtableSectionFields extends StateFields {
    Title?: string;
    Subtitle?: string;
}

export type AirtableSectionRecord = StatefulRecord<AirtableSectionFields>;

export async function getRecords({ isPreview }: { isPreview: boolean }): Promise<AirtableSectionRecord[]> {
    const airtableClient = getAirtableClient();
    return await airtableClient.getStatefulRecordsForTable<AirtableSectionFields>({
        tableId: 'Sections',
        tableName: 'Sections',
        preview: isPreview
    });
}

export function getAirtableClient() {
    if (!process.env.AIRTABLE_BASE_ID) {
        throw new Error('AIRTABLE_BASE_ID environment variable is not set');
    }
    if (!process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN) {
        throw new Error('AIRTABLE_PERSONAL_ACCESS_TOKEN environment variable is not set');
    }
    return new AirtableApiClient({
        baseId: process.env.AIRTABLE_BASE_ID,
        personalAccessToken: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN
    });
}
