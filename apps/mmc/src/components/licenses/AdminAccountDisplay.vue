<script setup lang="ts">
/**
 * T090: Admin Account Display (Provisioning Credentials)
 */

import { Badge } from '@zidney/ui/components/shadcn-vue/badge'
import { Button } from '@zidney/ui/components/shadcn-vue/button'
import { Card, CardContent, CardHeader, CardTitle } from '@zidney/ui/components/shadcn-vue/card'
import { ref } from 'vue'

interface Props {
  licenseId: string
  adminEmail?: string
  adminCreatedAt?: string
}

const props = defineProps<Props>()

const showPassword = ref(false)
const copied = ref(false)

const copyToClipboard = async (text: string) => {
  // TODO: Copy to clipboard
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <Card class="bg-blue-50 border-blue-200">
    <CardHeader>
      <CardTitle class="text-base">Provisioned Admin Account</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div v-if="adminEmail" class="space-y-3">
        <div>
          <label class="block text-sm font-semibold mb-1">Admin Email</label>
          <div class="flex gap-2">
            <code class="bg-white px-3 py-2 rounded font-mono text-sm flex-1">
              {{ adminEmail }}
            </code>
            <Button
              variant="outline"
              size="sm"
              @click="copyToClipboard(adminEmail)"
            >
              {{ copied ? '✓' : 'Copy' }}
            </Button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-semibold mb-1"
            >Initial Password</label
          >
          <div class="flex gap-2">
            <input
              :type="showPassword ? 'text' : 'password'"
              value="••••••••••••"
              readonly
              class="bg-white px-3 py-2 rounded font-mono text-sm flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? 'Hide' : 'Show' }}
            </Button>
          </div>
          <p class="text-xs text-gray-600 mt-1">
            Share this with workspace admin. Must be changed on first login.
          </p>
        </div>

        <div>
          <p class="text-xs text-gray-600">
            Created: {{ new Date(adminCreatedAt!).toLocaleString() }}
          </p>
        </div>
      </div>

      <div v-else>
        <Badge variant="secondary">Not yet provisioned</Badge>
      </div>
    </CardContent>
  </Card>
</template>
