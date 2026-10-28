"""
Shared helpers for Floor Zero's Blender build scripts: lofts, lathes, materials, export.

Run scripts headless, never in the shared live Blender session (doc 09):
  blender --background --factory-startup --python tools/blender/<script>.py -- [--preview out.png]

Materials are named for MaterialLibrary keys (src/world/materials.ts). The game swaps in its own
material by name, so the colours here only matter for preview renders.
"""
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

PREVIEW_COLORS = {
    'tier': (0.75, 0.42, 0.25),
    'wood': (0.55, 0.38, 0.22),
    'wood_dark': (0.25, 0.16, 0.1),
    'leather': (0.2, 0.13, 0.08),
    'metal': (0.35, 0.36, 0.38),
    'rust': (0.35, 0.2, 0.12),
    'bronze': (0.45, 0.4, 0.22),
    'canvas': (0.7, 0.63, 0.5),
    'core': (0.7, 0.95, 1.0),
    'lamp': (1.0, 0.8, 0.5),
    'rock': (0.4, 0.38, 0.35),
    'ore_copper': (0.8, 0.45, 0.25),
    'ore_iron': (0.6, 0.6, 0.62),
    'ore_cobalt': (0.2, 0.35, 0.85),
}


def args():
    """Arguments after `--` on the Blender command line."""
    return sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def option(name, default=None):
    a = args()
    return a[a.index(name) + 1] if name in a else default


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        c = PREVIEW_COLORS.get(name, (0.5, 0.5, 0.5))
        m.diffuse_color = (*c, 1.0)
    return m


def empty(name, parent=None, location=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.05
    e.location = location
    bpy.context.collection.objects.link(e)
    if parent is not None:
        e.parent = parent
    return e


def mesh_object(name, bm, mat, parent=None, smooth=40.0, bevel=0.0, subdiv=0):
    """Turns a bmesh into an object with one material, smooth shading split at `smooth` degrees."""
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(obj)
    me.materials.append(material(mat))
    if smooth is not None:
        for p in me.polygons:
            p.use_smooth = True
        try:
            me.set_sharp_from_angle(angle=math.radians(smooth))
        except (AttributeError, TypeError):
            pass
    if bevel > 0:
        m = obj.modifiers.new('bevel', 'BEVEL')
        m.width = bevel
        m.segments = 2
        m.limit_method = 'ANGLE'
        m.angle_limit = math.radians(40)
    if subdiv > 0:
        m = obj.modifiers.new('subdivide', 'SUBSURF')
        m.levels = subdiv
        m.render_levels = subdiv
    if parent is not None:
        obj.parent = parent
    return obj


def section(w, h, n=12, square=0.6):
    """A rounded rectangle (superellipse) of half-sizes w by h, as 2D points."""
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        c, s = math.cos(a), math.sin(a)
        pts.append((w * math.copysign(abs(c) ** square, c), h * math.copysign(abs(s) ** square, s)))
    return pts


def ring(center, u, v, pts):
    return [Vector(center) + Vector(u) * x + Vector(v) * y for x, y in pts]


def loft(rings, cap_start=True, cap_end=True, closed=False):
    """Skins rings of equal vertex count into a tube. `closed` joins the last ring to the first."""
    bm = bmesh.new()
    vr = [[bm.verts.new(p) for p in r] for r in rings]
    n = len(rings[0])
    pairs = list(zip(vr, vr[1:]))
    if closed:
        pairs.append((vr[-1], vr[0]))
    for a, b in pairs:
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap_start and not closed:
        bm.faces.new(list(reversed(vr[0])))
    if cap_end and not closed:
        bm.faces.new(vr[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def path_loft(points, sizes, shape=lambda w, h: section(w, h), up=(0, 1, 0), cap_start=True, cap_end=True):
    """Lofts a section along a polyline. `sizes` gives (w, h) per point; w runs along `up`."""
    rings = []
    up = Vector(up).normalized()
    for i, p in enumerate(points):
        p = Vector(p)
        a = Vector(points[max(0, i - 1)])
        b = Vector(points[min(len(points) - 1, i + 1)])
        t = (b - a).normalized()
        side = up - t * up.dot(t)
        side.normalize()
        other = t.cross(side).normalized()
        w, h = sizes[i]
        rings.append(ring(p, side, other, shape(w, h)))
    return loft(rings, cap_start, cap_end)


def lathe(profile, axis='Z', steps=24):
    """Spins (radius, height) pairs round an axis into a closed solid of revolution."""
    rings = []
    for r, h in profile:
        pts = []
        for k in range(steps):
            a = 2 * math.pi * k / steps
            x, y = math.cos(a) * r, math.sin(a) * r
            pts.append(Vector((x, y, h)) if axis == 'Z' else Vector((x, h, y)) if axis == 'Y' else Vector((h, x, y)))
        rings.append(pts)
    return loft(rings)


def box(size, center=(0, 0, 0), rotation=None):
    bm = bmesh.new()
    m = Matrix.Translation(Vector(center))
    if rotation is not None:
        m = m @ rotation.to_matrix().to_4x4()
    m = m @ Matrix.Diagonal(Vector((size[0], size[1], size[2], 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    return bm


def cylinder(radius, depth, center=(0, 0, 0), rotation=None, segments=16, radius_top=None):
    bm = bmesh.new()
    m = Matrix.Translation(Vector(center))
    if rotation is not None:
        m = m @ rotation.to_matrix().to_4x4()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius,
                          radius2=radius if radius_top is None else radius_top, depth=depth, matrix=m)
    return bm


def torus(major, minor, center=(0, 0, 0), rotation=None, segments=24, sides=8, arc=2 * math.pi, start=0.0):
    """A torus (or an arc of one) round the local Z axis, built as a closed loft."""
    rings = []
    count = segments if arc >= 2 * math.pi - 1e-6 else segments + 1
    rot = rotation.to_matrix() if rotation is not None else Matrix.Identity(3)
    for k in range(count):
        a = start + arc * k / segments
        c = Vector((math.cos(a) * major, math.sin(a) * major, 0))
        radial = Vector((math.cos(a), math.sin(a), 0))
        pts = []
        for j in range(sides):
            b = 2 * math.pi * j / sides
            pts.append(Vector(center) + rot @ (c + radial * math.cos(b) * minor + Vector((0, 0, 1)) * math.sin(b) * minor))
        rings.append(pts)
    return loft(rings, closed=arc >= 2 * math.pi - 1e-6)


def tri_count():
    deps = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        me = obj.evaluated_get(deps).to_mesh()
        me.calc_loop_triangles()
        total += len(me.loop_triangles)
        obj.evaluated_get(deps).to_mesh_clear()
    return total


def export(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True,
                              export_lights=False, export_cameras=False)


def preview(path, roots, cols=3, spacing=0.9, distance=2.4, elevation=0.35, look=(0, 0, 0.25)):
    """Lays the roots out in a grid and renders them with the Workbench engine, for checking shapes."""
    for i, root in enumerate(roots):
        root.location = ((i % cols) * spacing - (cols - 1) * spacing / 2, 0, -(i // cols) * spacing)
    rows = (len(roots) + cols - 1) // cols
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_cavity = True
    scene.display.shading.show_shadows = True
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 900
    scene.render.film_transparent = False
    cam_data = bpy.data.cameras.new('preview')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = max(cols * spacing, rows * spacing * 1.55) * 1.05
    cam = bpy.data.objects.new('preview', cam_data)
    bpy.context.collection.objects.link(cam)
    centre = Vector((look[0], look[1], look[2] - (rows - 1) * spacing / 2))
    cam.location = centre + Vector((0.0, -distance, distance * elevation))
    direction = centre - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    for root in roots:
        root.location = (0, 0, 0)
