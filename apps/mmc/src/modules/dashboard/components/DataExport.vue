<template>
  <div class="data-export">
    <!-- Export Options -->
    <div class="export-grid">
      <Card
        v-for="option in exportOptions"
        :key="option.id"
        class="export-card"
        @click="selectOption(option.id)"
        :class="{ selected: selectedOption === option.id }"
      >
        <CardContent class="export-card-content">
          <component
            :is="option.icon"
            class="export-icon"
            :style="{ color: option.color }"
          />
          <div class="export-details">
            <h4>{{ option.label }}</h4>
            <p>{{ option.description }}</p>
          </div>
          <div v-if="selectedOption === option.id" class="selected-indicator">
            <Check class="w-5 h-5" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Additional Options (if applicable) -->
    <div v-if="selectedOption === 'all'" class="options-section">
      <div class="option-group">
        <Label htmlFor="date-range" class="option-label">Date Range</Label>
        <div class="date-inputs">
          <input type="date" v-model="startDate" class="date-input" />
          <span class="date-separator">to</span>
          <input type="date" v-model="endDate" class="date-input" />
        </div>
      </div>

      <div class="option-group">
        <Label htmlFor="include-charts" class="option-label"
          >Include Data</Label
        >
        <div class="checkboxes">
          <div class="checkbox-item">
            <Checkbox id="include-summary" v-model="includeData.summary" />
            <Label htmlFor="include-summary">Summary Metrics</Label>
          </div>
          <div class="checkbox-item">
            <Checkbox id="include-products" v-model="includeData.products" />
            <Label htmlFor="include-products">Product Revenue</Label>
          </div>
          <div class="checkbox-item">
            <Checkbox
              id="include-geographic"
              v-model="includeData.geographic"
            />
            <Label htmlFor="include-geographic">Geographic Data</Label>
          </div>
          <div class="checkbox-item">
            <Checkbox
              id="include-affiliates"
              v-model="includeData.affiliates"
            />
            <Label htmlFor="include-affiliates">Affiliate Performance</Label>
          </div>
          <div class="checkbox-item">
            <Checkbox id="include-trends" v-model="includeData.trends" />
            <Label htmlFor="include-trends">Growth Trends</Label>
          </div>
        </div>
      </div>
    </div>

    <!-- File Format Selection -->
    <div v-if="selectedOption === 'all'" class="format-section">
      <Label class="section-label">Export Format</Label>
      <div class="format-buttons">
        <Button
          v-for="format in formats"
          :key="format"
          :variant="exportFormat === format ? 'default' : 'outline'"
          @click="exportFormat = format"
          size="sm"
        >
          {{ format.toUpperCase() }}
        </Button>
      </div>
    </div>

    <!-- Export Actions -->
    <div class="action-section">
      <Button
        variant="default"
        @click="handleExport"
        :disabled="isExporting"
        class="export-button"
      >
        <component
          :is="isExporting ? Loader : Download"
          class="w-4 h-4 mr-2"
          :class="{ 'animate-spin': isExporting }"
        />
        {{ isExporting ? 'Exporting...' : 'Export' }}
      </Button>
      <Button variant="outline" @click="resetForm"> Reset </Button>
    </div>

    <!-- Status Message -->
    <div
      v-if="statusMessage"
      class="status-message"
      :class="statusMessage.type"
    >
      <CheckCircle v-if="statusMessage.type === 'success'" class="w-5 h-5" />
      <AlertCircle v-if="statusMessage.type === 'error'" class="w-5 h-5" />
      <span>{{ statusMessage.text }}</span>
    </div>

    <!-- Help Text -->
    <div class="help-text">
      <Info class="w-4 h-4" />
      <span>
        Maximum export size: 50,000 rows. For larger datasets, use the
        <strong>monthly export</strong> option.
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  AlertCircle,
  Award,
  BarChart3,
  Check,
  CheckCircle,
  Download,
  Globe,
  Info,
  Loader,
  TrendingUp,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import { ref } from 'vue'
import { Button, Card, CardContent, Checkbox, Label } from '@/components/ui'

void [
  AlertCircle,
  Award,
  BarChart3,
  Check,
  CheckCircle,
  Download,
  Globe,
  Info,
  Loader,
  TrendingUp,
  Button,
  Card,
  CardContent,
  Checkbox,
  Label,
]

interface ExportOption {
  id: string
  label: string
  description: string
  icon: Component
  color: string
}

interface StatusMessage {
  type: 'success' | 'error'
  text: string
}

const emit = defineEmits<{
  export: [section: string]
}>()

// State
const selectedOption = ref<string>('summary')
const isExporting = ref(false)
const statusMessage = ref<StatusMessage | null>(null)
const exportFormat = ref('csv')
const formats = ['csv', 'xlsx', 'json']
const startDate = ref('')
const endDate = ref('')
const includeData = ref({
  summary: true,
  products: true,
  geographic: true,
  affiliates: true,
  trends: true,
})

// Export options
const exportOptions: ExportOption[] = [
  {
    id: 'summary',
    label: 'Commercial Health',
    description: 'License & revenue overview',
    icon: BarChart3,
    color: '#3b82f6',
  },
  {
    id: 'revenue',
    label: 'Revenue Breakdown',
    description: 'Top 5 products revenue',
    icon: TrendingUp,
    color: '#10b981',
  },
  {
    id: 'geographic',
    label: 'Geographic Data',
    description: 'Revenue by country',
    icon: Globe,
    color: '#8b5cf6',
  },
  {
    id: 'affiliates',
    label: 'Affiliate Performance',
    description: 'Top performing affiliates',
    icon: Award,
    color: '#f59e0b',
  },
  {
    id: 'all',
    label: 'Full Report',
    description: 'All dashboard data combined',
    icon: Download,
    color: '#06b6d4',
  },
]

// Methods
const selectOption = (id: string) => {
  selectedOption.value = id
  statusMessage.value = null
}

const resetForm = () => {
  selectedOption.value = 'summary'
  exportFormat.value = 'csv'
  startDate.value = ''
  endDate.value = ''
  includeData.value = {
    summary: true,
    products: true,
    geographic: true,
    affiliates: true,
    trends: true,
  }
  statusMessage.value = null
}

const handleExport = async () => {
  try {
    // Validate date range if selected
    if (selectedOption.value === 'all' && startDate.value && endDate.value) {
      if (new Date(startDate.value) > new Date(endDate.value)) {
        statusMessage.value = {
          type: 'error',
          text: 'Start date must be before end date',
        }
        return
      }
    }

    isExporting.value = true
    statusMessage.value = null

    // Build export payload
    const exportPayload: Record<string, unknown> = {
      section: selectedOption.value,
      format: exportFormat.value,
    }

    if (selectedOption.value === 'all') {
      exportPayload.dateRange = {
        start: startDate.value,
        end: endDate.value,
      }
      exportPayload.includeData = includeData.value
    }

    // Emit export event
    emit('export', selectedOption.value)

    // Simulate export delay
    await new Promise((resolve) => setTimeout(resolve, 1500))

    statusMessage.value = {
      type: 'success',
      text: `Export completed! Your ${exportFormat.value.toUpperCase()} file is downloading...`,
    }

    // Reset form after 3 seconds
    setTimeout(() => {
      resetForm()
    }, 3000)
  } catch (error) {
    statusMessage.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'Export failed. Please try again.',
    }
  } finally {
    isExporting.value = false
  }
}

void [formats, exportOptions, selectOption, handleExport]
</script>

<style scoped>
.data-export {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.export-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.export-card {
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
  position: relative;
}

.export-card:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.export-card.selected {
  border-color: var(--primary);
  background-color: var(--primary-light, rgba(59, 130, 246, 0.05));
}

.export-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
  padding: 1.5rem;
}

.export-icon {
  width: 2rem;
  height: 2rem;
}

.export-details h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--foreground);
}

.export-details p {
  margin: 0;
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.selected-indicator {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background-color: var(--primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.options-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem;
  background-color: var(--muted);
  border-radius: 0.5rem;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.option-label {
  font-size: 0.875rem;
  font-weight: 600;
}

.date-inputs {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.date-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.date-separator {
  color: var(--muted-foreground);
  font-size: 0.875rem;
}

.checkboxes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.format-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-label {
  font-size: 0.875rem;
  font-weight: 600;
}

.format-buttons {
  display: flex;
  gap: 0.5rem;
}

.action-section {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.export-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 150px;
}

.status-message {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}

.status-message.success {
  background-color: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border: 1px solid #10b981;
}

.status-message.error {
  background-color: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid #ef4444;
}

.help-text {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: var(--muted);
  border-radius: 0.5rem;
  font-size: 0.75rem;
  color: var(--muted-foreground);
  line-height: 1.5;
}

.help-text strong {
  color: var(--foreground);
}
</style>
