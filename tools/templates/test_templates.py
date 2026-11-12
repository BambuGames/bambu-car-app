import re

import numpy as np
import pytest
import trimesh

import json

from templates import SLOTS, export_app, load_car, make_template, mode_distance, project, solve_distance


def box_car():
    """4.7 x 1.85 x 1.45 m box standing on the ground (z from 0 to 1.45)."""
    mesh = trimesh.creation.box(extents=[4.7, 1.85, 1.45])
    mesh.apply_translation([0, 0, 1.45 / 2])
    return np.asarray(mesh.vertices), np.asarray(mesh.faces)


V, F = box_car()


def test_load_car_maps_axes_centers_and_scales(tmp_path):
    # glTF-style model: +y up, +z forward, so +x is the car's left.
    # Half-size body (scaled 2x on load) with a roof marker on its left half.
    body = trimesh.creation.box(extents=[1.85, 1.45, 2.35])  # model y: -0.725..0.725
    marker = trimesh.creation.box(extents=[0.2, 0.2, 0.2])
    marker.apply_translation([0.6, 0.9, 0.0])  # model y: 0.8..1.0, above the roof
    path = tmp_path / "car.glb"
    trimesh.util.concatenate([body, marker]).export(path)

    v, _ = load_car(str(path), forward="+z", up="+y", length_m=4.7)

    assert np.isclose(v[:, 0].max() - v[:, 0].min(), 4.7)  # length along +x
    assert np.isclose(v[:, 2].min(), 0.0)  # standing on the ground
    assert np.isclose(v[:, 2].max(), 3.45)  # (1.0 + 0.725) m model height, scaled 2x
    roof_marker = v[v[:, 2] > 3.0]
    assert len(roof_marker) and (roof_marker[:, 1] > 0.9).all()  # car left is +y: 0.5..0.7 m model x, 2x


def test_point_ahead_projects_to_center():
    uv = project(np.array([[0.0, 0.0, 1.0]]), 45, 5.0, 69.0)
    assert np.allclose(uv, [[800, 600]], atol=0.5)


def test_front_left_45_front_on_image_left():
    uv = project(np.array([[2.35, 0, 0.7], [-2.35, 0, 0.7]]), 45, 6.0, 69.0)
    assert uv[0, 0] < 800 < uv[1, 0]


def test_ground_projects_below_center():
    # The camera is 1 m high, so the ground under the car must appear below the image center.
    uv = project(np.array([[0.0, 0.0, 0.0]]), 90, 5.0, 69.0)
    assert uv[0, 1] > 600


def test_side_distance_normal_mode():
    # Hand-derived: 2.35 / (0.80 * tan(34.5 deg)) = 4.27 m from the camera to the car's side.
    assert 4.0 <= solve_distance(V, 90, 69.0, 0.80) - 1.85 / 2 <= 4.6


def test_side_distance_wide_mode():
    # Hand-derived: 2.35 / (0.80 * tan(53 deg)) = 2.21 m.
    assert 2.0 <= solve_distance(V, 90, 106.0, 0.80) - 1.85 / 2 <= 2.4


@pytest.mark.parametrize("slot", ["left", "right"])
def test_side_view_fills_80_percent_of_width_in_normal_mode(slot):
    meta, _ = make_template(V, F, "test", slot, "normal")
    assert abs((meta["box"][2] - meta["box"][0]) - 0.80) < 0.01


def test_normal_mode_radius_set_by_side_fill():
    # Hand-derived: 0.925 + 2.35 / (0.80 * tan(34.5 deg)) = 5.20 m from the camera to the car's center.
    assert 5.0 <= mode_distance(V, 69.0) <= 5.4


def test_wide_mode_radius_set_by_front_view_margin():
    # The side fill alone would put the camera 0.8 m from the front bumper. Instead the front view's
    # bottom edge must stay 5% above the frame: 2.35 + 1.0 m / (tan(53 deg) * 0.45 * 1200 / 800) = 3.47 m.
    assert 3.3 <= mode_distance(V, 106.0) <= 3.7


def test_diagonal_view_is_horizontally_centered():
    meta, _ = make_template(V, F, "test", "front_left_45", "normal")
    assert abs((meta["box"][0] + meta["box"][2]) / 2 - 0.5) < 0.01


@pytest.mark.parametrize("mode", ["normal", "wide"])
@pytest.mark.parametrize("slot", list(SLOTS))
def test_every_template_fits_inside_frame_with_margin(slot, mode):
    x0, y0, x1, y1 = make_template(V, F, "test", slot, mode)[0]["box"]
    assert x0 >= 0.05 - 1e-3 and x1 <= 0.95 + 1e-3 and y0 >= 0.05 - 1e-3 and y1 <= 0.95 + 1e-3


def test_svg_path_closed_and_inside_viewbox():
    _, svg = make_template(V, F, "test", "front_left_45", "wide")
    d = re.search(r'd="([^"]+)"', svg).group(1)
    assert d.startswith("M") and d.endswith("Z")
    nums = [float(n) for n in re.findall(r"-?\d+(?:\.\d+)?", d)]
    assert all(0 <= x <= 1600 for x in nums[0::2]) and all(0 <= y <= 1200 for y in nums[1::2])


def _write_templates(out, body_type, names):
    folder = out / body_type
    folder.mkdir(parents=True)
    for slot, mode in names:
        meta, svg = make_template(V, F, body_type, slot, mode)
        (folder / f"{slot}_{mode}.json").write_text(json.dumps(meta))
        (folder / meta["svg"]).write_text(svg)


def _exported(dest, name):
    text = dest.read_text()
    return json.loads(re.search(rf"export const {name}: [^=]+= (.*);\n", text).group(1))


def test_export_app_writes_one_entry_per_template_and_credits(tmp_path):
    _write_templates(tmp_path / "out", "sedan", [("front_left_45", "normal"), ("front_left_45", "wide")])
    dest = tmp_path / "templates.generated.ts"
    export_app(str(tmp_path / "out"), str(dest))
    templates = _exported(dest, "TEMPLATES")
    assert sorted((t["bodyType"], t["slot"], t["mode"]) for t in templates) == [
        ("sedan", "front_left_45", "normal"), ("sedan", "front_left_45", "wide")]
    assert templates[0]["path"].startswith("M ") and len(templates[0]["box"]) == 4
    credits = _exported(dest, "TEMPLATE_CREDITS")
    assert [c["author"] for c in credits] == ["Antonis_zks"]


def test_export_app_skips_wide_front_and_rear(tmp_path):
    _write_templates(tmp_path / "out", "sedan", [("front", "wide"), ("rear", "wide"), ("front", "normal"),
                                                 ("front_left_45", "wide")])
    dest = tmp_path / "templates.generated.ts"
    export_app(str(tmp_path / "out"), str(dest))
    assert sorted((t["slot"], t["mode"]) for t in _exported(dest, "TEMPLATES")) == [
        ("front", "normal"), ("front_left_45", "wide")]
