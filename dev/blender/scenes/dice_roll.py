# dev/blender/scenes/dice_roll.py — a d20 roll: the die is thrown onto felt, tumbles under Blender's
# rigid-body physics and settles face-up. Run through dev/blender/render.js (never by hand):
#
#   node dev/blender/render.js dice_roll --result 20 --seed 3
#
# Scene flags (on top of the launcher's common ones):
#   --result N   the number that must land face-up (1..20). The physics decides WHICH face ends up
#                on top; the numerals are painted on AFTER the bake so that face carries N and every
#                opposite pair still sums to 21 — the render is a real roll that happens to land N.
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
    "die": "e8dcc0", "felt": "141c24", "ink": "1b1b1b",
}
A.update(read_options())
if A["result"] is not None:
    A["result"] = int(A["result"])
    if not 1 <= A["result"] <= 20:
        raise SystemExit("--result must be 1..20, got %r" % A["result"])
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

# the die: an icosahedron (20 flat triangular faces), lightly bevelled
R = 0.5
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=R, location=(0, 0, 0))
die = bpy.context.active_object
die.name = "D20"
die.data.materials.append(material("Bone", A["die"], 0.35))
for p in die.data.polygons:
    p.use_smooth = False
bevel = die.modifiers.new("Bevel", "BEVEL")
bevel.width, bevel.segments = 0.02, 3

# rigid bodies
def rigid(obj, body_type, shape):
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.rigidbody.object_add()
    rb = obj.rigid_body
    rb.type, rb.collision_shape = body_type, shape
    return rb

g = rigid(ground, "PASSIVE", "BOX")
g.friction, g.restitution = 0.7, 0.2
d = rigid(die, "ACTIVE", "CONVEX_HULL")
d.mass, d.friction, d.restitution = 0.03, 0.6, 0.35
d.angular_damping, d.linear_damping = 0.15, 0.05
rbw = scene.rigidbody_world
rbw.point_cache.frame_start, rbw.point_cache.frame_end = 1, A["frames"]
optional(lambda: setattr(rbw, "substeps_per_frame", 20), "rigidbody substeps")
optional(lambda: setattr(rbw, "solver_iterations", 20), "rigidbody solver iterations")

# the throw: the die is animated (kinematic) over frames 1-3, then released at 4 and keeps the
# velocity it had — Blender's standard way to give a rigid body an initial push and spin.
rng = random.Random(A["seed"])
start = Vector((-1.2, rng.uniform(-0.3, 0.3), 1.3))
# per-frame displacement and turn over the two kinematic frames: ~2.5 units/s and ~8 rad/s at 24 fps
push = Vector((rng.uniform(0.09, 0.13), rng.uniform(-0.03, 0.03), -0.03))
spin = Vector((rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35)))
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

# where did it land? the up face at the last frame, and was it still moving?
scene.frame_set(A["frames"])
mw = die.matrix_world.copy()
rot = mw.to_3x3()
up_index, best = None, -2.0
for p in die.data.polygons:
    z = (rot @ p.normal).normalized().z
    if z > best:
        best, up_index = z, p.index
end_loc, end_rot = mw.translation.copy(), mw.to_euler()
scene.frame_set(A["frames"] - 1)
prev = die.matrix_world
moved = (prev.translation - end_loc).length
turned = sum(abs(a - b) for a, b in zip(prev.to_euler(), end_rot))
settled = moved < 0.002 and turned < 0.01
if not settled:
    print("WARN the die had not settled by frame %d (moved %.4f, turned %.4f) — raise --frames" % (A["frames"], moved, turned))
scene.frame_set(1)

# numerals: opposite faces pair up (antipodal normals) and each pair sums to 21; the up face is then
# swapped to carry --result, pair-wise, so the sums still hold.
polys = list(die.data.polygons)
pairs, used = [], set()
for p in polys:
    if p.index in used:
        continue
    q = min((o for o in polys if o.index not in used and o.index != p.index), key=lambda o: (o.normal + p.normal).length)
    used.update((p.index, q.index))
    pairs.append((p.index, q.index))
labels = {}
order = list(range(1, 11))
rng2 = random.Random(A["seed"] * 7919 + 17)
rng2.shuffle(order)
for (a, b), k in zip(pairs, order):
    if rng2.random() < 0.5:
        a, b = b, a
    labels[a], labels[b] = k, 21 - k
if A["result"] is not None and labels[up_index] != A["result"]:
    other = next(i for i, v in labels.items() if v == A["result"])
    mate = lambda i: next(b if a == i else a for a, b in pairs if i in (a, b))
    labels[up_index], labels[other] = labels[other], labels[up_index]
    if mate(up_index) != other:  # the pair's mates swap too — unless the two ARE a pair, which the first swap already turned over
        labels[mate(up_index)], labels[mate(other)] = labels[mate(other)], labels[mate(up_index)]
assert A["result"] is None or labels[up_index] == A["result"], "the up face must carry --result"
assert all(labels[a] + labels[b] == 21 for a, b in pairs), "opposite faces must sum to 21"
assert sorted(labels.values()) == list(range(1, 21)), "every number 1..20 exactly once"

# camera and lights — aimed at WHERE THE DIE LANDS (known now that the bake is done), so every
# seed settles centred and the throw enters from the left edge; a fixed aim left the die small
# and off in a corner (the 2026-10-19 reference frames).
bpy.ops.object.empty_add(location=(end_loc.x, end_loc.y, 0.2))
aim = bpy.context.active_object
aim.name = "Aim"
# steep (about 64° up) and close, so the face that lands up is the face the viewer reads
bpy.ops.object.camera_add(location=(end_loc.x - 0.4, end_loc.y - 2.0, 4.4))
cam = bpy.context.active_object
cam.data.lens = 42
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
    p.material_index = 0 if p.index == up_index else 1
dim_bsdf = dim.node_tree.nodes.get("Principled BSDF")
bone = hex_rgb(A["die"])
dim_bsdf.inputs["Base Color"].default_value = srgb_to_linear(tuple(c * DIM for c in bone[:3]) + (1.0,))

ink = material("Ink", A["ink"], 0.6)
for p in polys:
    curve = bpy.data.curves.new("N%02d" % labels[p.index], type="FONT")
    curve.body = str(labels[p.index]) + ("." if labels[p.index] in (6, 9) else "")  # the dice maker's 6/9 mark
    curve.align_x = curve.align_y = "CENTER"
    curve.size = 0.26 * (R / 0.5) if labels[p.index] < 10 else 0.22 * (R / 0.5)
    curve.offset = 0.0
    txt = bpy.data.objects.new(curve.name, curve)
    scene.collection.objects.link(txt)
    txt.data.materials.append(ink)
    center = sum((die.data.vertices[v].co for v in p.vertices), Vector()) / 3.0
    n = p.normal.normalized()
    txt.parent = die
    txt.location = center + n * 0.004
    # only the face that lands up reads upright; the other nineteen keep their natural spin (owner 2026-10-21:
    # every numeral squared to the camera looked printed on, not rolled)
    txt.rotation_euler = upright_rotation(n) if p.index == up_index else n.to_track_quat("Z", "Y").to_euler()

# render
result = {"scene": "dice_roll", "out": A["out"], "frames": A["frames"], "fps": A["fps"], "seed": A["seed"],
          "engine": r.engine, "up_face": up_index, "up_number": labels[up_index], "requested": A["result"],
          "settled": settled, "still": None, "video": None}
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
