/**
 * The published site is, for now, a TEST version for the team: a badge in the
 * header and a notice in the welcome pop-up say so. Set to false at launch.
 * (The local demo — `npm run dev:demo` — has its own "DEMO" badge.)
 */
export const IS_TEST_VERSION = import.meta.env.MODE !== 'demo';
