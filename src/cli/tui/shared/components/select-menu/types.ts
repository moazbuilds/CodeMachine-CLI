export interface SelectChoice<T = string> {
  title: string
  value: T
  description?: string
}

export interface SelectMenuProps<T = string> {
  message: string
  choices: SelectChoice<T>[]
  onSelect: (value: T) => void
  onCancel?: () => void
}
