import React from 'react'
import {describe, expect, it, vi} from 'vitest'
import type {FieldMember, ObjectInputProps} from 'sanity'

import {resolveAbFieldNames} from './abConfig'
import {abObjectCloningPlugin} from './index'

const fieldNames = resolveAbFieldNames()

function createFieldMember(name: string): FieldMember {
  return {
    kind: 'field',
    key: name,
    name,
    index: 0,
    collapsed: false,
    collapsible: false,
    open: true,
    inSelectedGroup: true,
    groups: [],
    field: undefined as unknown as FieldMember['field'],
    path: [name],
  }
}

describe('abObjectCloningPlugin form input', () => {
  it('keeps the AB-composed input renderDefault pointed at Sanity default rendering', () => {
    const renderDefault = vi.fn(() => null)
    const customInput = vi.fn((props: ObjectInputProps) => props.renderDefault(props))
    const props = {
      schemaType: {
        jsonType: 'object',
        name: 'settings',
        type: {name: 'object', jsonType: 'object'},
        components: {input: customInput},
      },
      members: [
        createFieldMember(fieldNames.toggle),
        createFieldMember(fieldNames.testRef),
        createFieldMember(fieldNames.variants),
        createFieldMember('title'),
      ],
      renderDefault,
    } as unknown as ObjectInputProps

    const plugin = abObjectCloningPlugin()
    const input = plugin.form?.components?.input
    const customInputElement = input?.(props) as React.ReactElement<ObjectInputProps>
    const composedInputElement = customInputElement.type(
      customInputElement.props,
    ) as React.ReactElement<ObjectInputProps>

    composedInputElement.type(composedInputElement.props)

    expect(customInput).toHaveBeenCalledTimes(1)
    expect(renderDefault).toHaveBeenCalledTimes(1)
    expect(renderDefault.mock.calls[0]?.[0]).toMatchObject({
      renderDefault,
      members: expect.arrayContaining([expect.objectContaining({kind: 'decoration'})]),
    })
  })
})
