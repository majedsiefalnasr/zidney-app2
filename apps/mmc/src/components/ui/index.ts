// Stub UI components — minimal wrappers used by dashboard views
// Full implementation delegates to @zidney/ui in production
import { defineComponent, h } from 'vue'

const pass = (name: string) =>
  defineComponent({
    name,
    setup(_props, { slots }) {
      return () => h('div', {}, slots.default?.())
    },
  })

export const Alert = pass('Alert')
export const AlertDescription = pass('AlertDescription')
export const AlertTitle = pass('AlertTitle')
export const Button = pass('Button')
export const Card = pass('Card')
export const CardContent = pass('CardContent')
export const CardDescription = pass('CardDescription')
export const CardHeader = pass('CardHeader')
export const CardTitle = pass('CardTitle')
export const Skeleton = pass('Skeleton')
