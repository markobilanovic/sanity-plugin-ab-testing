import type {FieldMember, ObjectMember} from 'sanity'
import type {ObjectInputCustomizer, SlotDescriptor} from './types'

export function isFieldMember(member: {kind: string}): member is FieldMember {
  return member.kind === 'field'
}

export function getSlotDescriptors(
  members: ObjectMember[],
  customizers: ObjectInputCustomizer[],
): SlotDescriptor[] {
  const rendered = new Set<string>()
  const slots: SlotDescriptor[] = []

  for (const member of members) {
    if (member.kind !== 'field') {
      slots.push({
        key: member.key,
        type: 'member',
        member,
      })
      continue
    }

    if (rendered.has(member.name)) {
      continue
    }

    const customizer = customizers.find((candidate) => candidate.matchField(member))
    if (customizer) {
      const claimedFieldNames = customizer.getClaimedFieldNames(member)
      for (const claimedFieldName of claimedFieldNames) {
        rendered.add(claimedFieldName)
      }
      slots.push({
        key: member.name,
        type: 'customizer',
        customizer,
        member,
      })
      continue
    }

    slots.push({key: member.name, type: 'member', member})
  }

  return slots
}
