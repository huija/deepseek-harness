/**
 * Desktop-shell notification bridge shared by client plugins.
 *
 * The Electron shell exposes a `dshDesktop.notify` carrier on the page global;
 * ordinary browsers never set it. Every caller supplies the same bilingual
 * copy pair and this module performs the language pick, so no plugin
 * re-implements the carrier contract or the language detection.
 */

/** Notification categories the General settings can toggle. */
export type DesktopNotificationCategory = 'approval' | 'question' | 'job' | 'subagent' | 'credential' | 'remote' | 'session' | 'plugin' | 'schedule' | 'goal'

/** One notice's copy in both shipped languages; the shell locale picks one. */
export interface DesktopNoticeCopy {
  readonly zh: string
  readonly en: string
}

/** One desktop notification before the shell's category switches apply. */
export interface DesktopNotice {
  readonly category: DesktopNotificationCategory
  readonly title: DesktopNoticeCopy
  readonly body: DesktopNoticeCopy
  /** Session the notice belongs to; a click jumps the workspace to it. */
  readonly sessionId?: string | undefined
}

/** Carrier the Electron preload installs; absent on plain web and in tests. */
interface DesktopNotifyCarrier {
  readonly protocolVersion: number
  notify?: (input: {
    category: DesktopNotificationCategory
    title: string
    body: string
    sessionId?: string
  }) => Promise<void>
}

/**
 * Deliver one desktop notification through the Electron shell when present.
 *
 * Delivery is best effort: a missing DOM (tests, SSR), a missing carrier, or a
 * failing IPC must never break the caller's feature flow.
 * @param notice - Category, bilingual copy, and the owning session when known.
 */
export function notifyDesktop(notice: DesktopNotice): void {
  try {
    const root = typeof document === 'undefined' ? undefined : document.documentElement
    const zh = root === undefined
      ? false
      : (root.lang || navigator.language || 'en').toLowerCase().startsWith('zh')
    const carrier = globalThis as typeof globalThis & { dshDesktop?: DesktopNotifyCarrier }
    void carrier.dshDesktop?.notify?.({
      category: notice.category,
      title: zh ? notice.title.zh : notice.title.en,
      body: zh ? notice.body.zh : notice.body.en,
      ...(notice.sessionId === undefined ? {} : { sessionId: notice.sessionId }),
    })
  } catch {
    // Notification delivery must never throw into the caller path.
  }
}
