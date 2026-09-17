import { useEffect, useState } from 'react'

/**
 * 订阅一个媒体查询。
 * 详情区在宽屏是常驻第三栏，在窄屏是抽屉，用这个判断而不是纯 CSS，
 * 是为了窄屏收起时彻底不渲染，省掉大图和版本轨道的开销。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
