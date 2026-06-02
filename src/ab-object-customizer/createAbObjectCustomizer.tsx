import {createElement} from 'react'
import {
  DEFAULT_AB_TEST_TYPE_NAME,
  DEFAULT_AB_OBJECT_CLONE_MODE,
  resolveAbFieldNames,
  type AbFieldNameOverrides,
  type AbObjectCloneMode,
} from '../abConfig'
import type {ObjectInputCustomizer} from '../composed-object-input'
import {AbObjectCustomizerField} from './AbObjectCustomizerField'

export type AbObjectCustomizerOptions = {
  abTestTypeName?: string
  fieldNames?: AbFieldNameOverrides
  cloneMode?: AbObjectCloneMode
}

export function createAbObjectCustomizer(
  options: AbObjectCustomizerOptions = {},
): ObjectInputCustomizer {
  const fieldNames = resolveAbFieldNames(options.fieldNames)
  const abTestTypeName = options.abTestTypeName ?? DEFAULT_AB_TEST_TYPE_NAME
  const cloneMode = options.cloneMode ?? DEFAULT_AB_OBJECT_CLONE_MODE

  return {
    matchField: (member) => member.name === fieldNames.toggle,
    getClaimedFieldNames: () => [fieldNames.toggle, fieldNames.variants, fieldNames.testRef],
    render: (props) =>
      createElement(AbObjectCustomizerField, {
        props,
        fieldNames,
        abTestTypeName,
        cloneMode,
      }),
  }
}
