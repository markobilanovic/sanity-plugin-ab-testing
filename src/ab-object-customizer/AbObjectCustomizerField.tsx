import {Button, Dialog, Flex, Stack, Text} from '@sanity/ui'
import {type ReactElement, useEffect, useMemo, useState} from 'react'
import {
  MemberField,
  type ObjectInputProps,
  PatchEvent,
  set,
  setIfMissing,
  unset,
  useClient,
} from 'sanity'

import {
  AB_CLONE_MODE_OPTION,
  AB_CONFIG_ACTION_EVENT_NAME,
  AB_SELECTED_VARIANT_FIELDS_FIELD_NAME,
  type AbFieldNames,
  type AbObjectCloneMode,
  DEFAULT_STUDIO_API_VERSION,
  resolveAbObjectCloneMode,
} from '../abConfig'
import {AbVariantConfigDialog} from './AbVariantConfigDialog'
import {
  cloneContentValue,
  cloneValue,
  createSelectionScopedVariantRecord,
  getControlVariantSeed,
  getFieldMemberByName,
  normalizeSelectedVariantFields,
  pathToKey,
} from './helpers'
import type {AbVariantItem} from './types'
import {useAbTestDialogState} from './useAbTestDialogState'

type AbObjectCustomizerFieldProps = {
  props: ObjectInputProps
  fieldNames: AbFieldNames
  abTestTypeName: string
  cloneMode: AbObjectCloneMode
}

type FieldActionResultDialogState = {
  kind: 'success' | 'info'
  fieldName: string
  abTestName: string
  updatedVariantsCount: number
  totalVariantsCount: number
}

export function AbObjectCustomizerField({
  props,
  fieldNames,
  abTestTypeName,
  cloneMode,
}: AbObjectCustomizerFieldProps): ReactElement {
  const {
    renderInput,
    renderField,
    renderItem,
    renderPreview,
    renderBlock,
    renderInlineBlock,
    renderAnnotation,
    onChange,
    value,
  } = props
  const client = useClient({apiVersion: DEFAULT_STUDIO_API_VERSION})

  const abVariantsField = getFieldMemberByName(props, fieldNames.variants)
  const valueRecord =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
  const currentAbTestRef =
    valueRecord?.[fieldNames.testRef] && typeof valueRecord[fieldNames.testRef] === 'object'
      ? (valueRecord[fieldNames.testRef] as {_ref?: string})._ref
      : undefined
  const currentVariants = Array.isArray(valueRecord?.[fieldNames.variants])
    ? (valueRecord[fieldNames.variants] as AbVariantItem[])
    : []
  const currentExperimentName = currentVariants[0]?.abTestName?.trim() || currentAbTestRef
  const controlVariantSeed = useMemo(
    () => getControlVariantSeed(valueRecord, fieldNames),
    [fieldNames, valueRecord],
  )
  const [selectedFieldName, setSelectedFieldName] = useState<string | null>(null)
  const [fieldActionResultDialog, setFieldActionResultDialog] =
    useState<FieldActionResultDialogState | null>(null)
  const schemaCloneMode = resolveAbObjectCloneMode(
    (props.schemaType as {options?: Record<string, unknown>} | undefined)?.options?.[
      AB_CLONE_MODE_OPTION
    ],
  )
  const effectiveCloneMode = schemaCloneMode ?? cloneMode
  const shouldSelectSingleField = effectiveCloneMode === 'selectedFields'
  const variantSeed = useMemo(() => {
    if (!shouldSelectSingleField || !selectedFieldName) {
      return controlVariantSeed
    }

    if (!Object.prototype.hasOwnProperty.call(controlVariantSeed, selectedFieldName)) {
      return {}
    }

    return cloneValue({
      [selectedFieldName]: controlVariantSeed[selectedFieldName],
    })
  }, [controlVariantSeed, selectedFieldName, shouldSelectSingleField])
  const shouldShowAbVariant = Boolean(
    valueRecord &&
    typeof valueRecord[fieldNames.toggle] === 'boolean' &&
    valueRecord[fieldNames.toggle],
  )

  const {
    isDialogOpen,
    isLoadingAbTests,
    abTests,
    selectedAbTestId,
    selectedAbTest,
    selectedAbTestVariantCount,
    openDialog,
    closeDialog,
    selectAbTest,
  } = useAbTestDialogState({
    client,
    abTestTypeName,
    currentAbTestRef,
  })
  const selectedAbTestName = selectedAbTest?.name || selectedAbTestId
  const variantCodes = useMemo(
    () =>
      Array.from(
        new Set(
          (selectedAbTest?.variantCodes ?? []).filter((code): code is string =>
            Boolean(code && code.trim()),
          ),
        ),
      ),
    [selectedAbTest],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => undefined
    }

    const currentPathKey = pathToKey(props.path)

    const handleOpenConfigDialog = (event: Event) => {
      const customEvent = event as CustomEvent<{
        targetPath?: unknown
        selectedFieldName?: unknown
      }>

      const eventTargetPath = customEvent.detail?.targetPath
      if (pathToKey(eventTargetPath) !== currentPathKey) {
        return
      }

      const eventSelectedFieldName = customEvent.detail?.selectedFieldName
      const selectedField =
        typeof eventSelectedFieldName === 'string' ? eventSelectedFieldName : null

      // Field-level action on an already configured AB object should extend existing
      // variants directly, without reopening AB test selection.
      if (
        shouldSelectSingleField &&
        selectedField &&
        shouldShowAbVariant &&
        currentVariants.length > 0
      ) {
        let hasChanges = false
        let updatedVariantsCount = 0
        const nextVariants: AbVariantItem[] = currentVariants.map((item) => {
          const currentVariantRecord =
            item.variant && typeof item.variant === 'object'
              ? (cloneValue(item.variant) as Record<string, unknown>)
              : {}

          const selectedFields = normalizeSelectedVariantFields(
            currentVariantRecord[AB_SELECTED_VARIANT_FIELDS_FIELD_NAME],
          )
          const selectedFieldSet =
            selectedFields.length > 0
              ? new Set(selectedFields)
              : new Set(
                  Object.keys(currentVariantRecord).filter(
                    (fieldName) => fieldName !== AB_SELECTED_VARIANT_FIELDS_FIELD_NAME,
                  ),
                )

          if (!selectedFieldSet.has(selectedField)) {
            selectedFieldSet.add(selectedField)
          }

          const selectedFieldNames = Array.from(selectedFieldSet)
          const nextVariantRecord = createSelectionScopedVariantRecord(
            selectedFieldNames,
            currentVariantRecord,
            controlVariantSeed,
            fieldNames,
          )

          const variantChanged =
            JSON.stringify(nextVariantRecord) !== JSON.stringify(currentVariantRecord)
          if (variantChanged) {
            hasChanges = true
            updatedVariantsCount += 1
          }

          return {
            ...item,
            variant: nextVariantRecord,
          }
        })

        if (hasChanges) {
          onChange(PatchEvent.from([set(nextVariants, [fieldNames.variants])]))
          setFieldActionResultDialog({
            kind: 'success',
            fieldName: selectedField,
            abTestName: currentExperimentName || currentAbTestRef || 'unknown AB test',
            updatedVariantsCount,
            totalVariantsCount: currentVariants.length,
          })
        } else {
          setFieldActionResultDialog({
            kind: 'info',
            fieldName: selectedField,
            abTestName: currentExperimentName || currentAbTestRef || 'unknown AB test',
            updatedVariantsCount: 0,
            totalVariantsCount: currentVariants.length,
          })
        }
        return
      }

      setSelectedFieldName(shouldSelectSingleField ? selectedField : null)
      openDialog()
    }

    window.addEventListener(AB_CONFIG_ACTION_EVENT_NAME, handleOpenConfigDialog)

    return () => {
      window.removeEventListener(AB_CONFIG_ACTION_EVENT_NAME, handleOpenConfigDialog)
    }
  }, [
    currentAbTestRef,
    currentExperimentName,
    controlVariantSeed,
    currentVariants,
    fieldNames.variants,
    onChange,
    openDialog,
    props.path,
    shouldShowAbVariant,
    shouldSelectSingleField,
  ])

  const handleCloseDialog = () => {
    setSelectedFieldName(null)
    closeDialog()
  }

  const handleEnableAbVariantWithSelection = () => {
    if (!selectedAbTestId || variantCodes.length === 0) {
      return
    }

    const variants: AbVariantItem[] = variantCodes.map((code, index) => ({
      _key: `${Date.now()}-${index}-${code}`,
      _type: fieldNames.variantEntryType,
      abTestName: selectedAbTestName,
      variantCode: code,
      variant:
        shouldSelectSingleField && selectedFieldName
          ? createSelectionScopedVariantRecord(
              [selectedFieldName],
              cloneValue(variantSeed),
              controlVariantSeed,
              fieldNames,
            )
          : cloneContentValue(variantSeed, fieldNames),
    }))

    onChange(
      PatchEvent.from([
        setIfMissing({}, []),
        set(true, [fieldNames.toggle]),
        set(
          {
            _type: 'reference',
            _ref: selectedAbTestId,
          },
          [fieldNames.testRef],
        ),
        set(variants, [fieldNames.variants]),
      ]),
    )
    handleCloseDialog()
  }

  const handleDisableAbVariant = () => {
    onChange(
      PatchEvent.from([
        set(false, [fieldNames.toggle]),
        unset([fieldNames.testRef]),
        unset([fieldNames.variants]),
      ]),
    )
  }

  return (
    <Stack space={3}>
      <Flex gap={2}>
        {shouldShowAbVariant ? (
          <Button
            mode="ghost"
            tone="caution"
            text="Disable AB variant"
            onClick={handleDisableAbVariant}
          />
        ) : null}
      </Flex>

      {currentExperimentName ? (
        <Text muted size={1}>
          Experiment: {currentExperimentName}
        </Text>
      ) : null}

      {shouldShowAbVariant && abVariantsField ? (
        <Stack space={2}>
          <MemberField
            member={abVariantsField}
            renderInput={renderInput}
            renderField={renderField}
            renderItem={renderItem}
            renderPreview={renderPreview}
            renderBlock={renderBlock}
            renderInlineBlock={renderInlineBlock}
            renderAnnotation={renderAnnotation}
          />
        </Stack>
      ) : null}

      <AbVariantConfigDialog
        isOpen={isDialogOpen}
        isLoadingAbTests={isLoadingAbTests}
        abTests={abTests}
        selectedAbTestId={selectedAbTestId}
        selectedAbTestVariantCount={selectedAbTestVariantCount}
        variantCodesCount={variantCodes.length}
        onClose={handleCloseDialog}
        onConfirm={handleEnableAbVariantWithSelection}
        onSelectAbTest={selectAbTest}
      />

      {fieldActionResultDialog ? (
        <Dialog
          id="ab-field-action-result-dialog"
          header={
            fieldActionResultDialog.kind === 'success'
              ? 'Field added to AB variants'
              : 'Field already present in AB variants'
          }
          onClose={() => setFieldActionResultDialog(null)}
          width={1}
          footer={
            <Flex justify="flex-end">
              <Button
                mode="default"
                tone="primary"
                text="OK"
                onClick={() => setFieldActionResultDialog(null)}
              />
            </Flex>
          }
        >
          <Stack padding={4} space={3}>
            <Text size={1}>AB test: {fieldActionResultDialog.abTestName}</Text>
            {fieldActionResultDialog.kind === 'success' ? (
              <Text size={1}>
                Field &#34;{fieldActionResultDialog.fieldName}&#34; was added to{' '}
                {fieldActionResultDialog.updatedVariantsCount} of{' '}
                {fieldActionResultDialog.totalVariantsCount} variant clone
                {fieldActionResultDialog.totalVariantsCount === 1 ? '' : 's'}.
              </Text>
            ) : (
              <Text size={1}>
                Field &#34;{fieldActionResultDialog.fieldName}&#34; already exists in all{' '}
                {fieldActionResultDialog.totalVariantsCount} variant clone
                {fieldActionResultDialog.totalVariantsCount === 1 ? '' : 's'}.
              </Text>
            )}
          </Stack>
        </Dialog>
      ) : null}
    </Stack>
  )
}
