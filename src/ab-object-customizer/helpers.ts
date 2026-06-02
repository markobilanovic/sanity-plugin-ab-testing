import type {FieldMember, ObjectInputProps} from 'sanity'
import {AB_SELECTED_VARIANT_FIELDS_FIELD_NAME, resolveAbFieldNames} from '../abConfig'

type AbFieldNames = ReturnType<typeof resolveAbFieldNames>

export function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]'
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

export function cloneContentValue<T>(value: T, fieldNames: AbFieldNames): T {
  const clonedValue = cloneValue(value)
  const abPayloadFieldNames = getAbPayloadFieldNames(fieldNames)

  const stripAbPayloadFields = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map((item) => stripAbPayloadFields(item))
    }

    if (!isPlainRecord(input)) {
      return input
    }

    return Object.fromEntries(
      Object.entries(input)
        .filter(([key]) => !abPayloadFieldNames.has(key))
        .map(([key, entryValue]) => [key, stripAbPayloadFields(entryValue)]),
    )
  }

  return stripAbPayloadFields(clonedValue) as T
}

export function getControlVariantSeed(
  valueRecord: Record<string, unknown> | undefined,
  fieldNames: AbFieldNames,
): Record<string, unknown> {
  if (!valueRecord) {
    return {}
  }

  return cloneContentValue(valueRecord, fieldNames)
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
  fieldNames: AbFieldNames,
): Record<string, unknown> {
  const nextVariant: Record<string, unknown> = {}

  for (const fieldName of selectedFieldNames) {
    if (Object.prototype.hasOwnProperty.call(currentVariantValue, fieldName)) {
      nextVariant[fieldName] = cloneContentValue(currentVariantValue[fieldName], fieldNames)
      continue
    }

    if (Object.prototype.hasOwnProperty.call(controlVariantSeed, fieldName)) {
      nextVariant[fieldName] = cloneContentValue(controlVariantSeed[fieldName], fieldNames)
    }
  }

  if (selectedFieldNames.length > 0) {
    nextVariant[AB_SELECTED_VARIANT_FIELDS_FIELD_NAME] = selectedFieldNames
  }

  return nextVariant
}
