import {
  AB_CLONE_MODE_OPTION,
  AB_INTERNAL_OPTION,
  AB_SELECTED_VARIANT_FIELDS_FIELD_NAME,
  AB_VARIANTS_DISABLE_ACTIONS,
  DEFAULT_AB_OBJECT_CLONE_MODE,
  type AbFieldLabelOverrides,
  type AbFieldLabels,
  type AbFieldNameOverrides,
  type AbFieldNames,
  type AbObjectCloneMode,
  DEFAULT_AB_TEST_TYPE_NAME,
  resolveAbFieldLabels,
  resolveAbFieldNames,
} from './abConfig'

type UnknownRecord = Record<string, unknown>
type AnyField = Record<string, unknown> & {
  name?: string
  type?: string
  title?: string
  fields?: AnyField[]
  of?: AnyField[]
  groups?: unknown
  options?: unknown
  validation?: unknown
}

type SelectionAwareContext = {
  parent?: unknown
}

function getDefaultGroupName(groups: unknown): string | undefined {
  if (!Array.isArray(groups)) {
    return undefined
  }

  const defaultGroup = groups.find(
    (group): group is {name: string; default?: boolean} =>
      typeof group === 'object' &&
      group !== null &&
      typeof (group as {name?: unknown}).name === 'string' &&
      Boolean((group as {default?: unknown}).default),
  )
  const fallbackGroup = groups.find(
    (group): group is {name: string} =>
      typeof group === 'object' &&
      group !== null &&
      typeof (group as {name?: unknown}).name === 'string',
  )

  return defaultGroup?.name ?? fallbackGroup?.name
}

function getSelectedVariantFieldSet(parent: unknown): Set<string> | null {
  const parentRecord = parent as Record<string, unknown> | undefined
  const selectedFields = parentRecord?.[AB_SELECTED_VARIANT_FIELDS_FIELD_NAME] as unknown
  if (!Array.isArray(selectedFields)) {
    return null
  }

  return new Set(
    selectedFields.filter((value): value is string => typeof value === 'string' && Boolean(value)),
  )
}

function shouldSkipValidationForField(fieldName: string | undefined, parent: unknown): boolean {
  if (typeof fieldName !== 'string') {
    return false
  }

  const selectedFieldSet = getSelectedVariantFieldSet(parent)
  return selectedFieldSet !== null && !selectedFieldSet.has(fieldName)
}

function decorateVariantFieldValidation(field: AnyField): AnyField['validation'] {
  const existingValidation = field.validation
  const fieldName = field.name
  const shouldPreserveValidation = field.type === 'array'

  if (shouldPreserveValidation) {
    return existingValidation
  }

  return (rule: {skip?: () => unknown}, context?: SelectionAwareContext) => {
    if (shouldSkipValidationForField(fieldName, context?.parent)) {
      return typeof rule?.skip === 'function' ? rule.skip() : rule
    }

    if (typeof existingValidation === 'function') {
      return existingValidation(rule, context)
    }

    if (existingValidation !== undefined) {
      return existingValidation
    }

    return rule
  }
}

function decorateVariantFieldsWithSelectionVisibility(fields: AnyField[]): AnyField[] {
  return fields.map((field) => {
    const decorated = {...field}
    const existingHidden = field.hidden

    decorated.hidden = (context: {parent?: unknown}) => {
      const selectedFieldSet = getSelectedVariantFieldSet(context.parent)

      const isHiddenBySelection =
        selectedFieldSet !== null &&
        typeof field.name === 'string' &&
        !selectedFieldSet.has(field.name)

      const isHiddenByExistingRule =
        typeof existingHidden === 'function'
          ? Boolean(existingHidden(context))
          : Boolean(existingHidden)

      return isHiddenBySelection || isHiddenByExistingRule
    }
    decorated.validation = decorateVariantFieldValidation(field)

    if (Array.isArray(field.fields)) {
      decorated.fields = decorateVariantFieldsWithSelectionVisibility(field.fields)
    }

    return decorated
  })
}

export type WithAbObjectOptions = {
  abTestTypeName?: string
  fieldNames?: AbFieldNameOverrides
  labels?: AbFieldLabelOverrides
  cloneMode?: AbObjectCloneMode
}

function getAbPayloadFieldNames(fieldNames: AbFieldNames): Set<string> {
  return new Set([
    AB_SELECTED_VARIANT_FIELDS_FIELD_NAME,
    fieldNames.toggle,
    fieldNames.variants,
    fieldNames.variant,
    fieldNames.testRef,
    fieldNames.testName,
    fieldNames.variantCode,
  ])
}

function removeAbPayloadFieldsFromSchema(fields: AnyField[], fieldNames: AbFieldNames): AnyField[] {
  const abPayloadFieldNames = getAbPayloadFieldNames(fieldNames)

  return fields
    .filter((field) => typeof field.name !== 'string' || !abPayloadFieldNames.has(field.name))
    .map((field) => {
      const nextField: AnyField = {...field}

      if (Array.isArray(field.fields)) {
        nextField.fields = removeAbPayloadFieldsFromSchema(field.fields, fieldNames)
      }

      if (Array.isArray(field.of)) {
        nextField.of = field.of.map((nestedType) => {
          const nextNestedType: AnyField = {...nestedType}

          if (Array.isArray(nestedType.fields)) {
            nextNestedType.fields = removeAbPayloadFieldsFromSchema(nestedType.fields, fieldNames)
          }

          return nextNestedType
        })
      }

      return nextField
    })
}

function removeGroupsFromSchema(field: AnyField): AnyField {
  const nextField: AnyField = {...field}

  delete nextField.group
  delete nextField.groups

  if (Array.isArray(field.fields)) {
    nextField.fields = field.fields.map(removeGroupsFromSchema)
  }

  if (Array.isArray(field.of)) {
    nextField.of = field.of.map(removeGroupsFromSchema)
  }

  return nextField
}

function transformNestedCollections(field: AnyField, config: WithAbObjectOptions): AnyField {
  const transformed: AnyField = {...field}

  if (Array.isArray(field.fields)) {
    transformed.fields = field.fields.map((nestedField) => transformField(nestedField, config))
  }

  if (Array.isArray(field.of)) {
    transformed.of = field.of.map((nestedType) => transformField(nestedType, config))
  }

  return transformed
}

function createAbToggleField(
  fieldNames: AbFieldNames,
  labels: AbFieldLabels,
  group?: string,
): AnyField {
  return {
    name: fieldNames.toggle,
    title: labels.toggle,
    type: 'boolean',
    initialValue: false,
    ...(group ? {group} : {}),
  }
}

function createAbTestRefField(
  fieldNames: AbFieldNames,
  labels: AbFieldLabels,
  abTestTypeName: string | undefined,
  group?: string,
): AnyField {
  return {
    name: fieldNames.testRef,
    title: labels.testRef,
    type: 'reference',
    to: [{type: abTestTypeName ?? DEFAULT_AB_TEST_TYPE_NAME}],
    ...(group ? {group} : {}),
    options: {
      [AB_INTERNAL_OPTION]: true,
    },
  }
}

function createAbVariantsField(
  fields: AnyField[],
  fieldNames: AbFieldNames,
  labels: AbFieldLabels,
  cloneMode: AbObjectCloneMode,
  group?: string,
): AnyField {
  const groupedVariantFields = fields.map(removeGroupsFromSchema)
  const variantFields: AnyField[] =
    cloneMode === 'allFields'
      ? groupedVariantFields
      : [
          {
            name: AB_SELECTED_VARIANT_FIELDS_FIELD_NAME,
            type: 'array',
            of: [{type: 'string'}],
            hidden: true,
            readOnly: true,
            options: {
              [AB_INTERNAL_OPTION]: true,
            },
          },
          ...decorateVariantFieldsWithSelectionVisibility(groupedVariantFields),
        ]

  return {
    name: fieldNames.variants,
    title: labels.variants,
    type: 'array',
    ...(group ? {group} : {}),
    options: {
      [AB_INTERNAL_OPTION]: true,
      disableActions: AB_VARIANTS_DISABLE_ACTIONS,
    },
    of: [
      {
        name: fieldNames.variantEntryType,
        title: labels.variantEntry,
        type: 'object',
        options: {
          [AB_INTERNAL_OPTION]: true,
        },
        preview: {
          select: {
            title: fieldNames.variantCode,
          },
        },
        fields: [
          {
            name: fieldNames.testName,
            title: labels.testName,
            type: 'string',
            readOnly: true,
            options: {
              [AB_INTERNAL_OPTION]: true,
            },
          },
          {
            name: fieldNames.variantCode,
            title: labels.variantCode,
            type: 'string',
            readOnly: true,
            options: {
              [AB_INTERNAL_OPTION]: true,
            },
          },
          {
            name: fieldNames.variant,
            title: labels.variant,
            type: 'object',
            options: {
              [AB_INTERNAL_OPTION]: true,
            },
            fields: variantFields,
          },
        ],
      },
    ],
  }
}

function hasAbControlFields(fields: AnyField[]): boolean {
  const abFieldNames = resolveAbFieldNames()
  const fieldNames = new Set(fields.map((field) => field.name))
  return (
    fieldNames.has(abFieldNames.toggle) ||
    fieldNames.has(abFieldNames.variants) ||
    fieldNames.has(abFieldNames.testRef)
  )
}

function transformAbContainerField(field: AnyField, config: WithAbObjectOptions): AnyField {
  const fieldOptions = (field.options ?? {}) as UnknownRecord

  if (fieldOptions[AB_INTERNAL_OPTION]) {
    return transformNestedCollections(field, config)
  }

  const originalFields = Array.isArray(field.fields) ? field.fields : []
  const transformedBaseFields = originalFields.map((nestedField) =>
    transformField(nestedField, config),
  )

  const transformed: AnyField = {
    ...field,
    fields: transformedBaseFields,
    options: {
      ...fieldOptions,
    },
  }

  if (hasAbControlFields(transformedBaseFields)) {
    return transformed
  }

  const resolvedFieldNames = resolveAbFieldNames(config.fieldNames)
  const resolvedLabels = resolveAbFieldLabels(config.labels)
  const cloneMode = config.cloneMode ?? DEFAULT_AB_OBJECT_CLONE_MODE
  const defaultGroupName = getDefaultGroupName(field.groups)
  const variantBaseFields =
    cloneMode === 'allFields'
      ? removeAbPayloadFieldsFromSchema(originalFields, resolvedFieldNames)
      : transformedBaseFields

  transformed.fields = [
    ...transformedBaseFields,
    createAbToggleField(resolvedFieldNames, resolvedLabels, defaultGroupName),
    createAbTestRefField(
      resolvedFieldNames,
      resolvedLabels,
      config.abTestTypeName,
      defaultGroupName,
    ),
    createAbVariantsField(
      variantBaseFields,
      resolvedFieldNames,
      resolvedLabels,
      cloneMode,
      defaultGroupName,
    ),
  ]
  transformed.options = {
    ...transformed.options,
    [AB_CLONE_MODE_OPTION]: cloneMode,
  }

  return transformed
}

function transformField(field: AnyField, options: WithAbObjectOptions): AnyField {
  if (field.type === 'object' || field.type === 'document') {
    return transformAbContainerField(field, options)
  }

  return transformNestedCollections(field, options)
}

/**
 * Adds AB clone controls to an object field:
 * - showAbVariant: boolean toggle
 * - abVariants: duplicate payloads for AB variants
 *
 * Usage:
 * `defineField(withAbObject({ name: "settings", type: "object", fields: [...] }))`
 *
 * @public
 */
export function withAbObject<TField extends object>(
  field: TField,
  options: WithAbObjectOptions = {},
): TField {
  return transformField(field as unknown as AnyField, options) as TField
}
