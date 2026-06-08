import {type DecorationMember, type ObjectInputProps, type ObjectMember} from 'sanity'

import {getSlotDescriptors, isFieldMember} from './slotDescriptors'
import type {ObjectInputCustomizer, SlotDescriptor} from './types'

export function createComposedObjectInput(customizers: ObjectInputCustomizer[]) {
  return function ComposedObjectInput(props: ObjectInputProps) {
    const {members} = props
    const slotDescriptors = getSlotDescriptors(members, customizers)
    const matchedCustomizers = new Set(
      slotDescriptors
        .filter(
          (descriptor): descriptor is Extract<SlotDescriptor, {type: 'customizer'}> =>
            descriptor.type === 'customizer',
        )
        .map((descriptor) => descriptor.customizer),
    )
    const fallbackMember = members.find(isFieldMember)
    const unmatchedCustomizers = fallbackMember
      ? customizers.filter((customizer) => !matchedCustomizers.has(customizer))
      : []
    const renderedMembers: ObjectMember[] = slotDescriptors.flatMap(
      (descriptor): ObjectMember[] => {
        if (descriptor.type === 'customizer') {
          return [
            {
              kind: 'decoration',
              key: descriptor.key,
              component: descriptor.customizer.render(props, descriptor.member),
            } satisfies DecorationMember,
          ]
        }

        return [descriptor.member]
      },
    )

    for (const [index, customizer] of unmatchedCustomizers.entries()) {
      renderedMembers.push({
        kind: 'decoration',
        key: `unmatched-customizer-${index}`,
        component: customizer.render(props, fallbackMember),
      } satisfies DecorationMember)
    }

    return props.renderDefault({
      ...props,
      members: renderedMembers,
    })
  }
}
