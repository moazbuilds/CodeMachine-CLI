export interface SlashCommand {
  command: string
  description: string
}

export interface PromptProps {
  onSubmit: (input: string) => void
  hint?: string
  placeholder?: string
  disabled?: boolean
}
