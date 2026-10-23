// Screen history. Every in-app screen (and each borough-journey step) is a
// history entry numbered from the first page load, so a Back button can tell
// whether there is an earlier Sensei screen to return to or whether it should
// fall back to somewhere sensible instead of leaving the site.
export type Screen = { view: string; way: string | null; step?: number }

function depth(): number {
  try {
    const i = history.state?.i
    return typeof i === 'number' ? i : 0
  } catch {
    return 0
  }
}

export function pushScreen(s: Screen) {
  try {
    history.pushState({ ...s, i: depth() + 1 }, '')
  } catch {
    /* history unavailable */
  }
}

export function replaceScreen(s: Screen) {
  try {
    history.replaceState({ ...s, i: depth() }, '')
  } catch {
    /* history unavailable */
  }
}

export const canGoBack = () => depth() > 0
