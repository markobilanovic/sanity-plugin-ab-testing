import type {ReactNode} from 'react'
import type {FieldMember, ObjectInputProps, ObjectMember} from 'sanity'

export type ObjectInputCustomizer = {
  matchField: (member: FieldMember) => boolean
  getClaimedFieldNames: (member: FieldMember) => string[]
  render: (props: ObjectInputProps, member: FieldMember) => ReactNode
}

export type SlotDescriptor =
  | {
      key: string
      type: 'customizer'
      customizer: ObjectInputCustomizer
      member: FieldMember
    }
  | {
      key: string
      type: 'member'
      member: ObjectMember
    }
