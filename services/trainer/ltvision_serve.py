"""RunPod serverless worker that serves every user-trained LTVision model on Layerto.

Layerto Core sends {"input": {"image_base64", "params": {"ltvision_weights": "weights/<id>.pt", "classes": [...]}}}.
This worker downloads the weights from Core once (cached on disk and in memory) and returns
predictions in Layerto's worker format.

Environment:
  LAYERTO_API            e.g. https://api.layerto.com
  LAYERTO_WORKER_TOKEN   same value as WORKER_TOKEN in Core
  LTVISION_DIR           folder containing the ltvision package (default /app/ltvision_code)
"""

import base64
import io
import os
import sys
import threading
import urllib.request

import numpy as np
import runpod
import torch
from PIL import Image

sys.path.insert(0, os.environ.get("LTVISION_DIR", "/app/ltvision_code"))
from ltvision import LTVisionETS, postprocess  # noqa: E402
from ltvision.data import letterbox  # noqa: E402

API = os.environ["LAYERTO_API"].rstrip("/")
TOKEN = os.environ["LAYERTO_WORKER_TOKEN"]
CACHE = os.environ.get("WEIGHTS_CACHE", "/tmp/ltvision_weights")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
_models, _lock = {}, threading.Lock()
os.makedirs(CACHE, exist_ok=True)


def load(key):
    with _lock:
        if key in _models:
            return _models[key]
        path = os.path.join(CACHE, key.replace("/", "_"))
        if not os.path.exists(path):
            req = urllib.request.Request(f"{API}/v1/internal/weights/{key.split('/', 1)[-1]}", headers={"X-Worker-Token": TOKEN})
            with urllib.request.urlopen(req, timeout=300) as r, open(path + ".tmp", "wb") as f:
                f.write(r.read())
            os.replace(path + ".tmp", path)
        ck = torch.load(path, map_location="cpu", weights_only=False)
        m = LTVisionETS(nc=ck["nc"], size=ck["size"], p2=ck["p2"], refine=ck["refine"])
        m.load_state_dict({k: v.float() if v.is_floating_point() else v for k, v in ck["model"].items()})
        m = m.to(DEVICE).eval()
        if len(_models) >= 8:  # small LRU
            _models.pop(next(iter(_models)))
        _models[key] = (m, ck)
        return _models[key]


@torch.no_grad()
def handler(job):
    inp = job["input"]
    params = inp.get("params") or {}
    key = params.get("ltvision_weights")
    if not key:
        return {"error": "missing ltvision_weights"}
    model, ck = load(key)
    img = np.array(Image.open(io.BytesIO(base64.b64decode(inp["image_base64"]))).convert("RGB"))
    h0, w0 = img.shape[:2]
    lb, r, (px, py) = letterbox(img, ck["img"])
    x = torch.from_numpy(lb.transpose(2, 0, 1)).float().div(255)[None].to(DEVICE)
    conf = float(params.get("min_confidence", 0.25))
    dets = postprocess(model, model(x), conf=conf, max_det=300, refine_nms=0.7)[0].cpu().tolist()
    names = ck["names"]
    preds = []
    for x1, y1, x2, y2, s, c in dets:
        x1, x2 = max(0, (x1 - px) / r), min(w0, (x2 - px) / r)
        y1, y2 = max(0, (y1 - py) / r), min(h0, (y2 - py) / r)
        preds.append({"label": names[int(c)], "confidence": round(s, 4),
                      "bbox": [int(x1), int(y1), int(x2 - x1), int(y2 - y1)]})
    return {"predictions": preds, "model_version": f"ltvision-{ck['size']}-e{ck.get('epoch', 0) + 1}"}


runpod.serverless.start({"handler": handler})
