// Portal-only <Environment> (drei 10.7.8 EnvironmentPortal semantics for children + frames, no files/preset/map/ground),
// so useEnvironment's HDR/EXR/gain-map loaders never enter the bundle.
import * as React from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { HalfFloatType, Scene, WebGLCubeRenderTarget } from 'three'

export function Environment({ children, near = 0.1, far = 1000, resolution = 256, frames = 1 }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = React.useRef(null)
  const [virtualScene] = React.useState(() => new Scene())
  const fbo = React.useMemo(() => {
    const target = new WebGLCubeRenderTarget(resolution)
    target.texture.type = HalfFloatType
    return target
  }, [resolution])
  React.useEffect(() => () => fbo.dispose(), [fbo])
  React.useLayoutEffect(() => {
    if (frames === 1) {
      const autoClear = gl.autoClear
      gl.autoClear = true
      camera.current.update(gl, virtualScene)
      gl.autoClear = autoClear
    }
    const previous = scene.environment
    scene.environment = fbo.texture
    return () => {
      scene.environment = previous
    }
  }, [children, virtualScene, fbo, scene, frames, gl])
  const count = React.useRef(1)
  useFrame(() => {
    if (frames === Infinity || count.current < frames) {
      const autoClear = gl.autoClear
      gl.autoClear = true
      camera.current.update(gl, virtualScene)
      gl.autoClear = autoClear
      count.current++
    }
  })
  return createPortal(
    React.createElement(React.Fragment, null, children, React.createElement('cubeCamera', { ref: camera, args: [near, far, fbo] })),
    virtualScene,
  )
}
export const EnvironmentPortal = Environment
export const EnvironmentCube = () => null
export const EnvironmentMap = () => null
