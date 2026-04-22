import {describe, expect, it, vi} from 'vitest'

import {
  AB_SELECTED_VARIANT_FIELDS_FIELD_NAME,
  AB_VARIANTS_DISABLE_ACTIONS,
  resolveAbFieldNames,
} from './abConfig'
import {withAbObject} from './withAbObject'

const fieldNames = resolveAbFieldNames()

type AnyField = Record<string, unknown> & {
  name?: string
  type?: string
  fields?: AnyField[]
  of?: AnyField[]
  options?: Record<string, unknown>
  hidden?: unknown
}

function findField(fields: AnyField[], name: string): AnyField | undefined {
  return fields.find((field) => field.name === name)
}

describe('withAbObject', () => {
  it('adds AB control fields when missing', () => {
    const inputField = {
      name: 'settings',
      type: 'object',
      fields: [{name: 'title', type: 'string'}],
    }

    const result = withAbObject(inputField)
    const resultFields = (result as AnyField).fields ?? []

    expect(findField(resultFields, fieldNames.toggle)).toBeTruthy()
    expect(findField(resultFields, fieldNames.testRef)).toBeTruthy()

    const variantsField = findField(resultFields, fieldNames.variants)
    expect(variantsField).toBeTruthy()
    expect(variantsField?.options?.disableActions).toEqual(AB_VARIANTS_DISABLE_ACTIONS)
  })

  it('skips adding controls when already present', () => {
    const inputField = {
      name: 'settings',
      type: 'object',
      fields: [{name: fieldNames.toggle, type: 'boolean'}],
    }

    const result = withAbObject(inputField)
    const resultFields = (result as AnyField).fields ?? []

    expect(resultFields.map((field) => field.name)).toEqual([fieldNames.toggle])
  })

  it('respects AB internal options on container fields', () => {
    const inputField = {
      name: 'settings',
      type: 'object',
      options: {__abInternal: true},
      fields: [{name: 'title', type: 'string'}],
    }

    const result = withAbObject(inputField)
    const resultFields = (result as AnyField).fields ?? []

    expect(findField(resultFields, fieldNames.toggle)).toBeFalsy()
    expect(findField(resultFields, fieldNames.variants)).toBeFalsy()
  })

  it('decorates variant fields with selection-aware hidden logic', () => {
    const inputField = {
      name: 'settings',
      type: 'object',
      fields: [{name: 'title', type: 'string'}],
    }

    const result = withAbObject(inputField)
    const resultFields = (result as AnyField).fields ?? []
    const variantsField = findField(resultFields, fieldNames.variants) as AnyField
    const variantEntry = variantsField.of?.[0] as AnyField
    const variantObject = (variantEntry.fields ?? []).find(
      (field) => field.name === fieldNames.variant,
    ) as AnyField

    const variantFields = variantObject.fields ?? []
    const decoratedTitleField = findField(variantFields, 'title')

    expect(typeof decoratedTitleField?.hidden).toBe('function')
    const hiddenFn = decoratedTitleField?.hidden as (ctx: {parent?: unknown}) => boolean

    expect(hiddenFn({parent: {[AB_SELECTED_VARIANT_FIELDS_FIELD_NAME]: ['title']}})).toBe(false)
    expect(hiddenFn({parent: {[AB_SELECTED_VARIANT_FIELDS_FIELD_NAME]: ['other']}})).toBe(true)
  })

  it('preserves existing hidden rules on variant fields', () => {
    const inputField = {
      name: 'settings',
      type: 'object',
      fields: [{name: 'title', type: 'string', hidden: () => true}],
    }

    const result = withAbObject(inputField)
    const resultFields = (result as AnyField).fields ?? []
    const variantsField = findField(resultFields, fieldNames.variants) as AnyField
    const variantEntry = variantsField.of?.[0] as AnyField
    const variantObject = (variantEntry.fields ?? []).find(
      (field) => field.name === fieldNames.variant,
    ) as AnyField

    const variantFields = variantObject.fields ?? []
    const decoratedTitleField = findField(variantFields, 'title')
    const hiddenFn = decoratedTitleField?.hidden as (ctx: {parent?: unknown}) => boolean

    expect(hiddenFn({parent: {[AB_SELECTED_VARIANT_FIELDS_FIELD_NAME]: ['title']}})).toBe(true)
  })

  it('skips validation for unselected variant fields', () => {
    const inputField = {
      name: 'settings',
      type: 'object',
      fields: [
        {
          name: 'title',
          type: 'string',
          validation: (rule: {required: () => unknown}) => rule.required(),
        },
      ],
    }

    const result = withAbObject(inputField)
    const resultFields = (result as AnyField).fields ?? []
    const variantsField = findField(resultFields, fieldNames.variants) as AnyField
    const variantEntry = variantsField.of?.[0] as AnyField
    const variantObject = (variantEntry.fields ?? []).find(
      (field) => field.name === fieldNames.variant,
    ) as AnyField
    const variantFields = variantObject.fields ?? []
    const decoratedTitleField = findField(variantFields, 'title') as AnyField

    const requiredSpy = vi.fn().mockReturnValue('required-result')
    const skipSpy = vi.fn().mockReturnValue('skip-result')
    const validationFn = decoratedTitleField.validation as (
      rule: {required: () => unknown; skip: () => unknown},
      context?: {parent?: unknown},
    ) => unknown

    const resultValue = validationFn(
      {required: requiredSpy, skip: skipSpy},
      {parent: {[AB_SELECTED_VARIANT_FIELDS_FIELD_NAME]: ['body']}},
    )

    expect(skipSpy).toHaveBeenCalledTimes(1)
    expect(requiredSpy).not.toHaveBeenCalled()
    expect(resultValue).toBe('skip-result')
  })

  it('keeps validation active when field is selected', () => {
    const inputField = {
      name: 'settings',
      type: 'object',
      fields: [
        {
          name: 'title',
          type: 'string',
          validation: (rule: {required: () => unknown}) => rule.required(),
        },
      ],
    }

    const result = withAbObject(inputField)
    const resultFields = (result as AnyField).fields ?? []
    const variantsField = findField(resultFields, fieldNames.variants) as AnyField
    const variantEntry = variantsField.of?.[0] as AnyField
    const variantObject = (variantEntry.fields ?? []).find(
      (field) => field.name === fieldNames.variant,
    ) as AnyField
    const variantFields = variantObject.fields ?? []
    const decoratedTitleField = findField(variantFields, 'title') as AnyField

    const requiredSpy = vi.fn().mockReturnValue('required-result')
    const skipSpy = vi.fn().mockReturnValue('skip-result')
    const validationFn = decoratedTitleField.validation as (
      rule: {required: () => unknown; skip: () => unknown},
      context?: {parent?: unknown},
    ) => unknown

    const selectedResult = validationFn(
      {required: requiredSpy, skip: skipSpy},
      {parent: {[AB_SELECTED_VARIANT_FIELDS_FIELD_NAME]: ['title']}},
    )
    const unscopedResult = validationFn({required: requiredSpy, skip: skipSpy}, {parent: {}})

    expect(requiredSpy).toHaveBeenCalledTimes(2)
    expect(skipSpy).not.toHaveBeenCalled()
    expect(selectedResult).toBe('required-result')
    expect(unscopedResult).toBe('required-result')
  })
})
