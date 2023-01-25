export interface AirtableTableModel {
    id: string;
    name: string;
    primaryFieldId: string;
    description?: string;
    fields: AirtableFieldModel[];
    views: AirtableViewModel[];
}

export type AirtableFieldType = AirtableFieldModel['type'];

export interface AirtableViewModel {
    id: string;
    type: 'grid' | 'form' | 'calendar' | 'gallery' | 'kanban' | 'timeline' | 'block';
    name: string;
    visibleFieldIds?: string[];
}

export type AirtableFieldModel =
    | AirtableFieldModelSimple
    | AirtableFieldModelMultipleAttachments
    | AirtableFieldModelCheckbox
    | AirtableFieldModelSingleCollaborator
    | AirtableFieldModelCount
    | AirtableFieldModelCreatedTime
    | AirtableFieldModelCurrency
    | AirtableFieldModelDate
    | AirtableFieldModelDateTime
    | AirtableFieldModelDuration
    | AirtableFieldModelFormula
    | AirtableFieldModelLastModifiedTime
    | AirtableFieldModelMultipleRecordLinks
    | AirtableFieldModelLookup
    | AirtableFieldModelMultipleCollaborators
    | AirtableFieldModelMultipleSelects
    | AirtableFieldModelNumber
    | AirtableFieldModelPercent
    | AirtableFieldModelRating
    | AirtableFieldModelRollup
    | AirtableFieldModelSingleSelect
    | AirtableFieldModelExternalSyncSource;

export interface AirtableFieldModelBase {
    id: string;
    name: string;
    description?: string;
}

export interface AirtableFieldModelSimple extends AirtableFieldModelBase {
    type?:
        | 'singleLineText'
        | 'email'
        | 'url'
        | 'multilineText'
        | 'phoneNumber'
        | 'multipleLookupValues'
        | 'autoNumber'
        | 'barcode'
        | 'richText'
        | 'button'
        | 'createdBy'
        | 'lastModifiedBy';
    options?: any;
}

export interface AirtableFieldModelMultipleAttachments extends AirtableFieldModelBase {
    type: 'multipleAttachments';
    options: {
        isReversed: boolean;
    };
}

export interface AirtableFieldModelCheckbox extends AirtableFieldModelBase {
    type: 'checkbox';
    options: {
        color:
            | 'yellowBright'
            | 'orangeBright'
            | 'redBright'
            | 'pinkBright'
            | 'purpleBright'
            | 'blueBright'
            | 'cyanBright'
            | 'tealBright'
            | 'greenBright'
            | 'grayBright';
        icon: 'check' | 'xCheckbox' | 'star' | 'heart' | 'thumbsUp' | 'flag' | 'dot';
    };
}

export interface AirtableFieldModelSingleCollaborator extends AirtableFieldModelBase {
    type: 'singleCollaborator';
    options: any;
}

export interface AirtableFieldModelCount extends AirtableFieldModelBase {
    type: 'count';
    options: {
        isValid: boolean;
        recordLinkFieldId?: string | null;
    };
}

export interface AirtableFieldModelCreatedTime extends AirtableFieldModelBase {
    type: 'createdTime';
    options: {
        result: any;
    };
}

export interface AirtableFieldModelCurrency extends AirtableFieldModelBase {
    type: 'currency';
    options: {
        precision: number;
        symbol: string;
    };
}

export interface AirtableFieldModelDate extends AirtableFieldModelBase {
    type: 'date';
    options: {
        dateFormat: {
            format: 'l' | 'LL' | 'M/D/YYYY' | 'D/M/YYYY' | 'YYYY-MM-DD';
            name: 'local' | 'friendly' | 'us' | 'european' | 'iso';
        };
    };
}

export interface AirtableFieldModelDateTime extends AirtableFieldModelBase {
    type: 'dateTime';
    options: {
        timeZone: string;
        dateFormat: {
            format: 'l' | 'LL' | 'M/D/YYYY' | 'D/M/YYYY' | 'YYYY-MM-DD';
            name: 'local' | 'friendly' | 'us' | 'european' | 'iso';
        };
        timeFormat: {
            format: 'h:mma' | 'HH:mm';
            name: '12hour' | '24hour';
        };
    };
}

export interface AirtableFieldModelDuration extends AirtableFieldModelBase {
    type: 'duration';
    options: {
        durationFormat: 'h:mm' | 'h:mm:ss' | 'h:mm:ss.S' | 'h:mm:ss.SS' | 'h:mm:ss.SSS';
    };
}

export interface AirtableFieldModelFormula extends AirtableFieldModelBase {
    type: 'formula';
    options: {
        isValid: boolean;
        referencedFieldIds: string[] | null;
        result: any;
    };
}

export interface AirtableFieldModelLastModifiedTime extends AirtableFieldModelBase {
    type: 'lastModifiedTime';
    options: {
        isValid: boolean;
        referencedFieldIds: string[] | null;
        result: any;
    };
}

export interface AirtableFieldModelMultipleRecordLinks extends AirtableFieldModelBase {
    type: 'multipleRecordLinks';
    options: {
        isReversed: boolean;
        linkedTableId: string;
        prefersSingleRecordLink: boolean;
        inverseLinkFieldId?: string;
        viewIdForRecordSelection?: string;
    };
}

export interface AirtableFieldModelLookup extends AirtableFieldModelBase {
    type: 'lookup';
    options: {
        fieldIdInLinkedTable: string | null;
        isValid: boolean;
        recordLinkFieldId: string | null;
        result: any;
    };
}

export interface AirtableFieldModelMultipleCollaborators extends AirtableFieldModelBase {
    type: 'multipleCollaborators';
    options: any;
}

export interface AirtableFieldModelMultipleSelects extends AirtableFieldModelBase {
    type: 'multipleSelects';
    options: {
        choices: {
            id: string;
            color?: SelectionColors;
            name: string;
        }[];
    };
}

export interface AirtableFieldModelNumber extends AirtableFieldModelBase {
    type: 'number';
    options: {
        precision: number;
    };
}

export interface AirtableFieldModelPercent extends AirtableFieldModelBase {
    type: 'percent';
    options: {
        precision: number;
    };
}

export interface AirtableFieldModelRating extends AirtableFieldModelBase {
    type: 'rating';
    options: {
        color:
            | 'yellowBright'
            | 'orangeBright'
            | 'redBright'
            | 'pinkBright'
            | 'purpleBright'
            | 'blueBright'
            | 'cyanBright'
            | 'tealBright'
            | 'greenBright'
            | 'grayBright';
        icon: 'star' | 'heart' | 'thumbsUp' | 'flag' | 'dot';
        max: number;
    };
}

export interface AirtableFieldModelRollup extends AirtableFieldModelBase {
    type: 'rollup';
    options: {
        fieldIdInLinkedTable?: string;
        recordLinkFieldId?: string;
        result: any;
        isValid?: boolean;
        referencedFieldIds?: string[];
    };
}

export interface AirtableFieldModelSingleSelect extends AirtableFieldModelBase {
    type: 'singleSelect';
    options: {
        choices: {
            id: string;
            color?: SelectionColors;
            name: string;
        }[];
    };
}

export interface AirtableFieldModelExternalSyncSource extends AirtableFieldModelBase {
    type: 'externalSyncSource';
    options: {
        choices: {
            id: string;
            color?: SelectionColors;
            name: string;
        }[];
    };
}

export type SelectionColors =
    | 'blueLight2'
    | 'cyanLight2'
    | 'tealLight2'
    | 'greenLight2'
    | 'yellowLight2'
    | 'orangeLight2'
    | 'redLight2'
    | 'pinkLight2'
    | 'purpleLight2'
    | 'grayLight2'
    | 'blueLight1'
    | 'cyanLight1'
    | 'tealLight1'
    | 'greenLight1'
    | 'yellowLight1'
    | 'orangeLight1'
    | 'redLight1'
    | 'pinkLight1'
    | 'purpleLight1'
    | 'grayLight1'
    | 'blueBright'
    | 'cyanBright'
    | 'tealBright'
    | 'greenBright'
    | 'yellowBright'
    | 'orangeBright'
    | 'redBright'
    | 'pinkBright'
    | 'purpleBright'
    | 'grayBright'
    | 'blueDark1'
    | 'cyanDark1'
    | 'tealDark1'
    | 'greenDark1'
    | 'yellowDark1'
    | 'orangeDark1'
    | 'redDark1'
    | 'pinkDark1'
    | 'purpleDark1'
    | 'grayDark1';
