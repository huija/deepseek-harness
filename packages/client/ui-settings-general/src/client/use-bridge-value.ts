/** One-shot Desktop bridge load whose slow read never clobbers a user edit. */
import { useEffect, useRef } from 'react'

/** Optional carrier reader for one Desktop preference. */
interface BridgeReader<T> {
  get(): Promise<T>
}

/**
 * Read one Desktop preference once when its bridge appears. A read that
 * resolves after the user edited the value is dropped, and a failed read
 * reports through onFailure.
 * @param bridge - Optional carrier reader; absent on Web builds.
 * @param apply - Setter for the loaded value.
 * @param onFailure - Reports a failed read.
 * @returns The edit flag callers set on user input.
 */
export function useBridgeValue<T>(
  bridge: BridgeReader<T> | undefined,
  apply: (value: T) => void,
  onFailure: () => void,
): { current: boolean } {
  const edited = useRef(false)
  const reportFailure = useRef(onFailure)
  reportFailure.current = onFailure
  useEffect(() => {
    let live = true
    void bridge?.get().then((value) => {
      if (live && !edited.current) apply(value)
    }).catch(() => { if (live) reportFailure.current() })
    return () => { live = false }
  }, [bridge, apply])
  return edited
}
