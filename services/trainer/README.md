# Layerto trainer and LTVision serving

Two small programs connect Layerto Studio to GPUs.

## 1. Training worker (Layerto GPUs)

`layerto_trainer.py` is served by Core at `GET /v1/train/trainer.py` (source: `services/core/internal/studio/trainer/`).
On any GPU machine (for example a RunPod GPU pod):

```
pip install pycocotools scipy opencv-python-headless torch
curl -O https://api.layerto.com/v1/train/trainer.py && mv trainer.py layerto_trainer.py
LAYERTO_WORKER_TOKEN=<WORKER_TOKEN from Core's .env> python layerto_trainer.py worker --api https://api.layerto.com
```

It claims queued "Layerto GPU" trainings one at a time, trains them with LTVision, uploads the weights, and refunds
automatically when a training fails. Notebook trainings (users' own Colab/Kaggle) use the same script in `job` mode;
the generated notebook does that for them.

Before the first training, upload the LTVision package in Admin → Studio → Training (the same `lt_ets.zip` used for
Colab). Core serves it to trainers.

## 2. Inference worker (RunPod serverless)

`ltvision_serve.py` serves every user-trained model from one RunPod endpoint. Build an image with torch, opencv,
scipy, pillow, runpod and the LTVision package in `/app/ltvision_code`, then set:

- `LAYERTO_API`: Core's public URL
- `LAYERTO_WORKER_TOKEN`: the same value as `WORKER_TOKEN` in Core

Put the endpoint ID in Admin → Studio → Settings (`ltvision_endpoint`). Weights are downloaded once per worker and
cached.
