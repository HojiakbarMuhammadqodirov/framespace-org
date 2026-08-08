import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { BackIcon } from '../components/Icons.jsx'
import { buildEquirect } from '../lib/equirect.js'

// Look around the redesigned room: drag with a finger, pinch to zoom, or hand
// control to the phone's gyroscope and physically turn on the spot.

const MIN_FOV = 40
const MAX_FOV = 92

export default function Panorama({ renders, onBack }) {
  const mountRef = useRef(null)
  const stateRef = useRef({ lon: 0, lat: 0, fov: 75, gyro: false })
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [message, setMessage] = useState('')
  const [gyro, setGyro] = useState(false)
  const gyroApiRef = useRef(null)

  useEffect(() => {
    let disposed = false
    const mount = mountRef.current
    if (!mount || !renders.length) {
      setStatus('error')
      setMessage('There are no renders to show in 3D yet.')
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      stateRef.current.fov,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1100
    )
    camera.position.set(0, 0, 0.01)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    // A sphere turned inside out, with the panorama on the inside face.
    const geometry = new THREE.SphereGeometry(500, 64, 40)
    geometry.scale(-1, 1, 1)
    let mesh = null
    let texture = null

    // --- input ---------------------------------------------------------------
    let dragging = false
    let pointerX = 0
    let pointerY = 0
    let startLon = 0
    let startLat = 0
    let pinchStart = 0

    const el = renderer.domElement
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

    function onDown(e) {
      if (stateRef.current.gyro) return
      dragging = true
      const p = e.touches ? e.touches[0] : e
      pointerX = p.clientX
      pointerY = p.clientY
      startLon = stateRef.current.lon
      startLat = stateRef.current.lat
    }

    function onMove(e) {
      if (e.touches && e.touches.length === 2) {
        e.preventDefault()
        const d = dist(e.touches)
        if (!pinchStart) pinchStart = d
        const next = stateRef.current.fov * (pinchStart / d)
        stateRef.current.fov = THREE.MathUtils.clamp(next, MIN_FOV, MAX_FOV)
        pinchStart = d
        return
      }
      if (!dragging || stateRef.current.gyro) return
      e.preventDefault()
      const p = e.touches ? e.touches[0] : e
      // Scale by fov so the drag feels the same when zoomed in.
      const k = stateRef.current.fov / 75
      stateRef.current.lon = startLon - (p.clientX - pointerX) * 0.13 * k
      stateRef.current.lat = THREE.MathUtils.clamp(
        startLat + (p.clientY - pointerY) * 0.13 * k,
        -78,
        78
      )
    }

    function onUp() {
      dragging = false
      pinchStart = 0
    }

    function onWheel(e) {
      e.preventDefault()
      stateRef.current.fov = THREE.MathUtils.clamp(
        stateRef.current.fov + e.deltaY * 0.05,
        MIN_FOV,
        MAX_FOV
      )
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    el.addEventListener('touchstart', onDown, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })

    // --- gyroscope -----------------------------------------------------------
    const zee = new THREE.Vector3(0, 0, 1)
    const euler = new THREE.Euler()
    const q0 = new THREE.Quaternion()
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5))
    let orientation = null

    function onOrientation(event) {
      if (event.alpha == null) return
      orientation = event
    }

    function applyOrientation() {
      if (!orientation) return
      const alpha = THREE.MathUtils.degToRad(orientation.alpha)
      const beta = THREE.MathUtils.degToRad(orientation.beta)
      const gamma = THREE.MathUtils.degToRad(orientation.gamma)
      const screenAngle = THREE.MathUtils.degToRad(window.screen?.orientation?.angle || 0)
      euler.set(beta, alpha, -gamma, 'YXZ')
      camera.quaternion.setFromEuler(euler)
      camera.quaternion.multiply(q1)
      camera.quaternion.multiply(q0.setFromAxisAngle(zee, -screenAngle))
    }

    gyroApiRef.current = {
      async enable() {
        const DOE = window.DeviceOrientationEvent
        if (!DOE) throw new Error('This device has no orientation sensor.')
        if (typeof DOE.requestPermission === 'function') {
          const granted = await DOE.requestPermission()
          if (granted !== 'granted') throw new Error('Motion access was declined.')
        }
        window.addEventListener('deviceorientation', onOrientation, true)
        stateRef.current.gyro = true
      },
      disable() {
        window.removeEventListener('deviceorientation', onOrientation, true)
        stateRef.current.gyro = false
        orientation = null
      },
    }

    // --- loop ----------------------------------------------------------------
    let frame = 0
    function animate() {
      frame = requestAnimationFrame(animate)
      const s = stateRef.current

      if (s.gyro) {
        applyOrientation()
      } else {
        const phi = THREE.MathUtils.degToRad(90 - s.lat)
        const theta = THREE.MathUtils.degToRad(s.lon)
        camera.lookAt(
          500 * Math.sin(phi) * Math.cos(theta),
          500 * Math.cos(phi),
          500 * Math.sin(phi) * Math.sin(theta)
        )
      }

      if (Math.abs(camera.fov - s.fov) > 0.01) {
        camera.fov = s.fov
        camera.updateProjectionMatrix()
      }
      renderer.render(scene, camera)
    }

    function onResize() {
      if (!mount.clientWidth) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    buildEquirect(renders)
      .then((panoCanvas) => {
        if (disposed) return
        texture = new THREE.CanvasTexture(panoCanvas)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearFilter
        mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }))
        scene.add(mesh)
        setStatus('ready')
        animate()
      })
      .catch((err) => {
        if (disposed) return
        setStatus('error')
        setMessage(err.message)
      })

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      gyroApiRef.current?.disable()
      gyroApiRef.current = null
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('touchstart', onDown)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onUp)
      el.removeEventListener('wheel', onWheel)
      texture?.dispose()
      mesh?.material?.dispose()
      geometry.dispose()
      renderer.dispose()
      if (el.parentNode === mount) mount.removeChild(el)
    }
  }, [renders])

  async function toggleGyro() {
    try {
      if (gyro) {
        gyroApiRef.current?.disable()
        setGyro(false)
      } else {
        await gyroApiRef.current?.enable()
        setGyro(true)
      }
      setMessage('')
    } catch (err) {
      setMessage(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink">
      <div ref={mountRef} className="absolute inset-0 touch-none" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="shimmer h-2 w-40 rounded-full" />
          <p className="text-[13px] text-muted">Stitching your room into a sphere…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <p className="display text-[22px]">3D view unavailable</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{message}</p>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to the renders"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-ink/70 backdrop-blur-md"
        >
          <BackIcon />
        </button>
        <button
          type="button"
          onClick={toggleGyro}
          className={`pointer-events-auto rounded-full border px-4 py-2.5 text-[12.5px] font-semibold backdrop-blur-md ${
            gyro ? 'border-clay bg-clay text-white' : 'border-line bg-ink/70 text-cream'
          }`}
        >
          {gyro ? 'Gyro on' : 'Use gyroscope'}
        </button>
      </div>

      {status === 'ready' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pb-[calc(env(safe-area-inset-bottom)+22px)] text-center">
          {message ? (
            <p className="text-[12.5px] text-clay-soft">{message}</p>
          ) : (
            <p className="text-[12px] text-muted">
              {gyro ? 'Turn on the spot to look around.' : 'Drag to look around · pinch to zoom'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
