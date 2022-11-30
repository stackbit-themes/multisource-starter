# Stackbit Multi Content Source Demo

This demo shows how Stackbit's visual editor can be used to edit a website
powered by multiple content sources.

In this demo, a Next.js site fetches content from the following content sources
to render its pages:

- [Contentful](https://www.contentful.com/) CMS with two content models: 
  - The `page` content model with a `slug` and `title` fields used to render pages.
  - The `contentfulSection` content model with `title` and `subtitle` fields used
    to render page sections.
- [Sanity](https://www.sanity.io/) CMS with one model:
  - The `sanitySection` model with `title` and `subtitle` fields used to render
    page sections. The Sanity schema is defined in the code inside the
    [studio/schemas/schema.js](./studio/schemas/schema.js) file.
- [Airtable](https://airtable.com/) with one table:
  - The `HeroSection` table with `Title`, `Subtitle`, `Status` and `Related`
    columns used to render the page sections. The `Status` and `Related` columns
    enable publishing workflows. 

The website pages are generated from Contentful's entries of the `page` content
model. The pages render list of sections collected from all three content sources.

The fetching of the content is done inside the `getStaticPaths` and the
`getStaticProps` Next.js methods using official JavaScript libraries of each of
the content sources.

## Running locally

To run this demo locally, clone this repo and install dependencies using
`npm install`.
Then create an `.env.local` file with the following environment variables:

```shell
CONTENTFUL_SPACE_ID=1gxukxz1954v
CONTENTFUL_PREVIEW_TOKEN=tvvh5hDp7zKfK1o9BdSG5yIOj-xtdEsWyAE7ckdk-jA
CONTENTFUL_DELIVERY_TOKEN=tjHLayKIiGepOlmG3tg68BTwp9eYMYA8iUM9H2f28qQ
CONTENTFUL_MANAGEMENT_TOKEN=[PASTE_YOUR_OWN_OTKEN]

SANITY_PROJECT_ID=xlzh5w9l
SANITY_TOKEN=[PASTE_YOUR_OWN_OTKEN]

AIRTABLE_BASE_ID=app0GjmTLOZyfSvZj
AIRTABLE_API_KEY=[PASTE_YOUR_OWN_OTKEN]
```

Then run `npm run dev` and navigate to https://localhost:3000 to see the result.

## Editing content visually with Stackbit

To edit the content visually using Stackbit's local development, open a separate
terminal window and install the Stackbit CLI:

```shell
npm i -g @stackbit/cli@latest
```

Then, while your `next dev` is running in a different terminal, run:

```shell
stackbit dev
```

You will see a log that looks something like:

```shell
info: ⚡ Open https://app.stackbit.com/local/... in your browser
```

Click the link to open Stackbit.

All Stackbit configuration is defined inside the [stackbit.config.js](./stackbit.config.js)
file. When Stackbit reads and writes the content from content sources, it loads
content-source modules from the `stackbit.config.js`. Each content-source module
implements the ContentSourceInterface. The content-source modules do not affect
or interface with the website's code in any way.

Check out the [AirtableContentSource.ts](./airtable-content-source/AirtableContentSource.ts)
file for the example of content-source module implementation.
