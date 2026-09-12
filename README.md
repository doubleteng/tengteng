# Teng Teng — Portfolio

A GitHub Pages portfolio with a form-based [Pages CMS](https://pagescms.org) editor.

- Website: https://teng-teng.org
- Admin entrance: https://teng-teng.org/admin/
- Editor: https://app.pagescms.org/doubleteng/tengteng/main
- [中文使用说明](docs/EDITOR_GUIDE.md)

## Content

Edit content in Pages CMS; no HTML or JavaScript changes are needed for routine updates. The repository remains the source of truth.

| Content | Location |
| --- | --- |
| Projects | `_projects/*.md` |
| Publications | `_publications/*.md` |
| News | `_updates/*.md` |
| Profile, teaching, art, site text | `_data/*.yml` |
| Uploads | `assets/media/`, `assets/documents/` |
| CMS schema | `.pages.yml` |
| Shared layouts and blocks | `_layouts/`, `_includes/` |

Existing project permalinks are preserved in frontmatter. New projects use `/projects/:name/`. Keep filenames stable after publication. The CMS merge setting preserves existing permalinks when forms are saved.

`published: false` excludes a record from the public site. This is a public repository: source drafts and editor notes remain accessible on GitHub. New records default to drafts. Future news dates are display dates, not scheduled publication.

## Local development

Requires Ruby 3.3 and Bundler. Jekyll 3.10 matches the native GitHub Pages environment.

```sh
bundle install
bundle exec jekyll serve
```

For validation:

```sh
bundle exec jekyll build --strict_front_matter
python3 scripts/validate_site.py
```

The validation script uses the Python standard library. It checks generated internal links, local assets, all active project routes, content counts, and sitemap coverage.

## Publishing and recovery

The existing GitHub Pages branch deployment builds `main` at the repository root. Pages CMS commits trigger the same build. Keep `CNAME` and `_config.yml` in place. Do not add `.nojekyll`.

The first CMS login requires the owner to install the Pages CMS GitHub App for this repository. Select only `tengteng`; no self-hosted CMS, database, or extra server is required.

The migration retains 34 projects, 22 publications, original project URLs, and original image files. Optimized display copies are in `assets/media/`. Eight unverified/sample announcements are saved as unpublished drafts. Incomplete project descriptions are marked with editor notes; no unsupported outcomes are asserted for those entries.

Every edit is versioned in Git. Restore an individual file from History, or revert the migration commit to recover the previous site.
