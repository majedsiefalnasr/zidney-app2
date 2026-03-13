<script setup lang="ts">
/**
 * T085: License Report Generator Component
 */

import { ref } from 'vue'

const generating = ref(false)

const _generateReport = async (_format: 'csv' | 'pdf') => {
  generating.value = true
  try {
    // TODO: Call API to generate report
    // GET /v1/mmc/licenses/report?format=csv|pdf
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">Export Report</CardTitle>
    </CardHeader>
    <CardContent class="flex gap-2">
      <Button
        variant="outline"
        :disabled="generating"
        @click="generateReport('csv')"
      >
        {{ generating ? 'Generating...' : 'CSV Export' }}
      </Button>
      <Button
        variant="outline"
        :disabled="generating"
        @click="generateReport('pdf')"
      >
        {{ generating ? 'Generating...' : 'PDF Export' }}
      </Button>
    </CardContent>
  </Card>
</template>
