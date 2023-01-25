import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import Markdown from 'markdown-to-jsx';
import type { Entry } from 'contentful';
import type { GetStaticProps, GetStaticPaths, NextPage } from 'next';

import styles from '../styles/Home.module.css';
import { getEntries, ContentfulSectionEntry, ContentfulPageFields, ContentfulSectionFields, ContentfulPageEntry } from '../api-utils/contentful-api';
import { getDocuments, SanitySectionDocument } from '../api-utils/sanity-api';
import { getRecords, AirtableSectionRecord } from '../api-utils/airtable-api';

/**
 * When isPreview is `true`, the page will render non-published content or content with pending changes.
 * When isPreview is `false`, the page will render only published content.
 */
const isPreview = process.env.NODE_ENV === 'development';

export const getStaticPaths: GetStaticPaths = async () => {
    const pageEntries = await getEntries({ isPreview, query: { content_type: 'page' } });
    const paths = pageEntries.map((page: Entry<any>) => {
        const slug = page.fields.slug.replace(/^\/|\/$/g, '');
        return { params: { slug: slug.split('/') } };
    });
    return {
        paths: paths,
        fallback: false
    };
};

type PageProps = {
    contentfulSpaceId: string;
    sanityProjectId: string;
    airtableBaseId: string;
    pageEntries: ContentfulPageEntry[];
    pageEntry: ContentfulPageEntry | null;
    contentfulSections: ContentfulSectionEntry[];
    sanitySections: SanitySectionDocument[];
    airtableSections: AirtableSectionRecord[];
};

export const getStaticProps: GetStaticProps<PageProps, { slug: string[] }> = async ({ params }) => {
    const pageEntries = await getEntries<ContentfulPageFields>({ isPreview, query: { content_type: 'page' } });
    const urlPath = '/' + (params?.slug || []).join('/');
    const pageEntry = pageEntries.find((pageEntry) => {
        return pageEntry.fields.slug.replace(/^\/|\/$/g, '') === urlPath.replace(/^\/|\/$/g, '');
    });
    if (!pageEntry) {
        return {
            props: {
                contentfulSpaceId: process.env.CONTENTFUL_SPACE_ID!,
                sanityProjectId: process.env.SANITY_PROJECT_ID!,
                airtableBaseId: process.env.AIRTABLE_BASE_ID!,
                pageEntries: pageEntries,
                pageEntry: null,
                contentfulSections: [],
                sanitySections: [],
                airtableSections: []
            }
        };
    }
    const contentfulSections = await getEntries<ContentfulSectionFields>({ isPreview, query: { content_type: 'contentfulSection' } });
    const sanitySections = await getDocuments({ isPreview });
    const airtableSections = await getRecords({ isPreview });
    return {
        props: {
            contentfulSpaceId: process.env.CONTENTFUL_SPACE_ID!,
            sanityProjectId: process.env.SANITY_PROJECT_ID!,
            airtableBaseId: process.env.AIRTABLE_BASE_ID!,
            pageEntries: pageEntries,
            pageEntry: pageEntry,
            contentfulSections: contentfulSections,
            sanitySections: sanitySections,
            airtableSections: airtableSections
        }
    };
};

const Home: NextPage<PageProps> = (props) => {
    return (
        <div className={styles.container}>
            <Head>
                <title>Stackbit Multisource Demo</title>
                <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
                <link rel="alternate icon" type="image/png" href="/favicon-32x32.png" sizes="32x32" />
                <link rel="alternate icon" type="image/png" href="/favicon-16x16.png" sizes="16x16" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>
                    Welcome to <a href="https://www.stackbit.com">Stackbit!</a>
                </h1>

                <ul className={styles.navLinks}>
                    {props.pageEntries.map((page, index) => {
                        return (
                            <li key={index}>
                                <Link href={'/' + page.fields.slug.replace(/^\/|\/$/g, '')}>{page.fields.title}</Link>
                            </li>
                        );
                    })}
                </ul>
                {props.pageEntry ? <Sections {...props} /> : <h2>Page Not Found</h2>}
            </main>

            <footer className={styles.footer}>
                <a href="https://www.stackbit.com" target="_blank" rel="noopener noreferrer">
                    Powered by{' '}
                    <span className={styles.logo}>
                        <Image src="/favicon.svg" alt="Stackbit Logo" width={16} height={16} />
                    </span>
                </a>
            </footer>
        </div>
    );
};

function Sections(props: PageProps) {
    return (
        <div className={styles.grid} data-sb-object-id={props.pageEntry?.sys.id}>
            {(props.pageEntry?.fields.crossReferenceSections ?? []).map((refObjectStr: string, index: number) => {
                const refObject = JSON.parse(refObjectStr);
                if (refObject.refSrcType === 'contentful') {
                    const contentfulSection = props.contentfulSections.find((contentfulSectionEntry) => contentfulSectionEntry.sys.id === refObject.refId);
                    if (contentfulSection) {
                        return <ContentfulSection key={index} entry={contentfulSection} sectionIndex={index} />;
                    }
                } else if (refObject.refSrcType === 'sanity') {
                    const sanitySection = props.sanitySections.find((sanityDocument) => sanityDocument._id === refObject.refId);
                    if (sanitySection) {
                        return <SanitySection key={index} document={sanitySection} sectionIndex={index} />;
                    }
                } else if (refObject.refSrcType === 'airtable') {
                    const airtableSection = props.airtableSections.find((record) => record.id === refObject.refId);
                    if (airtableSection) {
                        return <AirtableSection key={index} record={airtableSection} sectionIndex={index} />;
                    }
                }
                return null;
            })}
        </div>
    );
}

function ContentfulSection({ entry, sectionIndex }: { entry: ContentfulSectionEntry; sectionIndex: number }) {
    return (
        <div data-sb-field-path={`.crossReferenceSections[${sectionIndex}]`}>
            <div className={styles.card} data-sb-object-id={entry.sys.id}>
                <div className={styles.contentSourceIcon}>
                    <img src="/contentful-icon.svg" style={{ height: 20 }} />
                </div>
                <h2 data-sb-field-path="title">{entry.fields.title}</h2>
                {entry.fields.subtitle && (
                    <div data-sb-field-path="subtitle">
                        <Markdown>{entry.fields.subtitle}</Markdown>
                    </div>
                )}
            </div>
        </div>
    );
}

function SanitySection({ document, sectionIndex }: { document: SanitySectionDocument; sectionIndex: number }) {
    return (
        <div data-sb-field-path={`.crossReferenceSections[${sectionIndex}]`}>
            <div className={styles.card} data-sb-object-id={document._id}>
                <div className={styles.contentSourceIcon}>
                    <img src="/sanity-icon.png" style={{ height: 24 }} />
                </div>
                <h2 data-sb-field-path="title">{document.title}</h2>
                {document.subtitle && <p data-sb-field-path="subtitle">{document.subtitle}</p>}
            </div>
        </div>
    );
}

function AirtableSection({ record, sectionIndex }: { record: AirtableSectionRecord; sectionIndex: number }) {
    return (
        <div data-sb-field-path={`.crossReferenceSections[${sectionIndex}]`}>
            <div className={styles.card} data-sb-object-id={record.id}>
                <div className={styles.contentSourceIcon}>
                    <img src="/airtable-icon.svg" style={{ height: 24 }} />
                </div>
                <h2 data-sb-field-path="Title">{record.fields.Title}</h2>
                {record.fields.Subtitle && (
                    <div data-sb-field-path="Subtitle">
                        <Markdown>{record.fields.Subtitle}</Markdown>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Home;
