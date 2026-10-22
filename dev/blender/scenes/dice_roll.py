# dev/blender/scenes/dice_roll.py — a die roll: the die is thrown onto felt, tumbles under Blender's
# rigid-body physics and settles face-up. Run through dev/blender/render.js (never by hand):
#
#   node dev/blender/render.js dice_roll --result 20 --seed 3
#   node dev/blender/render.js dice_roll --sides 6 --result 4 --seed 3
#
# Scene flags (on top of the launcher's common ones):
#   --sides N    the die: 4, 6, 8, 10, 12 or 20 (default 20 — the #650 d20 batch; its path is unchanged by the
#                damage dice, same seeds, same throw). The d4 is a tetrahedron read at its TOP VERTEX: each face
#                carries three numerals, one per corner, so the apex number reads on every visible face.
#   --result N   the number that must land face-up (1..sides). The physics decides WHICH face ends up
#                on top; the numerals are painted on AFTER the bake so that face carries N and every
#                opposite pair still sums to sides+1 — the render is a real roll that happens to land N.
#                Omit it and the roll is honest: whatever the seed gives.
#   --seed N     the throw (spin and push); the same seed and frame count reproduce the same roll.
#   --die HEX    die colour (default bone e8dcc0); --felt HEX the ground (default 141c24, the game's
#                accent background); --ink HEX the numerals (default 1b1b1b).
#   --shadow     with --transparent: a second opaque pass measures the die's shadow on the felt and composes it,
#                black with alpha, under the die in every frame (EEVEE has no shadow catcher).
#   --video FMTS webm (VP9; carries alpha with --transparent), mp4 (H.264, opaque) or stacked (H.264 twice as wide:
#                colour | alpha matte, for WebKit — needs --transparent), comma-separated for several from ONE render;
#                a bare --video means webm. --name FILE names the clip (a second format gets -stacked.mp4).
#
# Output: <out>/frame_0001.png … (RGBA PNG), optional <out>/dice_roll.webm, and ONE line on stdout,
# `SCENE_RESULT {json}`, that the launcher parses: the up face, its number, whether the die had
# settled by the last frame, the frame count. An unsettled roll is a WARN line too — raise --frames.
import bpy, sys, json, math, random, os
from mathutils import Vector, Matrix

# ---------------------------------------------------------------- options (one JSON arg after --)
def read_options():
    argv = sys.argv
    if "--" in argv:
        rest = argv[argv.index("--") + 1:]
        if len(rest) >= 2 and rest[0] == "--json":
            return json.loads(rest[1])
    return {}

A = {
    "out": os.path.abspath("renders/dice_roll"), "frames": 60, "fps": 24, "size": [512, 512], "seed": 1,
    "engine": "EEVEE", "samples": 24, "transparent": False, "shadow": False, "video": False, "still": None, "result": None,
    "die": "e8dcc0", "felt": "141c24", "ink": "1b1b1b", "sides": 20,
}
A.update(read_options())
SIDES = int(A["sides"])
if SIDES not in (4, 6, 8, 10, 12, 20):
    raise SystemExit("--sides must be 4, 6, 8, 10, 12 or 20, got %r" % A["sides"])
if A["result"] is not None:
    A["result"] = int(A["result"])
    if not 1 <= A["result"] <= SIDES:
        raise SystemExit("--result must be 1..%d, got %r" % (SIDES, A["result"]))
A["frames"] = int(A["frames"]); A["seed"] = int(A["seed"])
if A["shadow"] and not A["transparent"]:
    raise SystemExit("--shadow is for a transparent render (the felt already shows its own shadow)")
SHADOW_STRENGTH = 0.9   # the measured shadow, held just short of black so the felt reads as a surface, not a hole
os.makedirs(A["out"], exist_ok=True)

def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)

def srgb_to_linear(c):
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) if i < 3 else v for i, v in enumerate(c))

def material(name, hex_color, roughness):
    m = bpy.data.materials.new(name)
    if m.node_tree is None:  # Blender 4 needs the switch; 5 starts with nodes (use_nodes goes in 6.0)
        m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = srgb_to_linear(hex_rgb(hex_color))
    bsdf.inputs["Roughness"].default_value = roughness
    return m

def optional(setter, what):
    """A version-specific setting is tried and reported, never silently skipped or fatal."""
    try:
        setter()
    except Exception as e:
        print("WARN optional setting skipped (%s): %s" % (what, e))

# ---------------------------------------------------------------- scene
scene = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

r = scene.render
r.engine = "BLENDER_EEVEE" if A["engine"] == "EEVEE" else "BLENDER_WORKBENCH"
r.resolution_x, r.resolution_y = int(A["size"][0]), int(A["size"][1])
r.resolution_percentage = 100
r.fps = int(A["fps"])
r.film_transparent = bool(A["transparent"])
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGBA"
scene.frame_start, scene.frame_end = 1, A["frames"]
if A["engine"] == "EEVEE":
    optional(lambda: setattr(scene.eevee, "taa_render_samples", int(A["samples"])), "eevee samples")
    optional(lambda: setattr(scene.eevee, "use_shadows", True), "eevee shadows")
    optional(lambda: setattr(scene.eevee, "use_raytracing", True), "eevee raytracing")

world = scene.world or bpy.data.worlds.new("World")
scene.world = world
if world.node_tree is None:
    world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.02, 0.025, 0.03, 1.0)
bg.inputs["Strength"].default_value = 0.6

# ground: the felt. Hidden from the render when transparent (it still catches the die).
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
ground = bpy.context.active_object
ground.name = "Felt"
ground.data.materials.append(material("Felt", A["felt"], 0.95))
ground.hide_render = bool(A["transparent"])

# the die. The d20 is Blender's icosahedron primitive, exactly as the #650 batch rendered it; the damage dice
# are built from their vertices (convex hull, coplanar triangles dissolved into the real faces): a tetrahedron,
# a cube, an octahedron, a pentagonal trapezohedron (ten kites, the ring vertices at the height that makes each
# kite planar) and a dodecahedron. R is the circumradius, chosen per die so the five read as one set on the felt
# (a tetrahedron looks small for its circumradius, a cube large). Every die is lightly bevelled in proportion
# to its shortest edge.
R = {4: 0.62, 6: 0.55, 8: 0.56, 10: 0.52, 12: 0.52, 20: 0.5}[SIDES]

def die_vertices(sides, radius):
    """The vertices of the die with the given circumradius; the faces are their convex hull."""
    if sides == 4:
        base = [(1, 1, 1), (1, -1, -1), (-1, 1, -1), (-1, -1, 1)]
    elif sides == 6:
        base = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    elif sides == 8:
        base = [(1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)]
    elif sides == 12:
        phi = (1 + 5 ** 0.5) / 2
        base = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
        base += [(0, s * (1 / phi), t * phi) for s in (-1, 1) for t in (-1, 1)]
        base += [(s * (1 / phi), t * phi, 0) for s in (-1, 1) for t in (-1, 1)]
        base += [(s * phi, 0, t * (1 / phi)) for s in (-1, 1) for t in (-1, 1)]
    elif sides == 10:
        # apexes on the axis, ten ring vertices alternating up and down; k is the ONE ring height at which the
        # kite (apex, high, low, high) is planar: k = h (1 - cos 36°) / (1 + cos 36°)
        h, ring = 1.0, 0.78
        c36 = math.cos(math.radians(36))
        k = h * (1 - c36) / (1 + c36)
        base = [(0, 0, h), (0, 0, -h)]
        for i in range(10):
            a = math.radians(36 * i)
            base.append((ring * math.cos(a), ring * math.sin(a), k if i % 2 == 0 else -k))
    else:
        raise SystemExit("no geometry for a d%d" % sides)
    scale = radius / max(Vector(v).length for v in base)
    return [Vector(v) * scale for v in base]

def make_die(sides, radius):
    if sides == 20:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=radius, location=(0, 0, 0))
        return bpy.context.active_object
    import bmesh
    bm = bmesh.new()
    for v in die_vertices(sides, radius):
        bm.verts.new(v)
    bm.verts.ensure_lookup_table()
    hull = bmesh.ops.convex_hull(bm, input=bm.verts[:])
    junk = [g for g in hull.get("geom_interior", []) + hull.get("geom_unused", [])]
    if junk:
        bmesh.ops.delete(bm, geom=junk, context="VERTS")
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1.0), verts=bm.verts[:], edges=bm.edges[:])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new("D%d" % sides)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new("D%d" % sides, me)
    scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if len(me.polygons) != sides:
        raise SystemExit("the d%d mesh has %d faces" % (sides, len(me.polygons)))
    return obj

die = make_die(SIDES, R)
die.name = "D%d" % SIDES
die.data.materials.append(material("Bone", A["die"], 0.35))
for p in die.data.polygons:
    p.use_smooth = False
EDGE = min((die.data.vertices[e.vertices[0]].co - die.data.vertices[e.vertices[1]].co).length for e in die.data.edges)
bevel = die.modifiers.new("Bevel", "BEVEL")
bevel.width, bevel.segments = (0.02 if SIDES == 20 else 0.04 * EDGE), 3

# rigid bodies
def rigid(obj, body_type, shape):
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.rigidbody.object_add()
    rb = obj.rigid_body
    rb.type, rb.collision_shape = body_type, shape
    return rb

g = rigid(ground, "PASSIVE", "BOX")
g.friction, g.restitution = 0.9, 0.2
d = rigid(die, "ACTIVE", "CONVEX_HULL")
d.mass, d.friction, d.restitution = 0.03, 0.8, float(A.get("bounce", 0.3))   # --bounce F: the restitution, for a survey
# a little more than before: the harder throw must still settle inside the clip. The rounder damage dice roll much
# farther on the same throw (the 2026-10-21 survey: the d12 settled in 1 of 8 seeds, the d10 in 6) — each has its own
# damping, DAMPING below; --damp A,L overrides for a survey.
DAMPING = {4: (0.35, 0.15), 6: (0.35, 0.15), 8: (0.35, 0.15), 10: (0.5, 0.25), 12: (0.65, 0.3), 20: (0.35, 0.15)}
if A.get("damp"):
    DAMPING[SIDES] = tuple(float(x) for x in str(A["damp"]).split(","))
d.angular_damping, d.linear_damping = DAMPING[SIDES]
# the collision margin: Bullet pads a convex hull by 0.04 by default, a rounded shell on which a die with big flat
# faces ROCKS after it lands (the d12 survey: a decaying wobble of ±0.01 for forty frames). --margin M sets it (the d20
# keeps the default, so the #650 clips reproduce).
if A.get("margin") is not None:
    d.use_margin = True
    d.collision_margin = float(A["margin"])
rbw = scene.rigidbody_world
rbw.point_cache.frame_start, rbw.point_cache.frame_end = 1, A["frames"]
optional(lambda: setattr(rbw, "substeps_per_frame", 20), "rigidbody substeps")
optional(lambda: setattr(rbw, "solver_iterations", 20), "rigidbody solver iterations")

# the throw: the die is animated (kinematic) over frames 1-3, then released at 4 and keeps the
# velocity it had — Blender's standard way to give a rigid body an initial push and spin.
rng = random.Random(A["seed"])
start = Vector((-1.6, rng.uniform(-0.3, 0.3), 1.5))
# per-frame displacement and turn over the two kinematic frames: ~4 units/s and ~20 rad/s at 24 fps — a real throw,
# not a drop: the die turns over a few times before it comes to rest (owner 2026-10-21: the old ~2.5 u/s, ~8 rad/s
# read as dropped from just above the table). The sign of each spin axis is the seed's; the size is not.
push = Vector((rng.uniform(0.15, 0.18), rng.uniform(-0.04, 0.04), -0.02))
spin = Vector((rng.choice((-1, 1)) * rng.uniform(0.7, 1.0), rng.choice((-1, 1)) * rng.uniform(0.7, 1.0), rng.choice((-1, 1)) * rng.uniform(0.3, 0.6)))
# --throw F scales the push (not the spin) — a survey knob for a die that rolls too far; the d20's throw is 1
push = push * float(A.get("throw", 1.0))
die.rotation_euler = (rng.uniform(0, 6.28), rng.uniform(0, 6.28), rng.uniform(0, 6.28))
die.location = start
die.keyframe_insert("location", frame=1)
die.keyframe_insert("rotation_euler", frame=1)
die.location = start + push * 2
die.rotation_euler = tuple(die.rotation_euler[i] + spin[i] for i in range(3))
die.keyframe_insert("location", frame=3)
die.keyframe_insert("rotation_euler", frame=3)
d.kinematic = True
d.keyframe_insert("kinematic", frame=1)
d.keyframe_insert("kinematic", frame=3)
d.kinematic = False
d.keyframe_insert("kinematic", frame=4)

# bake the simulation; stepping the frames is the fallback when bake_all refuses in background mode
try:
    with bpy.context.temp_override(scene=scene, point_cache=rbw.point_cache):
        bpy.ops.ptcache.bake_all(bake=True)
    print("SCENE bake: ptcache.bake_all")
except Exception as e:
    print("WARN bake_all refused (%s); stepping frames instead" % e)
    for f in range(1, A["frames"] + 1):
        scene.frame_set(f)

# the path, every tenth frame — the one line that says whether the throw stayed in the frame
path = []
for f in range(1, A["frames"] + 1, 10):
    scene.frame_set(f)
    t = die.matrix_world.translation
    path.append("f%d(%.2f,%.2f,%.2f)" % (f, t.x, t.y, t.z))
print("SCENE path: " + " ".join(path))

# how much did it tumble? the frame-to-frame rotation summed over the clip, in full turns — a roll that
# settles without turning over is a drop (owner 2026-10-21: result 11's seed barely rolled); the batch
# steps past a seed under MIN_TURNS.
total_turn, tumble_turn, ground_turn, rest_frame = 0.0, 0.0, 0.0, None
scene.frame_set(1)
q_prev, p_prev = die.matrix_world.to_quaternion(), die.matrix_world.translation.copy()
for f in range(2, A["frames"] + 1):
    scene.frame_set(f)
    q, pos = die.matrix_world.to_quaternion(), die.matrix_world.translation.copy()
    d = q_prev.rotation_difference(q)
    total_turn += d.angle
    tumble = d.angle * math.sqrt(max(0.0, 1.0 - d.axis.z ** 2))   # the part about a horizontal axis — a spin on the spot is not a roll
    tumble_turn += tumble
    if pos.z < R + 0.12:                                           # on (or skimming) the felt: the turning the viewer reads as ROLLING
        ground_turn += tumble
    if rest_frame is None and (pos - p_prev).length < 0.002 and d.angle < 0.01:
        rest_frame = f
    elif not ((pos - p_prev).length < 0.002 and d.angle < 0.01):
        rest_frame = None
    q_prev, p_prev = q, pos
turns = ground_turn / (2.0 * math.pi)
print("SCENE turns: %.2f rolling on the felt (%.2f tumbling, %.2f in all), at rest from frame %s" % (turns, tumble_turn / (2.0 * math.pi), total_turn / (2.0 * math.pi), rest_frame))

# where did it land? the up face at the last frame, and was it still moving? A d4 rests on a face with a VERTEX
# up: its result is the vertex the down face does not touch.
scene.frame_set(A["frames"])
mw = die.matrix_world.copy()
rot = mw.to_3x3()
up_index, best = None, -2.0
down_index, worst = None, 2.0
for p in die.data.polygons:
    z = (rot @ p.normal).normalized().z
    if z > best:
        best, up_index = z, p.index
    if z < worst:
        worst, down_index = z, p.index
up_vertex = None
if SIDES == 4:
    up_vertex = next(v.index for v in die.data.vertices if v.index not in die.data.polygons[down_index].vertices)
end_loc, end_quat = mw.translation.copy(), mw.to_quaternion()
scene.frame_set(A["frames"] - 1)
prev = die.matrix_world
moved = (prev.translation - end_loc).length
turned = prev.to_quaternion().rotation_difference(end_quat).angle   # the true angle between the two frames; Euler differences wrap by 2*pi and once read a resting die as "turned 8.07"
settled = moved < 0.002 and turned < 0.01
if not settled:
    print("WARN the die had not settled by frame %d (moved %.4f, turned %.4f) — raise --frames" % (A["frames"], moved, turned))
    # the tail, frame by frame, so a slow roll and a jitter can be told apart (the d12 survey, 2026-10-21)
    tail = []
    for f in range(max(2, A["frames"] - 11), A["frames"] + 1):
        scene.frame_set(f - 1)
        q0, p0 = die.matrix_world.to_quaternion(), die.matrix_world.translation.copy()
        scene.frame_set(f)
        q1, p1 = die.matrix_world.to_quaternion(), die.matrix_world.translation.copy()
        tail.append("f%d dp=%.4f dq=%.4f z=%.3f" % (f, (p1 - p0).length, q0.rotation_difference(q1).angle, p1.z))
    print("SCENE unsettled tail: " + " | ".join(tail))
scene.frame_set(1)

# numerals: opposite faces pair up (antipodal normals) and each pair sums to sides+1; the up face is then
# swapped to carry --result, pair-wise, so the sums still hold. A d4 numbers its VERTICES instead (one
# numeral per corner on every face): the top vertex is swapped to carry --result.
polys = list(die.data.polygons)
TOP = SIDES + 1
rng2 = random.Random(A["seed"] * 7919 + 17)
labels = {}
pairs = []
if SIDES == 4:
    order = list(range(1, 5))
    rng2.shuffle(order)
    for v, k in zip(die.data.vertices, order):
        labels[v.index] = k
    result_index = up_vertex
else:
    used = set()
    for p in polys:
        if p.index in used:
            continue
        q = min((o for o in polys if o.index not in used and o.index != p.index), key=lambda o: (o.normal + p.normal).length)
        used.update((p.index, q.index))
        pairs.append((p.index, q.index))
    order = list(range(1, SIDES // 2 + 1))
    rng2.shuffle(order)
    for (a, b), k in zip(pairs, order):
        if rng2.random() < 0.5:
            a, b = b, a
        labels[a], labels[b] = k, TOP - k
    result_index = up_index
if A["result"] is not None and labels[result_index] != A["result"]:
    other = next(i for i, v in labels.items() if v == A["result"])
    labels[result_index], labels[other] = labels[other], labels[result_index]
    if pairs:
        mate = lambda i: next(b if a == i else a for a, b in pairs if i in (a, b))
        if mate(result_index) != other:  # the pair's mates swap too — unless the two ARE a pair, which the first swap already turned over
            labels[mate(result_index)], labels[mate(other)] = labels[mate(other)], labels[mate(result_index)]
assert A["result"] is None or labels[result_index] == A["result"], "the up face must carry --result"
assert all(labels[a] + labels[b] == TOP for a, b in pairs), "opposite faces must sum to %d" % TOP
assert sorted(labels.values()) == list(range(1, SIDES + 1)), "every number 1..%d exactly once" % SIDES

# camera and lights — aimed at WHERE THE DIE LANDS (known now that the bake is done), so every
# seed settles centred and the throw enters from the left edge; a fixed aim left the die small
# and off in a corner (the 2026-10-19 reference frames).
# aimed a little back toward the entry (owner 2026-10-21: aimed dead on the landing, the frame showed only the
# last stretch of the roll — the bounce and the tumbling happened before the die came into view)
AIM_BACK = 0.5
bpy.ops.object.empty_add(location=(end_loc.x - AIM_BACK, end_loc.y, 0.2))
aim = bpy.context.active_object
aim.name = "Aim"
# steep (about 64° up) and close, so the face that lands up is the face the viewer reads
bpy.ops.object.camera_add(location=(end_loc.x - AIM_BACK - 0.4, end_loc.y - 2.0, 4.4))
cam = bpy.context.active_object
cam.data.lens = 38   # a touch wider than the first cut's 42: more of the roll in view, the die still readable
cam.constraints.new("TRACK_TO").target = aim
scene.camera = cam
bpy.ops.object.light_add(type="SUN", location=(-2, -3, 6))
sun = bpy.context.active_object
sun.data.energy = 3.0
optional(lambda: setattr(sun.data, "angle", math.radians(8)), "sun angle")
sun.constraints.new("TRACK_TO").target = aim
bpy.ops.object.light_add(type="AREA", location=(3, 2, 4))
fill = bpy.context.active_object
fill.data.energy, fill.data.size = 250, 4
optional(lambda: setattr(fill.data, "use_shadow", False), "fill light shadow")  # the fill lights, the sun shadows: an area light's wide penumbra measured through the shadow pass is grain, not shadow
fill.constraints.new("TRACK_TO").target = aim

# THE READING RULE (owner 2026-10-19): the number that lands up ends RIGHT SIDE UP for the viewer.
# The up face's numeral is spun about its face normal at the LAST frame so that its "up" is the
# camera's screen-up projected onto that face. ONLY the up face (owner 2026-10-21): with every
# numeral squared to the camera the die looked printed on, not rolled — the other nineteen keep
# their natural spin. The die itself is never moved.
scene.frame_set(A["frames"])
bpy.context.view_layer.update()
rot_end = die.matrix_world.to_3x3()
cam_up = (cam.matrix_world.to_3x3() @ Vector((0.0, 1.0, 0.0))).normalized()
# where the settled die sits IN THE FRAME (fractions of the width and height, top-left origin): the page crops a
# composited damage roll around this spot (#653), so the batch records it per clip
from bpy_extras.object_utils import world_to_camera_view
_pts = [world_to_camera_view(scene, cam, die.matrix_world @ v.co) for v in die.data.vertices]
rest_box = [round(min(p.x for p in _pts), 3), round(1.0 - max(p.y for p in _pts), 3), round(max(p.x for p in _pts), 3), round(1.0 - min(p.y for p in _pts), 3)]
print("SCENE rest box: %s" % rest_box)
scene.frame_set(1)

def upright_rotation(n):
    """Local rotation for a numeral on the face with local normal n: Z out of the face, Y the
    camera's screen-up as seen at the last frame (projected onto the face)."""
    nw = (rot_end @ n).normalized()
    u = cam_up - nw * cam_up.dot(nw)
    if u.length < 1e-4:  # the face is square to the camera: no meaningful up; keep the default
        return n.to_track_quat("Z", "Y").to_euler()
    ul = (rot_end.inverted() @ u.normalized()).normalized()
    x = ul.cross(n).normalized()
    return Matrix((x, ul, n)).transposed().to_euler()

# THE POP (owner 2026-10-20, dialled 2026-10-21): the 19 faces that did not land up sit at 87.5% of the
# bone colour so the up face stands out — from the FIRST frame, constant through the tumble (the
# settle-fade read as the dimming "starting late"; the owner wants it on from the throw, at half the
# original 25%). One plain second material; no keyframes.
DIM = 0.875
dim = material("BoneDim", A["die"], 0.35)
die.data.materials.append(dim)
for p in polys:
    p.material_index = 0 if (p.index == up_index or SIDES == 4) else 1   # a d4 shows its result on every face: the pop is in the ink instead
dim_bsdf = dim.node_tree.nodes.get("Principled BSDF")
bone = hex_rgb(A["die"])
dim_bsdf.inputs["Base Color"].default_value = srgb_to_linear(tuple(c * DIM for c in bone[:3]) + (1.0,))

ink = material("Ink", A["ink"], 0.6)
# the d4's pop: the nine numerals that are not the apex sit in an ink faded a third of the way to bone
ink_dim = material("InkDim", A["ink"], 0.6)
ink_rgb = hex_rgb(A["ink"])
ink_dim.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = srgb_to_linear(tuple(ink_rgb[i] + (bone[i] - ink_rgb[i]) * 0.35 for i in range(3)) + (1.0,))

def inradius(p):
    """Distance from the face's centroid to its nearest edge — the room a numeral has."""
    vs = [die.data.vertices[v].co for v in p.vertices]
    c = sum(vs, Vector()) / len(vs)
    best = None
    for i in range(len(vs)):
        a, b = vs[i], vs[(i + 1) % len(vs)]
        ab = b - a
        t = max(0.0, min(1.0, (c - a).dot(ab) / ab.length_squared))
        d = (c - (a + ab * t)).length
        best = d if best is None else min(best, d)
    return best

def numeral(number, size, position, rotation, mat):
    curve = bpy.data.curves.new("N%02d" % number, type="FONT")
    curve.body = str(number) + ("." if number in (6, 9) and SIDES >= 9 else "")  # the dice maker's 6/9 mark, on a die that has both
    curve.align_x = curve.align_y = "CENTER"
    curve.size = size
    curve.offset = 0.0
    txt = bpy.data.objects.new(curve.name, curve)
    scene.collection.objects.link(txt)
    txt.data.materials.append(mat)
    txt.parent = die
    txt.location = position
    txt.rotation_euler = rotation
    return txt

def corner_rotation(n, toward):
    """Local rotation for a numeral on a face with normal n whose up points along the in-plane direction `toward`."""
    y = (toward - n * toward.dot(n)).normalized()
    x = y.cross(n).normalized()
    return Matrix((x, y, n)).transposed().to_euler()

for p in polys:
    n = p.normal.normalized()
    center = sum((die.data.vertices[v].co for v in p.vertices), Vector()) / len(p.vertices)
    if SIDES == 4:
        # three numerals per face, each at its corner and reading UP toward that corner's vertex, so the apex number
        # stands upright on every visible face once the die rests
        for vi in p.vertices:
            vco = die.data.vertices[vi].co
            pos = center + (vco - center) * 0.52 + n * 0.004
            numeral(labels[vi], 0.95 * inradius(p), pos, corner_rotation(n, vco - center), ink if vi == up_vertex else ink_dim)
        continue
    if SIDES == 20:
        size = 0.26 * (R / 0.5) if labels[p.index] < 10 else 0.22 * (R / 0.5)   # the #650 numerals, byte for byte
    else:
        size = (1.45 if labels[p.index] < 10 else 1.2) * inradius(p)
    # only the face that lands up reads upright; the others keep their natural spin (owner 2026-10-21:
    # every numeral squared to the camera looked printed on, not rolled)
    numeral(labels[p.index], size, center + n * 0.004, upright_rotation(n) if p.index == up_index else n.to_track_quat("Z", "Y").to_euler(), ink)

# render
result = {"scene": "dice_roll", "out": A["out"], "frames": A["frames"], "fps": A["fps"], "seed": A["seed"], "sides": SIDES,
          "engine": r.engine, "up_face": up_index, "up_number": labels[result_index], "requested": A["result"],
          "settled": settled, "turns": round(turns, 2), "rest_frame": rest_frame, "rest_box": rest_box, "still": None, "video": None}
def shadow_pass():
    """THE SHADOW under a transparent die (owner 2026-10-20). EEVEE has no shadow catcher, so the shadow is
    MEASURED: a second pass renders the same frames opaque on the felt (felt_NNNN.png) plus one reference
    frame of the bare felt with the die hidden, and the darkening of each felt pixel against the reference —
    in linear light — is the shadow's alpha. That black-with-alpha layer goes UNDER the die's own RGBA frame
    and frame_NNNN.png is rewritten with the composite, so every later encode (webm, stacked) carries it."""
    import numpy as np
    def load(path):
        img = bpy.data.images.load(path)
        img.colorspace_settings.name = "Non-Color"
        w, h = img.size
        px = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        bpy.data.images.remove(img)
        return px.reshape(h, w, 4)
    def linear(v):  # sRGB bytes (0..1) to linear light; the shadow ratio is physical only in linear
        return np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
    ground.hide_render = False
    scene.frame_set(1)
    die.hide_render = True
    for t in die.children:
        t.hide_render = True
    r.film_transparent = False
    r.filepath = os.path.join(A["out"], "felt_ref.png")
    bpy.ops.render.render(write_still=True)
    die.hide_render = False
    for t in die.children:
        t.hide_render = False
    r.filepath = os.path.join(A["out"], "felt_")
    bpy.ops.render.render(animation=True)
    r.film_transparent = True
    ground.hide_render = True
    ref = linear(load(os.path.join(A["out"], "felt_ref.png"))[:, :, :3]).mean(axis=2)
    for i in range(1, A["frames"] + 1):
        die_px = load(os.path.join(A["out"], "frame_%04d.png" % i))
        felt = linear(load(os.path.join(A["out"], "felt_%04d.png" % i))[:, :, :3]).mean(axis=2)
        shade = np.clip(1.0 - felt / np.maximum(ref, 1e-4), 0.0, 1.0)      # 0 lit … 1 fully shadowed
        shade = shade * SHADOW_STRENGTH
        a_die = die_px[:, :, 3]
        a_out = a_die + (1.0 - a_die) * shade                               # the shadow is black: it adds alpha, no colour
        rgb_out = die_px[:, :, :3] * a_die[:, :, None] / np.maximum(a_out, 1e-6)[:, :, None]  # straight colour of the composite
        out = np.empty_like(die_px)
        out[:, :, :3] = np.clip(rgb_out, 0.0, 1.0)
        out[:, :, 3] = a_out
        h, w = a_out.shape
        dst = bpy.data.images.new("shadowed_%04d" % i, w, h, alpha=True)
        dst.colorspace_settings.name = "Non-Color"
        dst.alpha_mode = "STRAIGHT"
        dst.pixels.foreach_set(out.ravel())
        dst.filepath_raw = os.path.join(A["out"], "frame_%04d.png" % i)
        dst.file_format = "PNG"
        dst.save()
        bpy.data.images.remove(dst)
    print("SCENE shadow: composed under %d frames (strength %.2f)" % (A["frames"], SHADOW_STRENGTH))

def stacked_frames():
    """The STACKED-ALPHA frames for WebKit (#650): WebKit plays H.264 everywhere but shows VP9 alpha as black, and
    HEVC-with-alpha cannot be encoded on this machine — so each RGBA frame becomes one opaque frame twice as wide:
    the colour premultiplied over black on the left, the alpha as grey on the right. The page draws the clip to a
    canvas and puts the matte back into the alpha channel per frame (ui-dice.js). numpy ships with Blender."""
    import numpy as np
    names = []
    for i in range(1, A["frames"] + 1):
        src = os.path.join(A["out"], "frame_%04d.png" % i)
        img = bpy.data.images.load(src)
        img.colorspace_settings.name = "Non-Color"   # raw bytes in, raw bytes out: no view transform either way
        w, h = img.size
        px = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        px = px.reshape(h, w, 4)
        a = px[:, :, 3:4]
        left = px[:, :, :3] * a
        right = np.repeat(a, 3, axis=2)
        out = np.ones((h, w * 2, 4), dtype=np.float32)
        out[:, :w, :3] = left
        out[:, w:, :3] = right
        dst = bpy.data.images.new("stacked_%04d" % i, w * 2, h, alpha=False)
        dst.colorspace_settings.name = "Non-Color"
        dst.pixels.foreach_set(out.ravel())
        dst.filepath_raw = os.path.join(A["out"], "stacked_%04d.png" % i)
        dst.file_format = "PNG"
        dst.save()
        names.append(os.path.basename(dst.filepath_raw))
        bpy.data.images.remove(img)
        bpy.data.images.remove(dst)
    return names, w * 2, h

def encode(fmt, name):
    """Encode the frames just written, through the sequencer — no second render. fmt: webm (VP9; with
    --transparent the alpha rides along), mp4 (H.264, opaque) or stacked (H.264 of the stacked-alpha frames)."""
    if fmt == "stacked":
        names, w, h = stacked_frames()
    else:
        names, w, h = ["frame_%04d.png" % i for i in range(1, A["frames"] + 1)], r.resolution_x, r.resolution_y
    vs = bpy.data.scenes.new("Encode_" + fmt)
    # the encode passes BYTES through: a new scene's default view transform (AgX) would re-grade the finished
    # frames — it squeezed the stacked matte's white to 207/255, a die 81% opaque with the story showing through
    vs.view_settings.view_transform = "Standard"
    vs.view_settings.look = "None"
    vs.render.resolution_x, vs.render.resolution_y, vs.render.fps = w, h, r.fps
    vs.frame_start, vs.frame_end = 1, A["frames"]
    vs.sequence_editor_create()
    se = vs.sequence_editor
    # Blender 4.4 renamed `sequences` to `strips`; an EMPTY collection is falsy, so test by name
    strips = se.strips if hasattr(se, "strips") else se.sequences
    strip = strips.new_image("frames", os.path.join(A["out"], names[0]), 1, 1)
    for nm in names[1:]:
        strip.elements.append(nm)
    if "media_type" in vs.render.image_settings.bl_rna.properties:  # Blender 5: video is a media type first
        vs.render.image_settings.media_type = "VIDEO"
    vs.render.image_settings.file_format = "FFMPEG"
    if fmt == "webm":
        vs.render.ffmpeg.format, vs.render.ffmpeg.codec = "WEBM", "WEBM"
        vs.render.image_settings.color_mode = "RGBA" if A["transparent"] else "RGB"
    else:
        vs.render.ffmpeg.format, vs.render.ffmpeg.codec = "MPEG4", "H264"
        vs.render.image_settings.color_mode = "RGB"
    vs.render.ffmpeg.constant_rate_factor = "HIGH"
    vs.render.filepath = os.path.join(A["out"], name)
    vs.render.use_file_extension = False
    with bpy.context.temp_override(scene=vs):
        bpy.ops.render.render(animation=True, scene=vs.name)
    return vs.render.filepath

if A["still"] is not None:
    f = int(A["still"])
    scene.frame_set(f)
    r.filepath = os.path.join(A["out"], "still_%04d.png" % f)
    bpy.ops.render.render(write_still=True)
    result["still"] = r.filepath
else:
    r.filepath = os.path.join(A["out"], "frame_")
    bpy.ops.render.render(animation=True)
    if A["shadow"]:
        shadow_pass()
    if A["video"]:
        fmts = ["webm"] if A["video"] is True else [f.strip().lower() for f in str(A["video"]).split(",") if f.strip()]
        result["videos"] = {}
        for fmt in fmts:
            if fmt not in ("webm", "mp4", "stacked"):
                raise SystemExit("--video takes webm, mp4 or stacked (comma-separated), got %r" % fmt)
            if fmt == "stacked" and not A["transparent"]:
                raise SystemExit("--video stacked needs --transparent: the matte is the frames' alpha")
            base = A.get("name") or ("dice_roll." + ("mp4" if fmt != "webm" else "webm"))
            if len(fmts) > 1 and fmt == "stacked":
                base = base.replace(".mp4", "-stacked.mp4") if base.endswith(".mp4") else base.replace(".webm", "-stacked.mp4")
            clip = encode(fmt, base)
            result["videos"][fmt] = clip
            result["video"] = result["video"] or clip
print("SCENE_RESULT " + json.dumps(result))
