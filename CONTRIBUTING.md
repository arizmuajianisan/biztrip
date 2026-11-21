# Contributing to BizTrip

Thanks for your interest in improving BizTrip! This guide explains how to get a
working copy running and how to get a change merged.

## Before you start

- **Bugs and ideas:** open an [issue](https://github.com/arizmuajianisan/biztrip/issues)
  first. For anything larger than a small fix, wait for a quick "go ahead" so
  you don't spend time on something that won't be merged.
- **Security issues:** do **not** open a public issue. Contact the maintainer
  privately through GitHub instead.
- Read the [README](README.md) — especially *How the money works* and *Roles*.
  Most of the app's rules live there, and changes must keep them true.

## Local setup

Requirements: Node.js 22, pnpm (the version pinned in `package.json`), and a
free [Neon](https://neon.tech) Postgres database.

```bash
git clone https://github.com/arizmuajianisan/biztrip.git
cd biztrip
pnpm install
cp .env.example .env      # fill in the three values
pnpm db:migrate           # create the tables in your Neon database
pnpm dev
```

Then seed one account per role:

```bash
curl -X POST localhost:3000/api/admin/seed -H "x-seed-token: $NUXT_SEED_TOKEN"
```

Use your **own** Neon database (or a dedicated Neon branch) for development —
never the production one.

## Making a change

1. Fork the repo and create a branch from `main`, e.g. `fix/report-rounding` or
   `feat/csv-export`.
2. Keep each pull request focused on one change.
3. If you change `server/database/schema.ts`, run `pnpm db:generate` and commit
   the generated migration in `server/database/migrations/`. Never edit a
   migration that has already been merged — add a new one.
4. Add or update tests for any change to money calculations, report assembly,
   FX handling or permissions (see `test/`). These are where a wrong answer is
   both likely and easy to miss.
5. Update the README if you change behaviour it documents.

## Checks

CI runs these on every push; please run them before opening a PR:

```bash
pnpm lint
pnpm test
pnpm typecheck
```

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add CSV export to the settlement report
fix: stop clawing back per diem through the cash advance
docs: correct the role matrix
```

Common types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`.
Write the subject in the imperative mood and explain the *why* in the body when
it isn't obvious.

## Pull requests

- Describe what changed and why, and link the related issue.
- Include screenshots for UI changes (mobile width too — the app is used on
  phones while travelling).
- Make sure all checks pass.

## Secrets and data

- Never commit `.env`, database connection strings, tokens, or real receipts
  and expense data. If you accidentally push a secret, tell the maintainer
  straight away so it can be rotated.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
