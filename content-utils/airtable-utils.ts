import Airtable from 'airtable';
import { fetchTable } from '../airtable-content-source/airtable-utils';
import { HeroSectionFields, ButtonFields, AssetFields } from '../airtable-content-source/models';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

export type IdProp = { id: string };
export type ButtonProps = IdProp & ButtonFields;
export type AssetProps = IdProp & AssetFields;
export type HeroSectionProps = IdProp &
    Omit<HeroSectionFields, 'Buttons' | 'Asset'> & {
        Buttons?: ButtonProps[];
        Asset?: AssetProps;
    };

export async function getAirtableRecords(isPreview: boolean): Promise<HeroSectionProps[]> {
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

    // fetch all records from airtable;
    const heroSections = await fetchTable<HeroSectionFields>(base, 'HeroSection');
    const buttons = await fetchTable<ButtonFields>(base, 'Button');
    const assets = await fetchTable<AssetFields>(base, 'Asset');

    return (
        heroSections
            // In preview mode, filter out "deleted", "published-deleted" and "published-changed" records.
            // Instead of the "published-changed" record the preview will use the "changed" counterpart of that record.
            // In production mode, filter out "draft", "changed" and "deleted" as we don't want to build with non-published records.
            .filter((heroSections) => {
                if (isPreview) {
                    return ['draft', 'changed', 'published'].includes(heroSections.fields.Status);
                }
                return ['published', 'published-changed', 'published-deleted'].includes(heroSections.fields.Status);
            })
            .map((heroSection): HeroSectionProps => {
                const { id, fields } = heroSection;
                const { Buttons: buttonIds, Asset: assetIds, Status, ...restFields } = fields;
                let resolvedButtons: ButtonProps[] | undefined = undefined;
                if (buttonIds) {
                    // Linked button IDs always point to the "published" or "published-*" records, if record was never
                    // published, they point to "draft", and if it was deleted they point to "deleted".
                    resolvedButtons = buttonIds
                        .map((buttonId): Airtable.Record<ButtonFields> | null => {
                            const button = buttons.find((record) => record.id === buttonId);
                            if (!button || button.fields.Status === 'deleted') {
                                return null;
                            }
                            if (!isPreview) {
                                if (button.fields.Status === 'draft') {
                                    return null;
                                }
                                return button;
                            }
                            if (button.fields.Status === 'published-deleted') {
                                return null;
                            }
                            if (button.fields.Status === 'published-changed') {
                                return buttons.find((record) => record.id === button.fields.Related?.[0]) ?? null;
                            }
                            return button;
                        })
                        .filter((button): button is Airtable.Record<ButtonFields> => !!button)
                        .map((button): ButtonProps => {
                            return {
                                id: button.id,
                                ...button.fields
                            };
                        });
                }
                let resolvedAsset: AssetProps | undefined;
                if (assetIds) {
                    resolvedAsset = assetIds
                        .map((assetId): AssetProps | null => {
                            const asset = assets.find((record) => record.id === assetId);
                            if (!asset) {
                                return null;
                            }
                            return {
                                id: asset.id,
                                ...asset.fields
                            };
                        })
                        .filter((asset): asset is AssetProps => !!asset)[0];
                }
                type OptionalHeroFields = Omit<HeroSectionProps, 'id' | 'Status'>;
                const keyValues = Object.entries({
                    ...restFields,
                    Buttons: resolvedButtons,
                    Asset: resolvedAsset
                }) as [keyof OptionalHeroFields, OptionalHeroFields[keyof OptionalHeroFields]][];
                return {
                    // replace the id of the changed record with id of the published record
                    // to ensure that cross-references are linked correctly using the published record id
                    id: Status === 'changed' ? heroSection.fields.Related![0] : id,
                    Status,
                    ...keyValues.reduce((accum: OptionalHeroFields, [key, value]: [keyof OptionalHeroFields, any]) => {
                        if (typeof value === 'undefined') {
                            return accum;
                        }
                        accum[key] = value;
                        return accum;
                    }, {})
                };
            })
    );
}
