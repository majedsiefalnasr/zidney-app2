/**
 * usePagination Composable
 * LOCKED DECISION 1: Agnostic pagination (server OR client mode - parent decides)
 * Component does NOT fetch data; parent app responsibility
 */

import { computed, ref } from 'vue'

export interface UsePaginationOptions {
  totalCount: number
  pageSize?: number
  initialPage?: number
}

export function usePagination(options: UsePaginationOptions) {
  const { totalCount, pageSize: initialPageSize = 25, initialPage = 1 } = options

  // State
  const currentPage = ref(initialPage)
  const pageSize = ref(initialPageSize)

  // Computed: Total pages
  const totalPages = computed(() => {
    return Math.max(1, Math.ceil(totalCount / pageSize.value))
  })

  // Computed: Page boundaries
  const isFirstPage = computed(() => currentPage.value === 1)
  const isLastPage = computed(() => currentPage.value >= totalPages.value)

  // Computed: Pagination info
  const paginationInfo = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value + 1
    const end = Math.min(currentPage.value * pageSize.value, totalCount)

    return {
      start: totalCount > 0 ? start : 0,
      end,
      total: totalCount,
      currentPage: currentPage.value,
      pageSize: pageSize.value,
    }
  })

  // Method: Go to specific page
  // Clamps page to valid range [1, totalPages]
  const goToPage = (page: number): void => {
    const clamped = Math.max(1, Math.min(Math.floor(page), totalPages.value))
    currentPage.value = clamped
  }

  // Method: Next page
  const nextPage = (): void => {
    if (!isLastPage.value) {
      currentPage.value += 1
    }
  }

  // Method: Previous page
  const previousPage = (): void => {
    if (!isFirstPage.value) {
      currentPage.value -= 1
    }
  }

  // Method: Set page size
  // Resets to first page when size changes (UX best practice)
  const setPageSize = (size: number): void => {
    if (size > 0) {
      pageSize.value = size
      currentPage.value = 1 // Reset to first page
    }
  }

  // Method: Validate page (useful for URL restoration)
  const validatePageFromUrl = (page: number | undefined, size: number | undefined): void => {
    if (size && size > 0) {
      pageSize.value = size
    }

    if (page && page > 0) {
      goToPage(page)
    }
  }

  return {
    // State (mutable refs)
    currentPage: computed({
      get: () => currentPage.value,
      set: (val) => goToPage(val),
    }),
    pageSize: computed({
      get: () => pageSize.value,
      set: (val) => setPageSize(val),
    }),

    // Computed (readonly)
    totalPages,
    isFirstPage,
    isLastPage,
    paginationInfo,

    // Methods
    goToPage,
    nextPage,
    previousPage,
    setPageSize,
    validatePageFromUrl,
  }
}
