# shadcn-vue Component Reference

Complete catalog of shadcn-vue components with usage patterns and installation (Vue 3 + Reka UI).

## Installation

**Add specific components:**
```bash
pnpm dlx shadcn-vue@latest add button
pnpm dlx shadcn-vue@latest add button card dialog  # Multiple
```

Components install to `components/ui/` as `.vue` files with automatic dependency management.

## Configuration (`components.json`)

```json
{
  "$schema": "https://shadcn-vue.com/schema.json",
  "style": "new-york",
  "typescript": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "composables": "@/composables",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib"
  },
  "iconLibrary": "lucide"
}
```

## Form & Input Components

### Button
```vue
<script setup lang="ts">
import { Button } from "@/components/ui/button"
</script>

<template>
  <Button variant="default">Default</Button>
  <Button variant="destructive">Delete</Button>
  <Button variant="outline" size="sm">Small Outline</Button>
  <Button variant="ghost" size="icon"><Icon /></Button>
  <Button variant="link">Link Style</Button>
</template>
```

Variants: `default | destructive | outline | secondary | ghost | link`
Sizes: `default | sm | lg | icon`

### Input
```vue
<script setup lang="ts">
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
</script>

<template>
  <div class="space-y-2">
    <Label for="email">Email</Label>
    <Input id="email" type="email" placeholder="you@example.com" />
  </div>
</template>
```

### Form (with vee-validate + Zod)
```vue
<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import * as z from 'zod'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const schema = toTypedSchema(z.object({
  username: z.string().min(2).max(50),
  email: z.string().email()
}))

const { handleSubmit } = useForm({ validationSchema: schema })
const onSubmit = handleSubmit((values) => console.log(values))
</script>

<template>
  <form @submit="onSubmit" class="space-y-8">
    <FormField v-slot="{ componentField }" name="username">
      <FormItem>
        <FormLabel>Username</FormLabel>
        <FormControl>
          <Input placeholder="shadcn" v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <FormField v-slot="{ componentField }" name="email">
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl>
          <Input type="email" v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <Button type="submit">Submit</Button>
  </form>
</template>
```

### Select
```vue
<script setup lang="ts">
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from "@/components/ui/select"
</script>

<template>
  <Select>
    <SelectTrigger class="w-[180px]">
      <SelectValue placeholder="Theme" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="light">Light</SelectItem>
      <SelectItem value="dark">Dark</SelectItem>
      <SelectItem value="system">System</SelectItem>
    </SelectContent>
  </Select>
</template>
```

### Checkbox
```vue
<script setup lang="ts">
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
</script>

<template>
  <div class="flex items-center space-x-2">
    <Checkbox id="terms" />
    <Label for="terms">Accept terms</Label>
  </div>
</template>
```

### Radio Group
```vue
<script setup lang="ts">
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
</script>

<template>
  <RadioGroup default-value="option-one">
    <div class="flex items-center space-x-2">
      <RadioGroupItem value="option-one" id="option-one" />
      <Label for="option-one">Option One</Label>
    </div>
    <div class="flex items-center space-x-2">
      <RadioGroupItem value="option-two" id="option-two" />
      <Label for="option-two">Option Two</Label>
    </div>
  </RadioGroup>
</template>
```

### Textarea
```vue
<script setup lang="ts">
import { Textarea } from "@/components/ui/textarea"
</script>

<template>
  <Textarea placeholder="Type your message here." />
</template>
```

### Switch
```vue
<script setup lang="ts">
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
</script>

<template>
  <div class="flex items-center space-x-2">
    <Switch id="airplane-mode" />
    <Label for="airplane-mode">Airplane Mode</Label>
  </div>
</template>
```

### Date Picker
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { CalendarDate } from '@internationalized/date'
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

const date = ref<CalendarDate | undefined>()
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="outline">
        <CalendarIcon class="mr-2 h-4 w-4" />
        {{ date ? date.toString() : 'Pick a date' }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0">
      <Calendar v-model="date" />
    </PopoverContent>
  </Popover>
</template>
```

## Layout & Navigation

### Card
```vue
<script setup lang="ts">
import {
  Card, CardContent, CardDescription,
  CardFooter, CardHeader, CardTitle
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Card Title</CardTitle>
      <CardDescription>Card Description</CardDescription>
    </CardHeader>
    <CardContent>
      <p>Card Content</p>
    </CardContent>
    <CardFooter>
      <Button>Action</Button>
    </CardFooter>
  </Card>
</template>
```

### Tabs
```vue
<script setup lang="ts">
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
</script>

<template>
  <Tabs default-value="account">
    <TabsList>
      <TabsTrigger value="account">Account</TabsTrigger>
      <TabsTrigger value="password">Password</TabsTrigger>
    </TabsList>
    <TabsContent value="account">Account settings</TabsContent>
    <TabsContent value="password">Password settings</TabsContent>
  </Tabs>
</template>
```

### Accordion
```vue
<script setup lang="ts">
import {
  Accordion, AccordionContent,
  AccordionItem, AccordionTrigger
} from "@/components/ui/accordion"
</script>

<template>
  <Accordion type="single" collapsible>
    <AccordionItem value="item-1">
      <AccordionTrigger>Is it accessible?</AccordionTrigger>
      <AccordionContent>
        Yes. It adheres to WAI-ARIA design pattern.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="item-2">
      <AccordionTrigger>Is it styled?</AccordionTrigger>
      <AccordionContent>
        Yes. Comes with default styles customizable with Tailwind.
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</template>
```

### Navigation Menu
```vue
<script setup lang="ts">
import {
  NavigationMenu, NavigationMenuContent,
  NavigationMenuItem, NavigationMenuLink,
  NavigationMenuList, NavigationMenuTrigger
} from "@/components/ui/navigation-menu"
</script>

<template>
  <NavigationMenu>
    <NavigationMenuList>
      <NavigationMenuItem>
        <NavigationMenuTrigger>Getting Started</NavigationMenuTrigger>
        <NavigationMenuContent>
          <NavigationMenuLink>Introduction</NavigationMenuLink>
          <NavigationMenuLink>Installation</NavigationMenuLink>
        </NavigationMenuContent>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
</template>
```

## Overlays & Dialogs

### Dialog
```vue
<script setup lang="ts">
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
</script>

<template>
  <Dialog>
    <DialogTrigger as-child>
      <Button>Open</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Are you sure?</DialogTitle>
        <DialogDescription>This action cannot be undone.</DialogDescription>
      </DialogHeader>
    </DialogContent>
  </Dialog>
</template>
```

### Drawer
```vue
<script setup lang="ts">
import {
  Drawer, DrawerClose, DrawerContent, DrawerDescription,
  DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
</script>

<template>
  <Drawer>
    <DrawerTrigger>Open</DrawerTrigger>
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Title</DrawerTitle>
        <DrawerDescription>Description</DrawerDescription>
      </DrawerHeader>
      <DrawerFooter>
        <Button>Submit</Button>
        <DrawerClose>Cancel</DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
</template>
```

### Popover
```vue
<script setup lang="ts">
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
</script>

<template>
  <Popover>
    <PopoverTrigger>Open</PopoverTrigger>
    <PopoverContent>Content here</PopoverContent>
  </Popover>
</template>
```

### Toast
```vue
<script setup lang="ts">
import { useToast } from "@/components/ui/toast/use-toast"
import { Button } from "@/components/ui/button"

const { toast } = useToast()

function showToast() {
  toast({
    title: "Scheduled: Catch up",
    description: "Friday, February 10, 2023 at 5:57 PM"
  })
}
</script>

<template>
  <Button @click="showToast">Show Toast</Button>
</template>
```

### Command
```vue
<script setup lang="ts">
import {
  Command, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList
} from "@/components/ui/command"
</script>

<template>
  <Command>
    <CommandInput placeholder="Type a command or search..." />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup heading="Suggestions">
        <CommandItem>Calendar</CommandItem>
        <CommandItem>Search Emoji</CommandItem>
        <CommandItem>Calculator</CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
</template>
```

### Alert Dialog
```vue
<script setup lang="ts">
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
</script>

<template>
  <AlertDialog>
    <AlertDialogTrigger as-child>
      <Button variant="destructive">Delete</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Absolutely sure?</AlertDialogTitle>
        <AlertDialogDescription>
          This permanently deletes your account and removes data from servers.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction>Continue</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
```

## Feedback & Status

### Alert
```vue
<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
</script>

<template>
  <Alert>
    <AlertTitle>Heads up!</AlertTitle>
    <AlertDescription>You can add components using CLI.</AlertDescription>
  </Alert>

  <Alert variant="destructive">
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>Session expired. Please log in.</AlertDescription>
  </Alert>
</template>
```

### Progress
```vue
<script setup lang="ts">
import { Progress } from "@/components/ui/progress"
</script>

<template>
  <Progress :value="33" />
</template>
```

### Skeleton
```vue
<script setup lang="ts">
import { Skeleton } from "@/components/ui/skeleton"
</script>

<template>
  <div class="flex items-center space-x-4">
    <Skeleton class="h-12 w-12 rounded-full" />
    <div class="space-y-2">
      <Skeleton class="h-4 w-[250px]" />
      <Skeleton class="h-4 w-[200px]" />
    </div>
  </div>
</template>
```

## Display Components

### Table
```vue
<script setup lang="ts">
import {
  Table, TableBody, TableCaption, TableCell,
  TableHead, TableHeader, TableRow
} from "@/components/ui/table"
</script>

<template>
  <Table>
    <TableCaption>Recent invoices</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Invoice</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Amount</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>INV001</TableCell>
        <TableCell>Paid</TableCell>
        <TableCell>$250.00</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>
```

### Avatar
```vue
<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
</script>

<template>
  <Avatar>
    <AvatarImage src="https://github.com/shadcn.png" />
    <AvatarFallback>CN</AvatarFallback>
  </Avatar>
</template>
```

### Badge
```vue
<script setup lang="ts">
import { Badge } from "@/components/ui/badge"
</script>

<template>
  <Badge>Default</Badge>
  <Badge variant="secondary">Secondary</Badge>
  <Badge variant="destructive">Destructive</Badge>
  <Badge variant="outline">Outline</Badge>
</template>
```
