/**
 * One place to load and refresh a trip's summary, expense list and metadata, so
 * every mutation refreshes exactly the same set of figures.
 */
export function useTrip(tripId: MaybeRefOrGetter<string>) {
  const id = toRef(tripId)

  const summary = useFetch(() => `/api/trips/${id.value}/summary`, { watch: [id] })
  const expenses = useFetch(() => `/api/trips/${id.value}/expenses`, { watch: [id], default: () => [] })
  const detail = useFetch(() => `/api/trips/${id.value}`, { watch: [id] })

  async function refresh() {
    await Promise.all([summary.refresh(), expenses.refresh(), detail.refresh()])
  }

  return {
    trip: computed(() => summary.data.value?.trip),
    summary: computed(() => summary.data.value?.summary),
    currencies: computed(() => detail.data.value?.currencies ?? []),
    expenses: expenses.data,
    status: summary.status,
    error: summary.error,
    refresh
  }
}
