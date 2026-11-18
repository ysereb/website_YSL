# Serebrenik Lab

Source code for the [Serebrenik Lab website](https://www.serebreniklab.org/) at Rutgers University.

The lab studies protein control and organization, with a focus on understanding proteostasis and developing approaches to manipulate protein fate through induced proximity.

## Website overview

The website is built with [Astro](https://astro.build/) and deployed as a static site using GitHub Pages. Content is maintained in Markdown and JSON files, allowing updates without modifying page layouts.

The site is designed to be lightweight, responsive, accessible, and straightforward to maintain.

## Project structure

| Directory | Contents |
|---|---|
| `content/pages/` | Page text and metadata |
| `content/research/` | Research projects |
| `content/people/` | Lab members |
| `content/publications/` | Publications |
| `content/photos/` | Photo galleries |
| `content/news/` | News and announcements |
| `content/site.json` | Shared site information |
| `public/images/` | Images and other visual assets |
| `src/` | Astro components, layouts, and styles |

## Local development

Requires Node.js (version specified in `.nvmrc`) and Python 3.

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Build and validate the site:

```bash
npm run build
npm run check:site
```

Browser tests can be run with `npm run test:browser` after installing the Playwright Chromium browser.

## Content updates and deployment

Most website content can be updated directly by editing the corresponding Markdown or JSON files. New entries can be created using existing files as templates. Images are stored in `public/images/` and referenced using `/images/` paths.

Changes to the `main` branch automatically trigger the GitHub Actions workflow, which builds, validates, and deploys the website to GitHub Pages. Pull requests undergo validation before merging.

Deployment configuration is maintained in `.github/workflows/deploy.yml`.