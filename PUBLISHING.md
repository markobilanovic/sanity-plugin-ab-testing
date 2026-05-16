# Publishing `sanity-plugin-ab-testing`

This is the release runbook for publishing a new npm version of this plugin.

## Prerequisites

- You are in the plugin repository root.
- You are authenticated to npm with an owner account for this package.
- Your local branch is up to date and your working tree is clean.

```sh
cd /Users/markobilanovic/git/ab-testing/sanity-plugin-ab-testing
git status
npm whoami
npm owner ls sanity-plugin-ab-testing
```

If `npm whoami` fails, run `npm login`.
If your username is not listed in `npm owner ls`, switch accounts or ask an owner to add you.

## Standard release flow

1. Commit and push all code changes first.
2. Bump package version.
3. Push commit and tag.
4. Publish to npm.
5. Verify published version.

```sh
# 1) Commit code changes
git add .
git commit -m "Your release-related commit message"
git push

# 2) Bump version (choose one)
npm version patch      # e.g. 0.1.1 -> 0.1.2
# npm version minor    # e.g. 0.1.x -> 0.2.0
# npm version major    # e.g. 0.x.x -> 1.0.0
# npm version 0.1.2    # explicit version

# 3) Push commit + tag created by npm version
git push
git push --tags

# 4) Publish
npm publish --access public

# 5) Verify
npm view sanity-plugin-ab-testing version
npm view sanity-plugin-ab-testing versions --json
```

## Recommended pre-publish checks

```sh
npm run lint
npm test
npm run build
npm pack --dry-run
```

`npm pack --dry-run` lets you inspect exactly what files will be published.

## Troubleshooting

### `E404 Not Found - PUT .../sanity-plugin-ab-testing`

Most commonly auth/ownership problem.

```sh
npm whoami
npm owner ls sanity-plugin-ab-testing
```

Fix by logging into the correct npm account (`npm login`) or getting owner access.

### `E403 You cannot publish over the previously published versions`

That version already exists on npm and cannot be overwritten.

```sh
npm view sanity-plugin-ab-testing versions --json
npm version patch
git push && git push --tags
npm publish --access public
```

### 2FA prompt / OTP required

If npm requires OTP:

```sh
npm publish --access public --otp=123456
```

## One-command patch release (after code is already committed)

```sh
npm version patch && git push && git push --tags && npm publish --access public
```
