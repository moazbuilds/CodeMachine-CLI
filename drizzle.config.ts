import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/infrastructure/database/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: '.codemachine/data/codemachine.db',
  },
})
