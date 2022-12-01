import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import Markdown from 'markdown-to-jsx';
import { useState } from 'react';
import type { Entry } from 'contentful';
import type { GetStaticProps, GetStaticPaths, NextPage } from 'next';

import { getDocuments } from '../content-utils/sanity-utils';
import { getEntries } from '../content-utils/contentful-utils';
import { getAirtableRecords, HeroSectionProps as AirtableSectionProps } from '../content-utils/airtable-utils';

import styles from '../styles/Home.module.css';

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

export const getStaticProps: GetStaticProps<HomeProps, { slug: string[] }> = async ({ params }) => {
    const pageEntries = await getEntries({ isPreview, query: { content_type: 'page' } });
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
                contentfulSectionEntries: [],
                contentfulCrossReferenceSectionsEntries: [],
                sanityDocuments: [],
                airtableRecords: []
            }
        };
    }
    const contentfulSectionEntries = await getEntries({ isPreview, query: { content_type: 'contentfulSection' } });
    const contentfulCrossReferenceSectionsEntries = await getEntries({ isPreview, query: { content_type: 'crossReferenceSection' } });
    const sanityDocuments = await getDocuments(isPreview);
    const airtableRecords = await getAirtableRecords(isPreview);
    return {
        props: {
            contentfulSpaceId: process.env.CONTENTFUL_SPACE_ID!,
            sanityProjectId: process.env.SANITY_PROJECT_ID!,
            airtableBaseId: process.env.AIRTABLE_BASE_ID!,
            pageEntries: pageEntries,
            pageEntry: pageEntry,
            contentfulSectionEntries: contentfulSectionEntries,
            contentfulCrossReferenceSectionsEntries: contentfulCrossReferenceSectionsEntries,
            sanityDocuments: sanityDocuments,
            airtableRecords: airtableRecords
        }
    };
};

type HomeProps = {
    contentfulSpaceId: string;
    sanityProjectId: string;
    airtableBaseId: string;
    pageEntries: Entry<any>[];
    pageEntry: Entry<any> | null;
    contentfulSectionEntries: Entry<any>[];
    contentfulCrossReferenceSectionsEntries: Entry<any>[];
    sanityDocuments: any[];
    airtableRecords: AirtableSectionProps[];
};

const Home: NextPage<HomeProps> = (props) => {
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

                <SectionIds {...props} />

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

function SectionIds(props: HomeProps) {
    const [shown, setShown] = useState(false);
    return (
        <div className={styles.sectionIds}>
            <p style={{ textAlign: 'center', textDecoration: 'underline', cursor: 'pointer' }} onClick={() => setShown(!shown)}>
                section IDs
            </p>
            {shown && (
                <ul>
                    <li>Sanity project id: {props.sanityProjectId}</li>
                    <li>Airtable base id: {props.airtableBaseId}</li>
                    {props.sanityDocuments.map((doc, index) => {
                        return <li key={index}>sanity, {doc._id.replace('drafts.', '')}</li>;
                    })}
                    {props.airtableRecords.map((record, index) => {
                        if (record.Status === 'changed') {
                            return <li key={index}>airtable, {record.Related![0]} (published-changed)</li>;
                        } else {
                            return (
                                <li key={index}>
                                    airtable, {record.id} ({record.Status})
                                </li>
                            );
                        }
                    })}
                </ul>
            )}
        </div>
    );
}

function Sections(props: HomeProps) {
    return (
        <div className={styles.grid} data-sb-object-id={props.pageEntry?.sys.id}>
            {(props.pageEntry?.fields.sections ?? []).map((section: any, index: number) => {
                if (section.sys.contentType.sys.id === 'contentfulSection') {
                    return <ContentfulSection key={index} entry={section} sectionIndex={index} />;
                } else if (section.sys.contentType.sys.id === 'crossReferenceSection') {
                    const crossReferenceSection = props.contentfulCrossReferenceSectionsEntries.find((entry) => entry.sys.id === section.sys.id);
                    if (crossReferenceSection) {
                        if (crossReferenceSection.fields.contentSourceType === 'sanity') {
                            const sanitySection = props.sanityDocuments.find((doc) => doc._id === crossReferenceSection.fields.referenceId);
                            if (sanitySection) {
                                return <SanitySection key={index} document={sanitySection} sectionIndex={index} />;
                            }
                        } else if (crossReferenceSection.fields.contentSourceType === 'airtable') {
                            const airtableSection = props.airtableRecords.find((record) => record.id === crossReferenceSection.fields.referenceId);
                            if (airtableSection) {
                                return <AirtableSection key={index} record={airtableSection} sectionIndex={index} />;
                            }
                        }
                    }
                }
                return null;
            })}
        </div>
    );
}

function ContentfulSection({ entry, sectionIndex }: { entry: Entry<any>, sectionIndex: number }) {
    return (
        <div data-sb-field-path={`.sections[${sectionIndex}]`}>
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

function SanitySection({ document, sectionIndex }: { document: any; sectionIndex: number }) {
    return (
        <div data-sb-field-path={`.sections[${sectionIndex}]`}>
            <div className={styles.card} data-sb-object-id={document._id}>
                <div className={styles.contentSourceIcon}>
                    <img src="/sanity-icon.png" style={{ height: 24 }} />
                </div>
                <h2 data-sb-field-path="title">{document.title}</h2>
                <p data-sb-field-path="subtitle">{document.subtitle}</p>
            </div>
        </div>
    );
}

function AirtableSection({ record, sectionIndex }: { record: AirtableSectionProps; sectionIndex: number}) {
    return (
        <div data-sb-field-path={`.sections[${sectionIndex}]`}>
            <div className={styles.card} data-sb-object-id={record.id}>
                <div className={styles.contentSourceIcon}>
                    <img src="/airtable-icon.svg" style={{ height: 24 }} />
                </div>
                <h2 data-sb-field-path="Title">{record.Title}</h2>
                {record.Subtitle && (
                    <div data-sb-field-path="Subtitle">
                        <Markdown>{record.Subtitle}</Markdown>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Home;
