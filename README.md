# sanity-plugin-ab-testing

## Installation

```sh
npm install sanity-plugin-ab-testing
```

## Usage

In `sanity.config.ts`:

```ts
import {defineConfig} from 'sanity'
import {abObjectCloningPlugin} from 'sanity-plugin-ab-testing'

export default defineConfig({
  plugins: [abObjectCloningPlugin()],
})
```

In your schema index:

```ts
import type {SchemaTypeDefinition} from 'sanity'
import {withAbObject} from 'sanity-plugin-ab-testing'
import {postType} from './post'

export const schema: {types: SchemaTypeDefinition[]} = {
  types: [withAbObject(postType)],
}
```

To make AB variants clone every field instead of selecting individual fields:

```ts
types: [withAbObject(postType, {cloneMode: 'allFields'})]
```

When using the plugin-level schema transform:

```ts
plugins: [abObjectCloningPlugin({cloneMode: 'allFields'})]
```

## License

[MIT](LICENSE) © Marko Bilanović

## Develop & test

This plugin uses [@sanity/plugin-kit](https://github.com/sanity-io/plugin-kit)
with default configuration for build & watch scripts.

See [Testing a plugin in Sanity Studio](https://github.com/sanity-io/plugin-kit#testing-a-plugin-in-sanity-studio)
on how to run this plugin with hotreload in the studio.

## Publishing

See [PUBLISHING.md](./PUBLISHING.md) for a step-by-step release checklist and npm troubleshooting.
