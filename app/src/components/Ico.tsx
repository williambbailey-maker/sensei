// Single inline-SVG icon component. Per the spec pitfall, we do NOT use
// lucide-react (it has caused blank-screen failures in this stack). Add new
// glyphs here as needed.
type Name =
  | 'search'
  | 'arrow'
  | 'close'
  | 'check'
  | 'mail'
  | 'external'
  | 'spark'
  | 'back'
  | 'chevron'

const PATHS: Record<Name, React.ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 18l-6-6 6-6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  external: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </>
  ),
  spark: <path d="M12 3v5m0 8v5M3 12h5m8 0h5M6.3 6.3l2.4 2.4m6.6 6.6 2.4 2.4m0-11.4-2.4 2.4M8.7 15.3l-2.4 2.4" />,
  chevron: <path d="m6 9 6 6 6-6" />,
}

export function Ico({
  name,
  className = 'h-5 w-5',
  strokeWidth = 2,
}: {
  name: Name
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
