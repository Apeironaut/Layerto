#!/usr/bin/env python3
"""Layerto trainer: trains one Layerto Studio job with LTVision and uploads the weights.

Two modes:
  job     python layerto_trainer.py job --api https://api.layerto.com --job <id> --token <ltj_...>
          (what the generated Colab/Kaggle notebook runs)
  worker  python layerto_trainer.py worker --api https://api.layerto.com --worker-token <secret>
          (runs on a Layerto GPU machine; claims queued jobs one at a time, forever)

Only the standard library is used here; LTVision itself needs torch, opencv, scipy, pycocotools.
"""

import argparse
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
import zipfile

EPOCH_RE = re.compile(r"^== epoch (\d+): mAP50-95 ([0-9.na]+) mAP50 ([0-9.na]+)")


class Api:
    def __init__(self, base, token=None, worker_token=None):
        self.base = base.rstrip("/")
        self.token = token
        self.worker_token = worker_token

    def _headers(self):
        h = {"User-Agent": "layerto-trainer/1"}
        if self.token:
            h["Authorization"] = "Bearer " + self.token
        if self.worker_token:
            h["X-Worker-Token"] = self.worker_token
        return h

    def request(self, method, path, body=None, content_type=None, timeout=120):
        headers = self._headers()
        data = None
        if body is not None:
            if isinstance(body, (dict, list)):
                data = json.dumps(body).encode()
                headers["Content-Type"] = "application/json"
            else:
                data = body
                headers["Content-Type"] = content_type
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def json(self, method, path, body=None):
        status, raw = self.request(method, path, body)
        if status >= 400:
            raise RuntimeError(f"{method} {path} -> {status}: {raw[:300].decode(errors='replace')}")
        return json.loads(raw) if raw else {}

    def download(self, path, dest):
        req = urllib.request.Request(self.base + path, headers=self._headers())
        with urllib.request.urlopen(req, timeout=600) as r, open(dest, "wb") as f:
            shutil.copyfileobj(r, f, 1 << 20)

    def upload_weights(self, job_id, weights_path, metrics):
        boundary = uuid.uuid4().hex
        parts = []
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"metrics\"\r\n\r\n{json.dumps(metrics)}\r\n".encode())
        with open(weights_path, "rb") as f:
            blob = f.read()
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"weights\"; filename=\"best.pt\"\r\n"
                     f"Content-Type: application/octet-stream\r\n\r\n".encode() + blob + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        status, raw = self.request("POST", f"/v1/train/jobs/{job_id}/weights", b"".join(parts),
                                   f"multipart/form-data; boundary={boundary}", timeout=900)
        if status >= 400:
            raise RuntimeError(f"weights upload -> {status}: {raw[:300].decode(errors='replace')}")
        return json.loads(raw)


def auto_batch(size, p2):
    try:
        import torch
        gb = torch.cuda.get_device_properties(0).total_memory / 1e9 if torch.cuda.is_available() else 0
    except Exception:
        gb = 0
    table = {"n": (128, 64, 32, 16), "s": (64, 48, 24, 12), "m": (48, 24, 12, 6), "l": (32, 16, 8, 4),
             "x": (24, 12, 6, 3), "xl": (16, 8, 4, 2), "xxl": (8, 4, 2, 1)}
    col = 0 if gb >= 70 else 1 if gb >= 35 else 2 if gb >= 20 else 3
    return max(1, table.get(size, table["m"])[col] // (2 if p2 else 1))


AUG_FLAGS = {"flip": "--flip", "mosaic": "--mosaic", "mixup": "--mixup", "degrees": "--degrees",
             "scale": "--scale", "translate": "--translate", "hsv": "--hsv-gain"}


def augment_flags(code_dir, aug):
    """Maps the job's augmentation settings to train.py flags this LTVision version supports."""
    if not aug:
        return []
    try:
        help_text = subprocess.run([sys.executable, "train.py", "--help"], cwd=code_dir, capture_output=True, text=True, timeout=120).stdout
    except Exception:
        help_text = ""
    out, skipped = [], []
    for key, flag in AUG_FLAGS.items():
        if aug.get(key) is None:
            continue
        if flag in help_text:
            out += [flag, str(aug[key])]
        else:
            skipped.append(key)
    if aug.get("multiscale"):
        if "--multiscale" in help_text:
            out.append("--multiscale")
        else:
            skipped.append("multiscale")
    if skipped:
        print("note: this LTVision version doesn't support these augmentation settings, using its defaults:", ", ".join(skipped), flush=True)
    return out


def ensure_code(api, workdir):
    code = os.path.join(workdir, "ltvision_code")
    found = [r for r, _, f in os.walk(code) if "train.py" in f] if os.path.isdir(code) else []
    if found:
        return found[0]
    os.makedirs(code, exist_ok=True)
    zpath = os.path.join(workdir, "ltvision.zip")
    api.download("/v1/train/code", zpath)
    with zipfile.ZipFile(zpath) as z:
        z.extractall(code)
    found = [r for r, _, f in os.walk(code) if "train.py" in f]
    if not found:
        raise RuntimeError("the LTVision package has no train.py")
    return found[0]


def run_job(api, job_id, workdir):
    os.makedirs(workdir, exist_ok=True)
    spec = api.json("GET", f"/v1/train/jobs/{job_id}/spec")
    print(f"Job {spec['name']}: {spec['images']} images, classes {spec['classes']}, LTVision-{spec['size']}, "
          f"{spec['epochs']} epochs at {spec['img']}px", flush=True)
    try:
        code = ensure_code(api, workdir)
        data = os.path.join(workdir, "data_" + job_id)
        shutil.rmtree(data, ignore_errors=True)
        zpath = os.path.join(workdir, f"dataset_{job_id}.zip")
        api.download(f"/v1/train/jobs/{job_id}/dataset.zip", zpath)
        with zipfile.ZipFile(zpath) as z:
            z.extractall(data)
        os.remove(zpath)
        out = os.path.join(workdir, "out_" + job_id)
        api.json("POST", f"/v1/train/jobs/{job_id}/progress", {"status": "running", "message": "training started"})
        batch = auto_batch(spec["size"], spec.get("p2", False))
        cmd = [sys.executable, "train.py",
               "--train-images", os.path.join(data, "train"), "--train-ann", os.path.join(data, "train", "_annotations.coco.json"),
               "--val-images", os.path.join(data, "valid"), "--val-ann", os.path.join(data, "valid", "_annotations.coco.json"),
               "--out", out, "--size", spec["size"], "--epochs", str(spec["epochs"]), "--img", str(spec["img"]),
               "--batch", str(batch), "--nbs", "64", "--eval-every", str(spec.get("eval_every", 5)),
               "--close-mosaic", str(spec.get("close_mosaic", 10)), "--patience", str(spec.get("patience", 0)),
               "--workers", str(min(8, os.cpu_count() or 2))]
        if spec.get("p2"):
            cmd.append("--p2")
        if spec.get("has_init"):
            init_path = os.path.join(workdir, f"init_{job_id}.pt")
            api.download(f"/v1/train/jobs/{job_id}/init.pt", init_path)
            cmd += ["--init", init_path]
        cmd += augment_flags(code, spec.get("augment") or {})
        print(" ".join(cmd), flush=True)
        proc = subprocess.Popen(cmd, cwd=code, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        last_post = 0.0
        for line in proc.stdout:
            print(line, end="", flush=True)
            m = EPOCH_RE.match(line)
            if m and time.time() - last_post > 5:
                def num(v):
                    try:
                        f = float(v)
                        return None if f != f else f
                    except ValueError:
                        return None
                try:
                    api.json("POST", f"/v1/train/jobs/{job_id}/progress", {
                        "status": "running", "epoch": int(m.group(1)), "epochs": spec["epochs"],
                        "map50_95": num(m.group(2)), "map50": num(m.group(3))})
                    last_post = time.time()
                except Exception as e:  # progress is best-effort
                    print("progress update failed:", e, flush=True)
        if proc.wait() != 0:
            raise RuntimeError("training exited with an error (see the log above)")
        best = os.path.join(out, "best.pt")
        if not os.path.exists(best):
            raise RuntimeError("training finished without best.pt")
        metrics = {"size": spec["size"], "img": spec["img"], "epochs": spec["epochs"]}
        try:
            import torch
            ck = torch.load(best, map_location="cpu", weights_only=False)
            metrics.update({"map50_95": float(ck.get("map", 0)), "map50": float(ck.get("map50", 0)), "best_epoch": int(ck.get("epoch", 0)) + 1})
            # newer LTVision versions store the full COCO evaluation (mAP75, small/medium/large, recall, per-class AP)
            if isinstance(ck.get("metrics"), dict):
                metrics.update({k: v for k, v in ck["metrics"].items() if isinstance(v, (int, float, dict))})
            metrics["model_mb"] = round(os.path.getsize(best) / 1e6, 1)
        except Exception as e:
            print("could not read metrics from best.pt:", e, flush=True)
        res = api.upload_weights(job_id, best, metrics)
        print(f"Done. Model '{res.get('model_slug')}' is ready on Layerto.", flush=True)
        return True
    except Exception as e:
        print("FAILED:", e, flush=True)
        try:
            api.json("POST", f"/v1/train/jobs/{job_id}/fail", {"error": str(e)[:500]})
        except Exception:
            pass
        return False


def worker(api_base, worker_token, workdir):
    claimer = Api(api_base, worker_token=worker_token)
    print("Layerto training worker started; waiting for jobs.", flush=True)
    while True:
        try:
            status, raw = claimer.request("POST", "/v1/train/next")
            if status == 204:
                time.sleep(30)
                continue
            if status >= 400:
                print("claim failed:", status, raw[:200], flush=True)
                time.sleep(60)
                continue
            job = json.loads(raw)
            run_job(Api(api_base, token=job["token"]), job["job_id"], workdir)
        except Exception as e:
            print("worker error:", e, flush=True)
            time.sleep(60)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="mode", required=True)
    j = sub.add_parser("job")
    j.add_argument("--api", required=True)
    j.add_argument("--job", required=True)
    j.add_argument("--token", required=True)
    j.add_argument("--workdir", default="/content/layerto" if os.path.isdir("/content") else "./layerto_work")
    wk = sub.add_parser("worker")
    wk.add_argument("--api", required=True)
    wk.add_argument("--worker-token", default=os.environ.get("LAYERTO_WORKER_TOKEN", ""))
    wk.add_argument("--workdir", default="./layerto_work")
    a = ap.parse_args()
    if a.mode == "job":
        ok = run_job(Api(a.api, token=a.token), a.job, a.workdir)
        sys.exit(0 if ok else 1)
    if not a.worker_token:
        sys.exit("set --worker-token or LAYERTO_WORKER_TOKEN")
    worker(a.api, a.worker_token, a.workdir)


if __name__ == "__main__":
    main()
