"""
The first-person tools and the gloved hand that holds them, exported to
public/assets/models/viewmodels.glb.

  blender --background --factory-startup --python tools/blender/viewmodels.py -- [--preview out.png]

Each tool is a root empty named for its Held kind in src/player/viewmodel.ts (pickaxe, blade, rod,
boltcaster, resonance), plus `hand`. Swung tools stand along +Z (glTF +Y); aimed tools point along
+Y (glTF -Z, into the screen). Every tool has a `<tool>_grip` empty where the hand goes; the hand
grips a handle running along its own Z axis. Parts named `tier` take the tool's metal tier.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bmesh  # noqa: E402
from mathutils import Euler, Vector  # noqa: E402

from common import (box, cylinder, empty, export, lathe, loft, mesh_object, option, path_loft, preview,  # noqa: E402
                    reset, ring, section, torus, tri_count)


def smooth(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def oval(r, squash=0.88, n=14):
    return section(r * squash, r, n, 1.0)


def strap(root, name, z0, z1, radius, pitch=0.013, width=0.0075, thick=0.0017, offset=(0, 0, 0)):
    """A leather strap wound in a helix round a handle along Z, each turn overlapping the last."""
    pts, sizes = [], []
    turns = (z1 - z0) / pitch
    steps = int(turns * 24)
    for i in range(steps + 1):
        t = i / steps
        a = t * turns * 2 * math.pi
        pts.append((offset[0] + math.cos(a) * radius, offset[1] + math.sin(a) * radius, offset[2] + z0 + (z1 - z0) * t))
        sizes.append((width, thick))
    return mesh_object(name, path_loft(pts, sizes, shape=lambda w, h: section(w, h, 8, 0.5), up=(0, 0, 1)), 'leather', root, smooth=80)


def pickaxe():
    root = empty('pickaxe')
    empty('pickaxe_grip', root)
    # Ash haft: oval, swelling to a knob at the butt and thickening toward the head.
    prof = [(-0.152, 0.011), (-0.148, 0.019), (-0.137, 0.0235), (-0.122, 0.0205), (-0.105, 0.0178), (0.1, 0.0172),
            (0.35, 0.0183), (0.52, 0.0202), (0.606, 0.0206), (0.612, 0.013)]
    rings = [ring((0, 0, z), (1, 0, 0), (0, 1, 0), oval(r)) for z, r in prof]
    mesh_object('pickaxe_haft', loft(rings), 'wood', root, smooth=60)
    strap(root, 'pickaxe_wrap', -0.11, 0.055, 0.0186)
    head_z = 0.565
    mesh_object('pickaxe_eye', box((0.064, 0.046, 0.076), (0, 0, head_z)), 'tier', root, smooth=30, bevel=0.005)
    mesh_object('pickaxe_wedge', box((0.008, 0.032, 0.008), (0, 0, head_z + 0.041)), 'metal', root, smooth=30, bevel=0.0015)
    mesh_object('pickaxe_collar', cylinder(0.0225, 0.012, (0, 0, head_z - 0.047), segments=18), 'metal', root, smooth=40, bevel=0.002)

    def arm(sign, length, droop, w0, h0, w1, h1, pw, ph):
        pts, sizes = [], []
        for i in range(21):
            t = i / 20
            pts.append((sign * (0.026 + length * t), 0, head_z - droop * t * t))
            sizes.append((w0 + (w1 - w0) * t ** pw, h0 + (h1 - h0) * t ** ph))
        return path_loft(pts, sizes, shape=lambda w, h: section(w, h, 12, 0.72), up=(0, 1, 0))

    # The pick: a long point curving down. The adze: flattening into a broad chisel edge.
    mesh_object('pickaxe_pick', arm(-1, 0.26, 0.075, 0.018, 0.022, 0.0012, 0.0012, 0.75, 0.85), 'tier', root, smooth=35)
    mesh_object('pickaxe_adze', arm(1, 0.165, 0.04, 0.018, 0.022, 0.029, 0.0022, 1.3, 0.8), 'tier', root, smooth=35)
    return root


def blade():
    root = empty('blade')
    empty('blade_grip', root)
    rings = []
    n = 30
    for i in range(n + 1):
        t = i / n
        z = 0.064 + 0.6 * t
        w = 0.0275 * (1 - 0.22 * t)
        if t > 0.72:
            w *= max(0.0, 1 - ((t - 0.72) / 0.28) ** 1.6)
        w = max(w, 0.0007)
        th = max(0.0046 * (1 - 0.45 * t) * (1 - 0.8 * smooth(0.9, 1.0, t)), 0.0004)
        f = 0.0017 * (1 - smooth(0.5, 0.68, t))
        fw = min(0.0075, 0.45 * w)
        pts = [(-w, 0), (-0.6 * w, 0.8 * th), (-fw, th), (-0.5 * fw, th - f), (0.5 * fw, th - f), (fw, th), (0.6 * w, 0.8 * th),
               (w, 0), (0.6 * w, -0.8 * th), (fw, -th), (0.5 * fw, -th + f), (-0.5 * fw, -th + f), (-fw, -th), (-0.6 * w, -0.8 * th)]
        rings.append(ring((0, 0, z), (1, 0, 0), (0, 1, 0), pts))
    mesh_object('blade_blade', loft(rings), 'tier', root, smooth=25)
    # A plain crossguard with its arms swept toward the blade, and round finials.
    pts, sizes = [], []
    for i in range(17):
        t = i / 16 * 2 - 1
        pts.append((t * 0.086, 0, 0.05 + 0.016 * abs(t) ** 3))
        sizes.append((0.0135 * (1 - 0.3 * abs(t)), 0.0105 * (1 - 0.35 * abs(t))))
    mesh_object('blade_guard', path_loft(pts, sizes, shape=lambda w, h: section(w, h, 12, 0.55), up=(0, 1, 0)), 'metal', root, smooth=40)
    for side in (-1, 1):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.0085)
        bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((side * 0.088, 0, 0.066)))
        mesh_object(f'blade_finial_{side}', bm, 'metal', root, smooth=60)
    prof = [(-0.05, 0.0145), (-0.04, 0.0158), (0.0, 0.0166), (0.035, 0.0156), (0.044, 0.0148)]
    mesh_object('blade_core', loft([ring((0, 0, z), (1, 0, 0), (0, 1, 0), oval(r)) for z, r in prof]), 'leather', root, smooth=70)
    strap(root, 'blade_wrap', -0.047, 0.042, 0.016, pitch=0.011, width=0.0065)
    for z in (0.044, -0.05):
        mesh_object(f'blade_ferrule_{z}', cylinder(0.0172, 0.008, (0, 0, z), segments=18), 'metal', root, smooth=40, bevel=0.0015)
    mesh_object('blade_pommel', cylinder(0.021, 0.017, (0, 0, -0.07), Euler((math.pi / 2, 0, 0)), segments=20), 'metal', root, smooth=35, bevel=0.003)
    mesh_object('blade_peen', cylinder(0.006, 0.01, (0, 0, -0.09), segments=10), 'metal', root, smooth=40, bevel=0.0015)
    return root


def rod():
    root = empty('rod')
    empty('rod_grip', root)
    # Built with the hand at the origin: the cork grip centres on it.
    o = 0.17
    mesh_object('rod_cap', cylinder(0.0175, 0.02, (0, 0, -0.31 + o), segments=16), 'metal', root, smooth=40, bevel=0.002)
    mesh_object('rod_cork', lathe([(0.0164, -0.3 + o), (0.0186, -0.25 + o), (0.0196, -0.19 + o), (0.0179, -0.12 + o), (0.0162, -0.062 + o)], 'Z', 20), 'wood', root, smooth=70)
    mesh_object('rod_seat', lathe([(0.0134, -0.062 + o), (0.0134, 0.02 + o)], 'Z', 18), 'metal', root, smooth=60)
    for z in (-0.055, 0.014):
        mesh_object(f'rod_lock_{z}', cylinder(0.0155, 0.008, (0, 0, z + o), segments=18), 'metal', root, smooth=40, bevel=0.0015)
    mesh_object('rod_foregrip', lathe([(0.0144, 0.02 + o), (0.0158, 0.04 + o), (0.0128, 0.09 + o)], 'Z', 18), 'wood', root, smooth=70)
    mesh_object('rod_blank', lathe([(0.0086, 0.09 + o), (0.0062, 0.4 + o), (0.0043, 0.8 + o), (0.0027, 1.2 + o), (0.0021, 1.36 + o)], 'Z', 10), 'wood_dark', root, smooth=70)
    for i, h in enumerate((0.32, 0.55, 0.77, 0.97, 1.14, 1.28)):
        r_blank = 0.0086 - (h / 1.36) * 0.0065
        major = 0.0085 - i * 0.0009
        cx = -(r_blank + 0.004 + major)
        mesh_object(f'rod_guide_{i}', torus(major, 0.0008, (cx, 0, h + o), segments=16, sides=6), 'metal', root, smooth=80)
        mesh_object(f'rod_guide_foot_{i}', box((0.006, 0.0025, 0.012), (-(r_blank + 0.002), 0, h + o)), 'metal', root, smooth=30)
    mesh_object('rod_tiptop', torus(0.0024, 0.0007, (-0.004, 0, 1.362 + o), segments=12, sides=6), 'metal', root, smooth=80)
    empty('rod-tip', root, (0, 0, 1.365 + o))
    # A small brass-bound reel slung under the seat.
    reel = (-0.052, 0, -0.022 + o)
    mesh_object('rod_reel', cylinder(0.034, 0.022, reel, Euler((math.pi / 2, 0, 0)), segments=24), 'metal', root, smooth=40, bevel=0.002)
    mesh_object('rod_line', cylinder(0.027, 0.0235, reel, Euler((math.pi / 2, 0, 0)), segments=24), 'canvas', root, smooth=40)
    mesh_object('rod_reel_foot', box((0.026, 0.012, 0.05), (-0.024, 0, -0.022 + o)), 'metal', root, smooth=30, bevel=0.002)
    mesh_object('rod_reel_knob', cylinder(0.005, 0.016, (reel[0] + 0.018, 0.019, reel[2] - 0.012), Euler((math.pi / 2, 0, 0)), segments=10), 'wood_dark', root, smooth=50)
    return root


def boltcaster():
    root = empty('boltcaster')
    # Walnut stock, deeper at the butt, along +Y (into the screen).
    pts = [(0, -0.17, -0.016), (0, -0.11, -0.012), (0, -0.03, -0.004), (0, 0.06, 0), (0, 0.2, 0), (0, 0.33, 0), (0, 0.405, 0)]
    sizes = [(0.0215, 0.044), (0.022, 0.04), (0.021, 0.031), (0.019, 0.026), (0.018, 0.024), (0.017, 0.022), (0.0165, 0.02)]
    mesh_object('boltcaster_stock', path_loft(pts, sizes, shape=lambda w, h: section(w, h, 14, 0.62), up=(1, 0, 0)), 'wood_dark', root, smooth=40, subdiv=1)
    grip_pts = [(0, -0.035, -0.02), (0, -0.05, -0.06), (0, -0.068, -0.115)]
    mesh_object('boltcaster_handle', path_loft(grip_pts, [(0.0165, 0.021), (0.0158, 0.02), (0.0168, 0.021)], shape=lambda w, h: section(w, h, 12, 0.7), up=(1, 0, 0)), 'wood_dark', root, smooth=50, subdiv=1)
    grip = empty('boltcaster_grip', root, (0, -0.052, -0.068))
    grip.rotation_euler = Euler((-0.36, 0, 0))
    mesh_object('boltcaster_rail', box((0.013, 0.36, 0.007), (0, 0.235, 0.026)), 'metal', root, smooth=30, bevel=0.0015)
    # The prod: a steel bow swept back at the tips.
    pts, sizes = [], []
    for i in range(21):
        t = i / 20 * 2 - 1
        pts.append((t * 0.22, 0.405 - 0.05 * t * t, 0.02))
        sizes.append((0.016 * (1 - 0.45 * abs(t)), 0.0055))
    mesh_object('boltcaster_prod', path_loft(pts, sizes, shape=lambda w, h: section(w, h, 10, 0.5), up=(0, 0, 1)), 'metal', root, smooth=40)
    mesh_object('boltcaster_mount', box((0.052, 0.04, 0.04), (0, 0.405, 0.014)), 'metal', root, smooth=30, bevel=0.003)
    for side in (-1, 1):
        string = path_loft([(side * 0.218, 0.356, 0.021), (0, 0.098, 0.032)], [(0.0012, 0.0012)] * 2, shape=lambda w, h: section(w, h, 6, 1.0), up=(0, 0, 1))
        mesh_object(f'boltcaster_string_{side}', string, 'canvas', root, smooth=80)
    mesh_object('boltcaster_nut', box((0.022, 0.018, 0.016), (0, 0.092, 0.032)), 'metal', root, smooth=30, bevel=0.002)
    mesh_object('boltcaster_bolt', path_loft([(0, 0.1, 0.036), (0, 0.46, 0.036)], [(0.0034, 0.0034)] * 2, shape=lambda w, h: section(w, h, 8, 1.0), up=(1, 0, 0)), 'wood', root, smooth=70)
    mesh_object('boltcaster_head', lathe([(0.0035, 0.458), (0.0062, 0.468), (0.0001, 0.5)], 'Y', 8), 'metal', root, smooth=20)
    for a in (0.0, 2.1, 4.2):
        fl = box((0.0008, 0.035, 0.009), (math.sin(a) * 0.006, 0.125, 0.036 + math.cos(a) * 0.006), Euler((0, a, 0)))
        mesh_object(f'boltcaster_fletch_{a}', fl, 'canvas', root, smooth=None)
    mesh_object('boltcaster_trigger', path_loft([(0, 0.0, -0.018), (0, 0.01, -0.04), (0, -0.002, -0.052)], [(0.0035, 0.002)] * 3, up=(1, 0, 0)), 'metal', root, smooth=50)
    mesh_object('boltcaster_stirrup', torus(0.028, 0.0035, (0, 0.452, -0.004), Euler((math.pi / 2, 0, 0)), segments=12, sides=6, arc=math.pi, start=math.pi), 'metal', root, smooth=60)
    return root


def resonance():
    root = empty('resonance')
    # A builders' instrument: a bronze barrel with fins, ringing the core lens at its mouth.
    body = [(0.0, -0.14), (0.03, -0.14), (0.042, -0.126), (0.046, -0.085), (0.05, -0.025), (0.05, 0.04), (0.058, 0.058), (0.06, 0.08), (0.052, 0.1), (0.044, 0.118), (0.044, 0.128), (0.0, 0.128)]
    mesh_object('resonance_body', lathe(body, 'Y', 28), 'bronze', root, smooth=40)
    for y in (-0.1, -0.03, 0.05):
        mesh_object(f'resonance_band_{y}', torus(0.05 if y < 0.04 else 0.059, 0.0035, (0, y, 0), Euler((math.pi / 2, 0, 0)), segments=28, sides=8), 'metal', root, smooth=60)
    for k in range(6):
        a = k * math.pi / 3 + math.pi / 6
        fin = box((0.004, 0.11, 0.02), (math.cos(a) * 0.058, -0.025, math.sin(a) * 0.058), Euler((0, -a, 0)))
        mesh_object(f'resonance_fin_{k}', fin, 'bronze', root, smooth=30, bevel=0.0012)
    mesh_object('resonance_bezel', torus(0.04, 0.0065, (0, 0.132, 0), Euler((math.pi / 2, 0, 0)), segments=28, sides=10), 'bronze', root, smooth=60)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=0.037)
    bmesh.ops.scale(bm, verts=bm.verts, vec=Vector((1, 0.55, 1)))
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((0, 0.13, 0)))
    mesh_object('resonance_lens', bm, 'core', root, smooth=80)
    handle = [(0, -0.045, -0.04), (0, -0.058, -0.09), (0, -0.07, -0.14)]
    mesh_object('resonance_handle', path_loft(handle, [(0.016, 0.02), (0.0155, 0.019), (0.0165, 0.02)], shape=lambda w, h: section(w, h, 12, 0.7), up=(1, 0, 0)), 'leather', root, smooth=50, subdiv=1)
    grip = empty('resonance_grip', root, (0, -0.058, -0.09))
    grip.rotation_euler = Euler((-0.25, 0, 0))
    return root


def hand():
    """A right hand in a leather glove, closed round a handle along Z at the origin. The camera sees -Y."""
    root = empty('hand')

    def finger(name, z, a0, a1, thick, drop):
        pts, sizes = [], []
        for i in range(19):
            t = i / 18
            a = a0 + (a1 - a0) * t
            r = 0.0198 + thick * (1 - 0.18 * t)
            pts.append((math.cos(a) * r, math.sin(a) * r, z - drop * t))
            knuckle = 1 + 0.12 * (math.exp(-((t - 0.02) / 0.06) ** 2) + math.exp(-((t - 0.45) / 0.05) ** 2) + 0.6 * math.exp(-((t - 0.76) / 0.05) ** 2))
            tip = 1 - 0.55 * smooth(0.86, 1.0, t)
            sizes.append((thick * knuckle * tip, thick * 0.92 * knuckle * tip))
        mesh_object(name, path_loft(pts, sizes, shape=lambda w, h: section(w, h, 10, 0.85), up=(0, 0, 1)), 'leather', root, smooth=80, subdiv=1)

    # Index to little finger, wrapping round the far side from the knuckles at +X.
    for i, (z, thick, end) in enumerate(((0.03, 0.0096, 3.75), (0.009, 0.0101, 3.85), (-0.0125, 0.0096, 3.8), (-0.032, 0.0084, 3.6))):
        finger(f'hand_finger_{i}', z, -0.42, end, thick, 0.004)
    # The back of the hand, from the knuckles down to the wrist, which heads off toward the camera.
    back = [(0.038, -0.006, 0.0), (0.06, -0.022, -0.032), (0.083, -0.042, -0.075), (0.1, -0.058, -0.11)]
    mesh_object('hand_back', path_loft(back, [(0.041, 0.017), (0.039, 0.019), (0.033, 0.021), (0.03, 0.023)], shape=lambda w, h: section(w, h, 14, 0.7), up=(0, 0, 1)), 'leather', root, smooth=70, subdiv=1)
    # Thenar pad and thumb, closing over the index finger on the near side.
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=10, radius=0.021)
    bmesh.ops.scale(bm, verts=bm.verts, vec=Vector((1.0, 0.8, 1.3)))
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((0.036, -0.03, 0.0)))
    mesh_object('hand_thenar', bm, 'leather', root, smooth=80)
    pts, sizes = [], []
    for i in range(15):
        t = i / 14
        a = -0.75 - 1.75 * t
        r = 0.031 + 0.004 * (1 - t)
        pts.append((math.cos(a) * r, math.sin(a) * r, 0.03 + 0.016 * t))
        knuckle = 1 + 0.1 * math.exp(-((t - 0.55) / 0.08) ** 2)
        sizes.append((0.0112 * knuckle * (1 - 0.45 * smooth(0.85, 1, t)), 0.0102 * knuckle * (1 - 0.45 * smooth(0.85, 1, t))))
    mesh_object('hand_thumb', path_loft(pts, sizes, shape=lambda w, h: section(w, h, 10, 0.85), up=(0, 0, 1)), 'leather', root, smooth=80, subdiv=1)
    # Glove cuff, then the sleeve running out of frame.
    cuff = [(0.098, -0.056, -0.106), (0.13, -0.09, -0.16), (0.152, -0.112, -0.196)]
    mesh_object('hand_cuff', path_loft(cuff, [(0.032, 0.026), (0.036, 0.03), (0.04, 0.034)], shape=lambda w, h: section(w, h, 16, 0.8), up=(0, 0, 1)), 'leather', root, smooth=60, subdiv=1)
    sleeve = [(0.15, -0.11, -0.192), (0.21, -0.18, -0.3), (0.27, -0.25, -0.42)]
    mesh_object('hand_sleeve', path_loft(sleeve, [(0.045, 0.038), (0.05, 0.043), (0.054, 0.046)], shape=lambda w, h: section(w, h, 16, 0.8), up=(0, 0, 1)), 'canvas', root, smooth=60, subdiv=1)
    return root


def main():
    reset()
    roots = [pickaxe(), blade(), rod(), boltcaster(), resonance(), hand()]
    print(f'viewmodels: {tri_count()} triangles')
    shot = option('--preview')
    if shot:
        preview(os.path.abspath(shot), roots, cols=3, spacing=0.75, distance=3.0, elevation=0.25, look=(0, 0, 0.2))
    out = option('--out', 'public/assets/models/viewmodels.glb')
    export(os.path.abspath(out))
    print(f'wrote {out}')


main()
