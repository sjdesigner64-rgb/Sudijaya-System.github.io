export const toDate = (value: string | Date | undefined | null): Date | undefined => {
  if (!value) return undefined
  if (value instanceof Date) return value
  const d = new Date(value)
  return isNaN(d.getTime()) ? undefined : d
}
