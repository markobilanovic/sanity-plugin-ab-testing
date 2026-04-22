import {describe, expect, it} from 'vitest'

import {AB_SELECTED_VARIANT_FIELDS_FIELD_NAME} from '../abConfig'
import {createSelectionScopedVariantRecord, normalizeSelectedVariantFields} from './helpers'

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
    )

    expect(result).toEqual({
      slug: {current: 'from-control'},
      [AB_SELECTED_VARIANT_FIELDS_FIELD_NAME]: ['slug'],
    })
  })
})
