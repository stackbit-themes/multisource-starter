import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import type { Entry } from 'contentful';
import type { GetStaticProps, GetStaticPaths, NextPage } from 'next';

import { getDocuments } from '../content-utils/sanity-utils';
import { getEntries } from '../content-utils/contentful-utils';
import { getAirtableRecords, ResolvedRecord } from '../content-utils/airtable-utils';

import styles from '../styles/Home.module.css';

export const getStaticPaths: GetStaticPaths = async () => {
    const pageEntries = await getEntries({ content_type: 'page' });
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
    const pageEntries = await getEntries({ content_type: 'page' });
    const urlPath = '/' + (params?.slug || []).join('/');
    if (urlPath !== '/') {
        return {
            props: {
                pageEntries: pageEntries,
                contentfulEntries: [],
                sanityDocuments: [],
                airtableRecords: []
            }
        };
    }
    const contentfulHeroSectionEntries = await getEntries({ content_type: 'contentfulSection' });
    const sanityDocuments = await getDocuments();
    const airtableRecords = await getAirtableRecords();
    return {
        props: {
            pageEntries: pageEntries,
            contentfulEntries: contentfulHeroSectionEntries,
            sanityDocuments: sanityDocuments,
            airtableRecords: airtableRecords
        }
    };
};

type HomeProps = {
    pageEntries: Entry<any>[];
    contentfulEntries: Entry<any>[];
    sanityDocuments: any[];
    airtableRecords: ResolvedRecord[];
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

                <div className={styles.grid}>
                    <p className={styles.description}>
                        <img src="/contentful-icon.svg" style={{ height: 20 }} /> Content from Contentful
                    </p>
                    {props.contentfulEntries.map((entry, index) => (
                        <div className={styles.card} key={index} data-sb-object-id={entry.sys.id}>
                            <h2 data-sb-field-path="title">{entry.fields.title}</h2>
                            <p data-sb-field-path="subtitle">{entry.fields.subtitle}</p>
                        </div>
                    ))}

                    <p className={styles.description}>
                        <img src="/sanity-icon.png" style={{ height: 24 }} /> Content from Sanity
                    </p>
                    {props.sanityDocuments.map((doc, index) => (
                        <div className={styles.card} key={index} data-sb-object-id={doc._id}>
                            <h2 data-sb-field-path="title">{doc.title}</h2>
                            <p data-sb-field-path="subtitle">{doc.subtitle}</p>
                        </div>
                    ))}

                    <p className={styles.description}>
                        <img src="/airtable-icon.svg" style={{ height: 24 }} /> Content from Airtable
                    </p>
                    {props.airtableRecords.map((record, index) => (
                        <div className={styles.card} key={index} data-sb-object-id={record.id}>
                            <h2 data-sb-field-path="Title">{record.fields.Title as string}</h2>
                            <p data-sb-field-path="Subtitle">{record.fields.Subtitle as string}</p>
                        </div>
                    ))}
                </div>
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

export default Home;
