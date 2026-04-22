import type {FieldMember, ObjectInputProps} from 'sanity'
import {AB_SELECTED_VARIANT_FIELDS_FIELD_NAME, resolveAbFieldNames} from '../abConfig'

export function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

export function getControlVariantSeed(
  valueRecord: Record<string, unknown> | undefined,
  fieldNames: ReturnType<typeof resolveAbFieldNames>,
): Record<string, unknown> {
  if (!valueRecord) {
    return {}
  }

  const controlEntries = Object.entries(valueRecord).filter(
    ([key]) =>
      key !== fieldNames.toggle &&
      key !== fieldNames.variants &&
      key !== fieldNames.variant &&
      key !== fieldNames.testRef,
  )

  return cloneValue(Object.fromEntries(controlEntries))
}

export function pathToKey(path: unknown): string {
  return JSON.stringify(path)
}

export function getFieldMemberByName(
  props: ObjectInputProps,
  fieldName: string,
): FieldMember | undefined {
  return props.members.find(
    (member): member is FieldMember => member.kind === 'field' && member.name === fieldName,
  )
}

export function normalizeSelectedVariantFields(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return []
  }

  return Array.from(
    new Set(
      input
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

export function createSelectionScopedVariantRecord(
  selectedFieldNames: string[],
  currentVariantValue: Record<string, unknown>,
  controlVariantSeed: Record<string, unknown>,
): Record<string, unknown> {
  const nextVariant: Record<string, unknown> = {}

  for (const fieldName of selectedFieldNames) {
    if (Object.prototype.hasOwnProperty.call(currentVariantValue, fieldName)) {
      nextVariant[fieldName] = cloneValue(currentVariantValue[fieldName])
      continue
    }

    if (Object.prototype.hasOwnProperty.call(controlVariantSeed, fieldName)) {
      nextVariant[fieldName] = cloneValue(controlVariantSeed[fieldName])
    }
  }

  if (selectedFieldNames.length > 0) {
    nextVariant[AB_SELECTED_VARIANT_FIELDS_FIELD_NAME] = selectedFieldNames
  }

  return nextVariant
}
