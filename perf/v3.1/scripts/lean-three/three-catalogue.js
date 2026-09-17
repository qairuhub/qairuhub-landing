// Only the THREE classes that r3f's <Canvas> must know as JSX intrinsics (extend(THREE)).
// App: mesh, group, points, directionalLight, hemisphereLight, meshPhysicalMaterial (+ primitive, built in).
// drei: Lightformer (mesh/planeGeometry/meshBasicMaterial), Environment portal (cubeCamera);
// MeshTransmissionMaterial registers itself with extend().
export { Mesh, Group, Points, DirectionalLight, HemisphereLight, MeshPhysicalMaterial, MeshBasicMaterial, PlaneGeometry, CubeCamera } from 'three'
