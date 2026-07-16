// Browser API type extensions for APIs not fully typed in TypeScript DOM lib

interface Navigator {
  wakeLock?: WakeLockSentinel extends object ? {
    request(type: "screen"): Promise<WakeLockSentinel>
  } : never
}

interface WakeLockSentinel extends EventTarget {
  released: boolean
  type: "screen"
  release(): Promise<void>
  onrelease: ((this: WakeLockSentinel, ev: Event) => unknown) | null
}

// Ensure WakeLock is available on navigator
interface Navigator {
  wakeLock: {
    request(type: "screen"): Promise<WakeLockSentinel>
  }
}
