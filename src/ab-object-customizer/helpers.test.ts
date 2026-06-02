import {describe, expect, it} from 'vitest'

import {AB_SELECTED_VARIANT_FIELDS_FIELD_NAME, resolveAbFieldNames} from '../abConfig'
import {
  createSelectionScopedVariantRecord,
  getControlVariantSeed,
  normalizeSelectedVariantFields,
} from './helpers'

const fieldNames = resolveAbFieldNames()

describe('ab-object-customizer helpers', () => {
  it('normalizes selected field names', () => {
    expect(normalizeSelectedVariantFields([' title ', '', 'slug', 'title', 1 as any])).toEqual([
      'title',
      'slug',
    ])
  })

  it('keeps only selected fields in variant payload', () => {
    const result = createSelectionScopedVariantRecord(
      ['body'],
      {
        title: 'A',
        body: [{_type: 'block'}],
        [AB_SELECTED_VARIANT_FIELDS_FIELD_NAME]: ['title', 'body'],
      },
      {
        body: [{_type: 'block', children: []}],
        slug: {current: 'hello'},
      },
      fieldNames,
    )

    expect(result).toEqual({
      body: [{_type: 'block'}],
      [AB_SELECTED_VARIANT_FIELDS_FIELD_NAME]: ['body'],
    })
    expect(Object.prototype.hasOwnProperty.call(result, 'title')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(result, 'slug')).toBe(false)
  })

  it('fills selected field from control seed when missing in variant', () => {
    const result = createSelectionScopedVariantRecord(
      ['slug'],
      {
        [AB_SELECTED_VARIANT_FIELDS_FIELD_NAME]: ['slug'],
      },
      {
        slug: {current: 'from-control'},
      },
      fieldNames,
    )

    expect(result).toEqual({
      slug: {current: 'from-control'},
      [AB_SELECTED_VARIANT_FIELDS_FIELD_NAME]: ['slug'],
    })
  })

  it('removes AB payload fields recursively from control variant seed', () => {
    const result = getControlVariantSeed(
      {
        title: 'A',
        [fieldNames.toggle]: true,
        [fieldNames.testRef]: {_ref: 'test'},
        [fieldNames.variants]: [{variantCode: 'B'}],
        nested: {
          headline: 'Nested',
          [fieldNames.toggle]: true,
          [fieldNames.testRef]: {_ref: 'nested-test'},
          [AB_SELECTED_VARIANT_FIELDS_FIELD_NAME]: ['headline'],
        },
        blocks: [
          {
            _type: 'block',
            children: [],
            [fieldNames.variants]: [{variantCode: 'C'}],
          },
        ],
      },
      fieldNames,
    )

    expect(result).toEqual({
      title: 'A',
      nested: {
        headline: 'Nested',
      },
      blocks: [
        {
          _type: 'block',
          children: [],
        },
      ],
    })
  })
})
