// Project-file format version (SPEC §9.2).
//
// Repo-local and independent of the library/tool semver (which lives in
// library.properties, managed by the shared bump_version.py — not touched here).
// Bump ONLY when the .lgfxsb.json format actually changes; the round-trip CI
// check pairs with this constant to fail a forgotten bump. A file with no
// `formatVersion` is treated as 1.
//
// Kept in-tree (not fetched at runtime) so the authoring tool works when served
// from docs/ alone.
export const FORMAT_VERSION = 1;
