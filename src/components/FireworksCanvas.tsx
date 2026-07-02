import React, { useEffect, useRef } from 'react'

export const FireworksCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const handleTrigger = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Инициализируем размеры под текущее окно
      const width = window.innerWidth
      const height = window.innerHeight
      canvas.width = width
      canvas.height = height

      // Класс для взрывающейся частицы
      class Particle {
        x: number
        y: number
        vx: number
        vy: number
        alpha: number
        color: string
        gravity: number
        friction: number
        decay: number

        constructor(x: number, y: number, color: string) {
          this.x = x
          this.y = y
          const angle = Math.random() * Math.PI * 2
          const speed = Math.random() * 6 + 2
          this.vx = Math.cos(angle) * speed
          this.vy = Math.sin(angle) * speed
          this.alpha = 1
          this.color = color
          this.gravity = 0.08
          this.friction = 0.96
          this.decay = Math.random() * 0.015 + 0.008
        }

        draw(c: CanvasRenderingContext2D) {
          c.save()
          c.globalAlpha = this.alpha
          c.beginPath()
          c.arc(this.x, this.y, Math.random() * 2 + 1.5, 0, Math.PI * 2)
          c.fillStyle = this.color
          // Добавим красивое неоновое свечение частиц
          c.shadowBlur = 10
          c.shadowColor = this.color
          c.fill()
          c.restore()
        }

        update() {
          this.vx *= this.friction
          this.vy *= this.friction
          this.vy += this.gravity
          this.x += this.vx
          this.y += this.vy
          this.alpha -= this.decay
        }
      }

      // Класс для взлетающей ракеты
      class Rocket {
        x: number
        y: number
        tx: number
        ty: number
        vx: number
        vy: number
        color: string
        trail: { x: number; y: number }[]
        exploded: boolean

        constructor() {
          this.x = Math.random() * (width - 200) + 100
          this.y = height
          this.tx = Math.random() * (width - 200) + 100
          this.ty = Math.random() * (height * 0.4) + height * 0.1
          const angle = Math.atan2(this.ty - this.y, this.tx - this.x)
          const speed = Math.random() * 8 + 10
          this.vx = Math.cos(angle) * speed
          this.vy = Math.sin(angle) * speed
          const hues = [0, 45, 120, 200, 280, 330]
          const hue = hues[Math.floor(Math.random() * hues.length)]
          this.color = `hsl(${hue}, 100%, 60%)`
          this.trail = []
          this.exploded = false
        }

        draw(c: CanvasRenderingContext2D) {
          c.save()
          c.beginPath()
          c.arc(this.x, this.y, 3, 0, Math.PI * 2)
          c.fillStyle = this.color
          c.shadowBlur = 15
          c.shadowColor = this.color
          c.fill()
          
          // Искрящийся шлейф ракеты
          for (let i = 0; i < this.trail.length; i++) {
            const pt = this.trail[i]
            c.beginPath()
            c.arc(pt.x, pt.y, 1.5 * (i / this.trail.length), 0, Math.PI * 2)
            c.fillStyle = this.color
            c.globalAlpha = (i / this.trail.length) * 0.4
            c.fill()
          }
          c.restore()
        }

        update() {
          this.trail.push({ x: this.x, y: this.y })
          if (this.trail.length > 12) this.trail.shift()

          this.x += this.vx
          this.y += this.vy

          // При замедлении или достижении высоты запускаем взрыв
          if (this.vy >= 0 || this.y <= this.ty) {
            this.exploded = true
            const count = Math.floor(Math.random() * 50) + 60
            for (let i = 0; i < count; i++) {
              particles.push(new Particle(this.x, this.y, this.color))
            }
          }
        }
      }

      const rockets: Rocket[] = []
      const particles: Particle[] = []

      // Запуск 5 ракет с небольшим разбросом во времени
      let rocketLaunchCount = 0
      const launchRocket = () => {
        if (rocketLaunchCount < 6) {
          rockets.push(new Rocket())
          rocketLaunchCount++
          setTimeout(launchRocket, Math.random() * 300 + 150)
        }
      }
      launchRocket()

      let animationId: number
      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Ракеты
        for (let i = rockets.length - 1; i >= 0; i--) {
          const r = rockets[i]
          r.update()
          r.draw(ctx)
          if (r.exploded) {
            rockets.splice(i, 1)
          }
        }

        // Частицы
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]
          p.update()
          p.draw(ctx)
          if (p.alpha <= 0) {
            particles.splice(i, 1)
          }
        }

        if (rockets.length === 0 && particles.length === 0) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          return
        }

        animationId = requestAnimationFrame(animate)
      }

      animate()

      return () => {
        cancelAnimationFrame(animationId)
      }
    }

    window.addEventListener('trigger-fireworks', handleTrigger)
    return () => {
      window.removeEventListener('trigger-fireworks', handleTrigger)
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 999999,
        width: '100vw',
        height: '100vh'
      }}
    />
  )
}
