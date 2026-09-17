import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import markUrl from '../../assets/logo-mark.glb?url'
import { cn } from '../../lib/cn'

interface Props {
    className?: string
    /** Slabs slide into the bracket one by one when the model loads */
    intro?: boolean
    /** How far (0–1) the mark follows the pointer */
    follow?: number
    /** Fraction of the canvas the model fills */
    fill?: number
    label?: string
    /** How far the slabs slide out on hover */
    spread?: number
    /** Extrusion multiplier: >1 makes the mark chunkier front-to-back */
    depth?: number
    /** Resting angle in radians */
    angle?: { x: number; y: number }
}

const SLABS = ['slab_top', 'slab_mid', 'slab_bottom']
const DEFAULT_ANGLE = { x: 0.3, y: -0.28 }

/**
 * The Layerto mark in 3D. Follows the pointer; on hover the three slabs
 * slide out of the bracket like drawers — the layers separating.
 */
export function LayerMark3D({
    className,
    intro = false,
    follow = 1,
    fill = 0.82,
    label = 'Layerto mark in 3D',
    spread = 1,
    depth = 1,
    angle = DEFAULT_ANGLE,
}: Props) {
    const ax = angle.x
    const ay = angle.y
    const hostRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const host = hostRef.current
        if (!host) return
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 0.85
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        host.appendChild(renderer.domElement)

        const scene = new THREE.Scene()
        const pmrem = new THREE.PMREMGenerator(renderer)
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
        // Lower reflections keep the reds deep instead of washing out to pink
        scene.environmentIntensity = 0.55

        const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100)
        let radius = 2

        // Key from upper-left casts soft shadows between the slabs and onto the bracket
        const key = new THREE.DirectionalLight(0xffffff, 2.2)
        key.position.set(-5, 8, 7)
        key.castShadow = true
        key.shadow.mapSize.set(1024, 1024)
        key.shadow.bias = -0.0004
        key.shadow.normalBias = 0.02
        key.shadow.radius = 6
        scene.add(key)
        // Cool fill from the right lifts the dark faces so edges read as volume
        const fillLight = new THREE.DirectionalLight(0xdfe6ff, 0.55)
        fillLight.position.set(6, 1, 4)
        scene.add(fillLight)
        scene.add(new THREE.HemisphereLight(0xffffff, 0x2a1212, 0.35))
        const rim = new THREE.PointLight(0xff2a2a, 10, 20)
        rim.position.set(-3, -1.5, 3)
        scene.add(rim)

        const pivot = new THREE.Group()
        scene.add(pivot)

        const slabs: { obj: THREE.Object3D; baseX: number; delay: number }[] = []
        let hover = 0
        let hoverTarget = 0
        let introStart = -1
        const pointer = { x: 0, y: 0 }
        const rot = { x: ax, y: ay }

        const fitCamera = () => {
            const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) / fill
            const aspectFix = camera.aspect < 1 ? 1 / camera.aspect : 1
            camera.position.set(0, 0, dist * aspectFix)
            camera.updateProjectionMatrix()
        }

        const loader = new GLTFLoader()
        loader.load(markUrl, (gltf) => {
            const model = gltf.scene
            model.scale.z = depth
            model.traverse((o) => {
                if (o instanceof THREE.Mesh) {
                    o.castShadow = true
                    o.receiveShadow = true
                }
            })
            const box = new THREE.Box3().setFromObject(model)
            model.position.sub(box.getCenter(new THREE.Vector3()))
            radius = box.getBoundingSphere(new THREE.Sphere()).radius
            const sc = key.shadow.camera
            sc.left = sc.bottom = -radius * 1.6
            sc.right = sc.top = radius * 1.6
            sc.near = 0.1
            sc.far = radius * 12
            sc.updateProjectionMatrix()
            key.target = pivot
            pivot.add(model)
            SLABS.forEach((name, i) => {
                const obj = model.getObjectByName(name)
                if (obj) slabs.push({ obj, baseX: obj.position.x, delay: i * 0.12 })
            })
            fitCamera()
            introStart = intro && !reduced ? clock.getElapsedTime() : -Infinity
            host.dataset.loaded = 'true'
        })

        const resize = () => {
            const { clientWidth: w, clientHeight: h } = host
            if (!w || !h) return
            renderer.setSize(w, h)
            camera.aspect = w / h
            fitCamera()
        }
        const ro = new ResizeObserver(resize)
        ro.observe(host)

        // Pause rendering while offscreen
        let visible = true
        const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
        io.observe(host)

        const onMove = (e: PointerEvent) => {
            pointer.x = (e.clientX / window.innerWidth) * 2 - 1
            pointer.y = (e.clientY / window.innerHeight) * 2 - 1
        }
        const onEnter = () => (hoverTarget = 1)
        const onLeave = () => (hoverTarget = 0)
        window.addEventListener('pointermove', onMove)
        host.addEventListener('pointerenter', onEnter)
        host.addEventListener('pointerleave', onLeave)
        host.addEventListener('focus', onEnter)
        host.addEventListener('blur', onLeave)

        const clock = new THREE.Clock()
        let raf = 0
        const tick = () => {
            raf = requestAnimationFrame(tick)
            if (!visible) return
            const t = clock.getElapsedTime()

            hover += (hoverTarget - hover) * 0.08
            rot.y += (ay + pointer.x * 0.4 * follow - rot.y) * 0.05
            rot.x += (ax + pointer.y * 0.22 * follow - rot.x) * 0.05
            pivot.rotation.set(rot.x, rot.y + (reduced ? 0 : Math.sin(t * 0.5) * 0.06), 0)
            pivot.position.y = reduced ? 0 : Math.sin(t * 0.9) * radius * 0.02

            slabs.forEach(({ obj, baseX, delay }, i) => {
                // hover: slide out, staggered top to bottom
                const p = THREE.MathUtils.clamp((hover - delay) / (1 - delay), 0, 1)
                const out = (1 - Math.pow(1 - p, 3)) * (0.7 + delay * 3) * spread
                // intro: slide in from the right, bottom slab first
                const k = THREE.MathUtils.clamp((t - introStart - 0.15 - (2 - i) * 0.18) / 0.9, 0, 1)
                const inOffset = introStart === -1 ? 6 : Math.pow(1 - k, 4) * 6
                obj.position.x = baseX + out + inOffset
                obj.visible = introStart !== -1
            })

            renderer.render(scene, camera)
        }
        tick()

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            io.disconnect()
            window.removeEventListener('pointermove', onMove)
            host.removeEventListener('pointerenter', onEnter)
            host.removeEventListener('pointerleave', onLeave)
            host.removeEventListener('focus', onEnter)
            host.removeEventListener('blur', onLeave)
            scene.traverse((o) => {
                if (o instanceof THREE.Mesh) {
                    o.geometry.dispose()
                    ;(Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose())
                }
            })
            pmrem.dispose()
            renderer.dispose()
            renderer.domElement.remove()
        }
    }, [intro, follow, fill, spread, depth, ax, ay])

    return (
        <div
            ref={hostRef}
            tabIndex={0}
            role="img"
            aria-label={label}
            className={cn(
                'relative cursor-pointer rounded-3xl opacity-0 transition duration-1000 ease-out-expo data-[loaded=true]:opacity-100 [&>canvas]:block [&>canvas]:size-full!',
                className,
            )}
        />
    )
}
