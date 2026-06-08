import {describe, expect, it} from 'vitest'
import type {FieldMember, FieldSetMember} from 'sanity'

import type {ObjectInputCustomizer} from './types'
import {getSlotDescriptors} from './slotDescriptors'

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

function createFieldSetMember(key: string): FieldSetMember {
  return {
    kind: 'fieldSet',
    key,
    _inSelectedGroup: true,
    groups: [],
    fieldSet: {
      path: [key],
      name: key,
      level: 0,
      members: [],
    },
    path: [key],
  }
}

describe('getSlotDescriptors', () => {
  it('preserves non-field members so grouped object rendering is retained', () => {
    const fieldSet = createFieldSetMember('contents')
    const heading = createFieldMember('heading')

    const descriptors = getSlotDescriptors([fieldSet, heading], [])

    expect(descriptors).toEqual([
      {key: 'contents', type: 'member', member: fieldSet},
      {key: 'heading', type: 'member', member: heading},
    ])
  })

  it('replaces a matched field with one customizer slot and skips claimed fields', () => {
    const toggle = createFieldMember('showAbVariant')
    const testRef = createFieldMember('abTestRef')
    const variants = createFieldMember('abVariants')
    const heading = createFieldMember('heading')
    const customizer: ObjectInputCustomizer = {
      matchField: (member) => member.name === 'showAbVariant',
      getClaimedFieldNames: () => ['showAbVariant', 'abTestRef', 'abVariants'],
      render: () => null,
    }

    const descriptors = getSlotDescriptors([toggle, testRef, variants, heading], [customizer])

    expect(descriptors.map((descriptor) => descriptor.type)).toEqual(['customizer', 'member'])
    expect(descriptors.map((descriptor) => descriptor.key)).toEqual(['showAbVariant', 'heading'])
  })
})
