import clsx from 'clsx'
import {
  Children,
  cloneElement,
  createElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react'

interface InViewOptions {
  once?: boolean
  threshold?: number
  rootMargin?: string
}

/** IntersectionObserver hook. Defaults: fire once, 15% visible, slight bottom inset. */
export function useInView<T extends Element = HTMLElement>(opts: InViewOptions = {}) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  const { once = true, threshold = 0.15, rootMargin = '0px 0px -8% 0px' } = opts

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) io.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold, rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [once, threshold, rootMargin])

  return { ref, inView }
}

interface RevealProps {
  as?: ElementType
  children?: ReactNode
  className?: string
  /** extra delay in ms */
  delay?: number
  /** stagger index (multiplied by `stagger`) */
  index?: number
  /** stagger step in ms (reference: 150) */
  stagger?: number
  once?: boolean
  threshold?: number
  style?: CSSProperties
  id?: string
  [key: string]: unknown
}

/**
 * Reference reveal: opacity 0 / translate 0 20px → visible over 1000ms, cubic-bezier(.22,1,.36,1).
 * <Reveal index={i}> staggers by 150ms per index.
 */
export function Reveal({
  as = 'div',
  children,
  className,
  delay = 0,
  index = 0,
  stagger = 150,
  once = true,
  threshold = 0.15,
  style,
  ...rest
}: RevealProps) {
  const { ref, inView } = useInView<HTMLElement>({ once, threshold })
  return createElement(
    as,
    {
      ref,
      className: clsx('reveal', inView && 'is-visible', className),
      style: {
        '--reveal-delay': `${delay}ms`,
        '--i': index,
        '--reveal-stagger': `${stagger}ms`,
        ...style,
      } as CSSProperties,
      ...rest,
    },
    children,
  )
}

interface RevealGroupProps {
  as?: ElementType
  children?: ReactNode
  className?: string
  style?: CSSProperties
  delay?: number
  stagger?: number
  threshold?: number
  once?: boolean
  [key: string]: unknown
}

/**
 * Reveals each direct child with a stagger by cloning the `reveal` class + `--i` onto it.
 * Children must be DOM elements or components that forward className/style.
 */
export function RevealGroup({
  as = 'div',
  children,
  className,
  style,
  delay = 0,
  stagger = 150,
  threshold = 0.15,
  once = true,
  ...rest
}: RevealGroupProps) {
  const { ref, inView } = useInView<HTMLElement>({ once, threshold })
  let i = 0
  const kids = Children.map(children, (child) => {
    if (!isValidElement<{ className?: string; style?: CSSProperties }>(child)) return child
    const idx = i++
    return cloneElement(child, {
      className: clsx(child.props.className, 'reveal', inView && 'is-visible'),
      style: {
        ...(child.props.style ?? {}),
        '--i': idx,
        '--reveal-delay': `${delay}ms`,
        '--reveal-stagger': `${stagger}ms`,
      } as CSSProperties,
    })
  })
  return createElement(as, { ref, className, style, ...rest }, kids)
}
