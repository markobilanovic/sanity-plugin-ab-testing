import {describe, expect, it, vi} from 'vitest'

import {
  AB_CLONE_MODE_OPTION,
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
  groups?: unknown
  group?: unknown
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

  it('can clone all fields without selection-aware variant fields', () => {
    const inputField = {
      name: 'settings',
      type: 'object',
      fields: [
        {name: 'title', type: 'string'},
        {
          name: 'nested',
          type: 'object',
          fields: [
            {name: 'headline', type: 'string'},
            {name: fieldNames.toggle, type: 'boolean'},
          ],
        },
      ],
    }

    const result = withAbObject(inputField, {cloneMode: 'allFields'})
    const resultFields = (result as AnyField).fields ?? []
    const variantsField = findField(resultFields, fieldNames.variants) as AnyField
    const variantEntry = variantsField.of?.[0] as AnyField
    const variantObject = (variantEntry.fields ?? []).find(
      (field) => field.name === fieldNames.variant,
    ) as AnyField

    const variantFields = variantObject.fields ?? []

    expect((result as AnyField).options?.[AB_CLONE_MODE_OPTION]).toBe('allFields')
    expect(findField(variantFields, AB_SELECTED_VARIANT_FIELDS_FIELD_NAME)).toBeFalsy()
    expect(findField(variantFields, 'title')?.hidden).toBeUndefined()
    expect(
      findField((findField(variantFields, 'nested')?.fields as AnyField[]) ?? [], 'headline'),
    ).toBeTruthy()
    expect(
      findField(
        (findField(variantFields, 'nested')?.fields as AnyField[]) ?? [],
        fieldNames.toggle,
      ),
    ).toBeFalsy()
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

  it('preserves array validation without selection-aware wrapping', () => {
    const arrayValidation = vi.fn((rule: {max: (count: number) => unknown}) => rule.max(1))
    const inputField = {
      name: 'settings',
      type: 'object',
      fields: [
        {
          name: 'items',
          type: 'array',
          of: [{type: 'string'}],
          validation: arrayValidation,
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
    const decoratedItemsField = findField(variantFields, 'items') as AnyField

    expect(decoratedItemsField.validation).toBe(arrayValidation)
    expect((decoratedItemsField.validation as Function).length).toBe(1)
  })

  it('preserves field groups on grouped schemas and strips groups from variant payloads', () => {
    const groups = [{name: 'contents', default: true}]
    const inputField = {
      name: 'callToActionTemplate',
      type: 'document',
      groups,
      fields: [{name: 'heading', type: 'string', group: 'contents'}],
    }

    const result = withAbObject(inputField)
    expect((result as AnyField).groups).toBe(groups)

    const resultFields = (result as AnyField).fields ?? []
    const toggleField = findField(resultFields, fieldNames.toggle) as AnyField
    const testRefField = findField(resultFields, fieldNames.testRef) as AnyField
    const variantsField = findField(resultFields, fieldNames.variants) as AnyField
    const variantEntry = variantsField.of?.[0] as AnyField
    const testNameField = findField(variantEntry.fields ?? [], fieldNames.testName) as AnyField
    const variantCodeField = findField(
      variantEntry.fields ?? [],
      fieldNames.variantCode,
    ) as AnyField
    const variantObject = (variantEntry.fields ?? []).find(
      (field) => field.name === fieldNames.variant,
    ) as AnyField
    const variantFields = variantObject.fields ?? []
    const selectedFieldsField = findField(
      variantFields,
      AB_SELECTED_VARIANT_FIELDS_FIELD_NAME,
    ) as AnyField

    expect(toggleField.group).toBe('contents')
    expect(testRefField.group).toBe('contents')
    expect(variantsField.group).toBe('contents')
    expect(variantEntry.groups).toBeUndefined()
    expect(testNameField.group).toBeUndefined()
    expect(variantCodeField.group).toBeUndefined()
    expect(variantObject.group).toBeUndefined()
    expect(variantObject.groups).toBeUndefined()
    expect(selectedFieldsField.group).toBeUndefined()
    expect(findField(variantFields, 'heading')?.group).toBeUndefined()
  })

  it('preserves multiple groups on grouped object schemas and strips variant payload groups', () => {
    const groups = [
      {name: 'contents', default: true},
      {name: 'media'},
      {name: 'button'},
      {name: 'designSystem'},
    ]
    const inputField = {
      name: 'callToAction',
      type: 'object',
      groups,
      fields: [
        {name: 'heading', type: 'string', group: 'contents'},
        {name: 'image', type: 'image', group: 'media'},
        {name: 'button', type: 'object', group: 'button', fields: []},
        {name: 'theme', type: 'string', group: 'designSystem'},
      ],
    }

    const result = withAbObject(inputField)
    const resultFields = (result as AnyField).fields ?? []
    const variantsField = findField(resultFields, fieldNames.variants) as AnyField
    const variantEntry = variantsField.of?.[0] as AnyField
    const testNameField = findField(variantEntry.fields ?? [], fieldNames.testName) as AnyField
    const variantCodeField = findField(
      variantEntry.fields ?? [],
      fieldNames.variantCode,
    ) as AnyField
    const variantObject = (variantEntry.fields ?? []).find(
      (field) => field.name === fieldNames.variant,
    ) as AnyField
    const variantFields = variantObject.fields ?? []

    expect((result as AnyField).groups).toBe(groups)
    expect(findField(resultFields, 'heading')?.group).toBe('contents')
    expect(findField(resultFields, 'image')?.group).toBe('media')
    expect(findField(resultFields, 'button')?.group).toBe('button')
    expect(findField(resultFields, 'theme')?.group).toBe('designSystem')
    expect(variantEntry.groups).toBeUndefined()
    expect(testNameField.group).toBeUndefined()
    expect(variantCodeField.group).toBeUndefined()
    expect(variantObject.group).toBeUndefined()
    expect(variantObject.groups).toBeUndefined()
    expect(findField(variantFields, 'heading')?.group).toBeUndefined()
    expect(findField(variantFields, 'image')?.group).toBeUndefined()
    expect(findField(variantFields, 'button')?.group).toBeUndefined()
    expect(findField(variantFields, 'theme')?.group).toBeUndefined()
  })
})
