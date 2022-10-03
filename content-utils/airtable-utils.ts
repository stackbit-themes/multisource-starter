import Airtable  from 'airtable';
import { fetchTable } from '../airtable-content-source/airtable-utils';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

export type ResolvedRecord = {
    id: string;
    fields: Record<string, any>;
};

export async function getAirtableRecords(): Promise<ResolvedRecord[]> {
    const apiKey = process.env.AIRTABLE_API_KEY;
    if (!apiKey) {
        throw new Error('AIRTABLE_API_KEY environment variable was not provided');
    }
    const baseId = process.env.AIRTABLE_BASE_ID;
    if (!baseId) {
        throw new Error('AIRTABLE_BASE_ID environment variable was not provided');
    }
    const client = new Airtable({ apiKey: apiKey });
    const base = client.base(baseId);
    const heroSections = await fetchTable(base, 'HeroSection');
    const buttons = await fetchTable(base, 'Button');
    const assets = await fetchTable(base, 'Asset');
    const children = [...buttons.map((button) => button._rawJson), ...assets.map((asset) => asset._rawJson)];
    return heroSections.map((heroSection): ResolvedRecord => {
        const { fields, ...rest } = heroSection._rawJson;
        return {
            ...rest,
            fields: Object.entries(fields).reduce((fields: any, [fieldName, fieldValue]) => {
                if ((fieldName === 'Buttons' || fieldName === 'Asset') && Array.isArray(fieldValue)) {
                    fields[fieldName] = fieldValue
                        .map((value: string) => children.find((record) => record.id === value))
                        .filter((value): value is Airtable.Record<Airtable.FieldSet> => !!value);
                } else {
                    fields[fieldName] = fieldValue;
                }
                return fields;
            }, {})
        };
    });
}
