"""Exports the M0 plate detector (justjuu/rtdetr-v2-license-plate-detection, Apache-2.0) to ONNX for the worker.

usage: HF_HOME=spikes/.cache/hf spikes/.venv/bin/python services/image-worker/scripts/export_plate_onnx.py
Reads the weights from the local Hugging Face cache (downloaded and approved in M0; no network needed),
writes models/plate_rtdetrv2.onnx and models/plate_preprocess.json, then compares PyTorch and ONNX on five
M0 photos and prints the largest box difference in pixels.
"""
import csv
import json
import os
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForObjectDetection

os.environ.setdefault("HF_HUB_OFFLINE", "1")
ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parents[1] / "models"
MODEL_ID = "justjuu/rtdetr-v2-license-plate-detection"
THRESHOLD = 0.3


class Wrapper(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, pixel_values):
        out = self.model(pixel_values=pixel_values)
        return out.logits, out.pred_boxes


def boxes_from(logits: np.ndarray, pred_boxes: np.ndarray, width: int, height: int) -> list[tuple[float, list[float]]]:
    scores = 1 / (1 + np.exp(-logits[0, :, 0]))
    found = []
    for i in np.argsort(-scores):
        if scores[i] < THRESHOLD:
            break
        cx, cy, w, h = pred_boxes[0, i]
        found.append((float(scores[i]), [(cx - w / 2) * width, (cy - h / 2) * height, (cx + w / 2) * width, (cy + h / 2) * height]))
    return found


def main() -> None:
    OUT.mkdir(exist_ok=True)
    processor = AutoImageProcessor.from_pretrained(MODEL_ID)
    model = AutoModelForObjectDetection.from_pretrained(MODEL_ID).eval()
    size = processor.size
    (OUT / "plate_preprocess.json").write_text(json.dumps({
        "width": size["width"], "height": size["height"],
        "rescale": processor.rescale_factor if processor.do_rescale else 1.0,
        "normalize": bool(processor.do_normalize), "mean": processor.image_mean, "std": processor.image_std,
        "threshold": THRESHOLD,
    }, indent=1) + "\n")

    dummy = torch.zeros(1, 3, size["height"], size["width"])
    onnx_path = OUT / "plate_rtdetrv2.onnx"
    torch.onnx.export(Wrapper(model), (dummy,), str(onnx_path), input_names=["pixel_values"],
                      output_names=["logits", "pred_boxes"], opset_version=17, dynamo=False)
    print(f"wrote {onnx_path.relative_to(ROOT)} ({onnx_path.stat().st_size / 1e6:.0f} MB)")

    import onnxruntime as ort
    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    rows = list(csv.DictReader(open(ROOT / "spikes/data/photos.csv")))[:5]
    worst = 0.0
    for row in rows:
        pil = Image.open(ROOT / "spikes/data/photos" / row["file"]).convert("RGB")
        inputs = processor(images=pil, return_tensors="pt")
        with torch.inference_mode():
            logits, boxes = Wrapper(model)(inputs["pixel_values"])
        ref = boxes_from(logits.numpy(), boxes.numpy(), *pil.size)
        got_logits, got_boxes = session.run(None, {"pixel_values": inputs["pixel_values"].numpy()})
        got = boxes_from(got_logits, got_boxes, *pil.size)
        diff = max((abs(a - b) for (_, ra), (_, rb) in zip(ref, got) for a, b in zip(ra, rb)), default=0.0)
        worst = max(worst, diff, 0.0 if len(ref) == len(got) else float("inf"))
        print(f"{row['file']}: {len(ref)} plates, max box diff {diff:.2f} px")
    print(f"largest difference: {worst:.2f} px")


if __name__ == "__main__":
    main()
