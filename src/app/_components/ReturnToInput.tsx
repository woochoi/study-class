'use client'

import { usePathname, useSearchParams } from 'next/navigation'

export default function ReturnToInput() {
  const pathname = usePathname()
  const query = useSearchParams().toString()
  return <input type="hidden" name="returnTo" value={pathname + (query ? '?' + query : '')} />
}
