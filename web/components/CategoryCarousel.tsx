import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Check, Layers, Globe, Trophy, Landmark, Cpu, Coins, Flame, Sparkles } from 'lucide-react'
import { MarketResponse } from '../gen/api'

interface Category {
  id: number
  name: string
}

interface CategoryCarouselProps {
  categories: Category[]
  selectedCategoryId: number | null
  onSelect: (id: number | null) => void
  markets?: MarketResponse[]
}

const ICON_MAP: Record<string, React.ElementType> = {
  crypto: Coins,
  politics: Landmark,
  sports: Trophy,
  tech: Cpu,
  world: Globe,
  trending: Flame,
  default: Sparkles,
}

function getIcon(name: string) {
  const key = Object.keys(ICON_MAP).find((k) => name.toLowerCase().includes(k))
  return key ? ICON_MAP[key] : ICON_MAP.default
}

const CategoryCarousel = ({ categories, selectedCategoryId, onSelect, markets = [] }: CategoryCarouselProps) => {
  const items: (Category & { isAll?: boolean })[] = useMemo(
    () => [{ id: -1, name: 'All', isAll: true }, ...categories],
    [categories]
  )

  const [centerIndex, setCenterIndex] = useState(0)
  const autoSelectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-select the centered card after 2 seconds of no movement
  useEffect(() => {
    if (autoSelectTimer.current) clearTimeout(autoSelectTimer.current)
    autoSelectTimer.current = setTimeout(() => {
      const item = items[centerIndex]
      if (item) {
        const newId = item.isAll ? null : item.id
        onSelect(newId)
      }
    }, 1000)
    return () => {
      if (autoSelectTimer.current) clearTimeout(autoSelectTimer.current)
    }
  }, [centerIndex, items, onSelect])

  // Drag-to-spin state
  const dragRef = useRef<{ startX: number; dragging: boolean; accumulated: number; didDrag: boolean }>({
    startX: 0,
    dragging: false,
    accumulated: 0,
    didDrag: false,
  })
  const DRAG_THRESHOLD = 120 // px per card step

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, dragging: true, accumulated: 0, didDrag: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current
      if (!d.dragging) return
      const delta = d.startX - e.clientX
      const steps = Math.trunc((delta - d.accumulated) / DRAG_THRESHOLD)
      if (steps !== 0) {
        d.accumulated += steps * DRAG_THRESHOLD
        d.didDrag = true
        setCenterIndex((prev) => {
          let next = prev + steps
          while (next < 0) next += items.length
          return next % items.length
        })
      }
    },
    [items.length]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const wasDrag = dragRef.current.didDrag
      dragRef.current.dragging = false
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)

      if (!wasDrag) {
        // Find which card was clicked by checking the event target
        const target = document.elementFromPoint(e.clientX, e.clientY)
        const cardEl = (target as HTMLElement)?.closest('[data-card-index]') as HTMLElement | null
        if (cardEl) {
          const index = Number(cardEl.dataset.cardIndex)
          if (index === centerIndex) {
            const item = items[centerIndex]
            onSelect(item.isAll ? null : item.id === selectedCategoryId ? null : item.id)
          } else {
            setCenterIndex(index)
          }
        }
      }
    },
    [centerIndex, items, onSelect, selectedCategoryId]
  )

  const marketCounts = useMemo(() => {
    const counts: Record<number, number> = { [-1]: markets.length }
    categories.forEach((c) => {
      counts[c.id] = markets.filter((m) => m.categoryIds?.includes(c.id)).length
    })
    return counts
  }, [categories, markets])

  const rotate = useCallback(
    (dir: -1 | 1) => {
      setCenterIndex((prev) => {
        const next = prev + dir
        if (next < 0) return items.length - 1
        if (next >= items.length) return 0
        return next
      })
    },
    [items.length]
  )


  const RADIUS = 260
  const ANGLE_STEP = 35 // tile width ~160px, radius 260px → ~35° edge-to-edge
  const total = items.length

  return (
    <div className="relative flex items-center justify-center gap-4 mb-8 select-none">
      {/* Left chevron */}
      <button
        onClick={() => rotate(-1)}
        className="shrink-0 z-10 p-2 rounded-full bg-card border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-all duration-300 hover:shadow-[0_0_15px_hsl(var(--primary)/0.5)]"
      >
        <ChevronLeft size={20} />
      </button>

      {/* 3D stage */}
      <div
        className="relative w-full max-w-2xl overflow-hidden cursor-grab active:cursor-grabbing touch-none"
        style={{ perspective: '800px', height: '130px' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {items.map((item, i) => {
            // Compute shortest-path offset around the ring
            let offset = i - centerIndex
            if (offset > total / 2) offset -= total
            if (offset < -total / 2) offset += total

            const angle = offset * ANGLE_STEP
            const isCenter = offset === 0
            const isSelected = item.isAll ? selectedCategoryId === null : selectedCategoryId === item.id
            const absOffset = Math.abs(offset)
            const visible = absOffset <= 2

            if (!visible) return null

            const Icon = item.isAll ? Layers : getIcon(item.name)
            const count = marketCounts[item.id] ?? 0

            return (
              <div
                key={item.id}
                data-card-index={i}
                className="absolute cursor-pointer"
                style={{
                  width: '160px',
                  height: '100px',
                  transform: `rotateY(${angle}deg) translateZ(${RADIUS}px)`,
                  opacity: 1 - absOffset * 0.3,
                  transition: 'transform 1000ms ease-out, opacity 1000ms ease-out, box-shadow 300ms ease',
                  zIndex: 10 - absOffset,
                }}
              >
                <div
                  className={`
                    w-full h-full rounded-xl border p-3 flex flex-col items-center justify-center gap-1.5
                    transition-all duration-300 hover:shadow-[0_0_15px_hsl(var(--primary)/0.5)]
                    ${isCenter ? 'scale-110' : 'scale-90'}
                    ${isSelected && isCenter
                      ? 'border-primary bg-primary/10 shadow-[0_0_24px_hsl(var(--primary)/0.35)]'
                      : isCenter
                        ? 'border-primary/50 bg-card shadow-[0_0_16px_hsl(var(--primary)/0.15)]'
                        : 'border-border bg-card/80'
                    }
                  `}
                >
                  <div className="relative">
                    <Icon size={20} className={isSelected && isCenter ? 'text-primary' : 'text-muted-foreground'} />
                    {isSelected && isCenter && (
                      <Check
                        size={10}
                        className="absolute -top-1 -right-2 text-primary"
                      />
                    )}
                  </div>
                  <span className={`text-sm font-semibold leading-tight text-center ${isCenter ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {item.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {count} {count === 1 ? 'market' : 'markets'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right chevron */}
      <button
        onClick={() => rotate(1)}
        className="shrink-0 z-10 p-2 rounded-full bg-card border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-all duration-300 hover:shadow-[0_0_15px_hsl(var(--primary)/0.5)]"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}

export default CategoryCarousel
