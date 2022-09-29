import Head from 'next/head';
import Image from 'next/image';
import { createClient } from 'contentful';
import createSanityClient from '@sanity/client';
import styles from '../styles/Home.module.css';

const preview = process.env.NODE_ENV === 'development';

const options = {
    space: process.env.CONTENTFUL_SPACE_ID,
    accessToken: preview ? process.env.CONTENTFUL_PREVIEW_TOKEN : process.env.CONTENTFUL_DELIVERY_TOKEN,
    ...(preview ? { host: 'preview.contentful.com' } : {})
};

const contentfulClient = createClient(options);

const sanityClient = createSanityClient({
    projectId: process.env.SANITY_PROJECT_ID,
    dataset: 'production',
    apiVersion: '2021-03-25',
    token: process.env.SANITY_TOKEN,
    useCdn: false
});

const DRAFT_ID_PREFIX = 'drafts.';

function isDraftId(docId) {
    return docId && docId.startsWith(DRAFT_ID_PREFIX);
}

function getPureObjectId(docId) {
    return docId.replace(/^drafts\./, '');
}

function overlayDrafts(documents) {
    const draftDocumentIdMap = documents
        .filter((document) => isDraftId(document._id))
        .reduce((res, document) => {
            res[getPureObjectId(document._id)] = document;
            return res;
        }, {});

    return documents.filter((document) => {
        return isDraftId(document._id) || !(document._id in draftDocumentIdMap);
    });
}

export async function getStaticProps() {
    const contentfulEntries = await contentfulClient.getEntries();
    const sanityDocuments = await sanityClient.fetch('*[!(_id in path("_.**"))]');
    return {
        props: {
            contentfulEntries: contentfulEntries.items,
            sanityDocuments: overlayDrafts(sanityDocuments)
        }
    };
}

export default function Home(props) {
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

                <p className={styles.description}>
                    Get started by editing <code className={styles.code}>pages/index.js</code>
                </p>

                <div className={styles.grid}>
                    {props.contentfulEntries.map((entry, index) => (
                        <div className={styles.card} key={index} data-sb-object-id={entry.sys.id}>
                            <h2 data-sb-field-path="title">{entry.fields.title}</h2>
                            <p data-sb-field-path="subtitle">{entry.fields.subtitle}</p>
                        </div>
                    ))}

                    {props.sanityDocuments.map((doc, index) => (
                        <div className={styles.card} key={index} data-sb-object-id={doc._id}>
                            <h2 data-sb-field-path="title">{doc.title}</h2>
                            <p data-sb-field-path="subtitle">{doc.subtitle}</p>
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
}
