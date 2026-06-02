import {defineDocumentFieldAction, type Path} from 'sanity'

import {AB_CONFIG_ACTION_EVENT_NAME, type AbObjectCloneMode} from '../abConfig'
import {hasAbFields, isAbControlFieldPath, isFieldLevelCloneCandidate} from './helpers'
import type {AbFieldNames} from './types'

export function createConfigureAbVariantFieldAction(
  fieldNames: AbFieldNames,
  options: {cloneMode?: AbObjectCloneMode} = {},
): ReturnType<typeof defineDocumentFieldAction> {
  const cloneMode = options.cloneMode ?? 'selectedFields'

  return defineDocumentFieldAction({
    name: 'abObjectCloning/configureVariant',
    useAction: ({path, schemaType}) => {
      const isControlFieldPath = isAbControlFieldPath(path as Path, fieldNames)
      const isObjectLevelAction = hasAbFields(schemaType, fieldNames)
      const canUseFieldLevelAction =
        cloneMode === 'selectedFields' && isFieldLevelCloneCandidate(path as Path)

      return {
        type: 'action',
        hidden: isControlFieldPath || (!isObjectLevelAction && !canUseFieldLevelAction),
        title: 'Configure AB variant',
        onAction: () => {
          if (typeof window === 'undefined') {
            return
          }

          const targetPath = isObjectLevelAction ? path : path.slice(0, -1)
          const lastSegment = path[path.length - 1] as unknown
          const selectedFieldName =
            !isObjectLevelAction && typeof lastSegment === 'string' ? lastSegment : undefined

          window.dispatchEvent(
            new CustomEvent(AB_CONFIG_ACTION_EVENT_NAME, {
              detail: {
                targetPath,
                selectedFieldName,
              },
            }),
          )
        },
      }
    },
  })
}
