"""Loads the saved Joblib pipeline and turns a FoodInput into a prediction.
Target definition: the model predicts TOTAL shelf life (days) from the start of storage.
  remaining = total - storage_duration_days   (never below 0)
  expiry    = purchase_date + total
Predictions are clipped to [0.1, PLAUSIBLE_MAX[category]] days."""
import json
from datetime import timedelta
from pathlib import Path
import joblib, numpy as np, pandas as pd

MODEL_DIR = Path(__file__).resolve().parents[2] / "models"
MODEL_PATH = MODEL_DIR / "food_expiry_model.joblib"
METRICS_PATH = MODEL_DIR / "metrics.json"
PLAUSIBLE_MAX = {"Fruits": 365, "Vegetables": 365, "Dairy Products": 270, "Meat": 365,
                 "Fish and Seafood": 270, "Bakery Products": 180, "Cooked Food": 180, "Other": 730}
THRESHOLDS = "Fresh: more than 7 days left | Use Soon: 3-7 days | Near Estimated Expiry: 1-2 days | Estimated Shelf Life Exceeded: 0 or less"

class ModelNotAvailable(Exception):
    pass

_bundle = None

def load_model(force=False):
    global _bundle
    if _bundle is None or force:
        if not MODEL_PATH.exists():
            raise ModelNotAvailable("Model file not found. Run: python backend/ml/train_model.py")
        _bundle = joblib.load(MODEL_PATH)
    return _bundle

def status_for(days_left: float) -> str:
    if days_left > 7: return "Fresh"
    if days_left >= 3: return "Use Soon"
    if days_left > 0: return "Near Estimated Expiry"
    return "Estimated Shelf Life Exceeded"

def predict(d) -> dict:
    b = load_model()
    row = {k: getattr(d, k) for k in b["features"]}
    total = float(b["pipeline"].predict(pd.DataFrame([row]))[0])
    if not np.isfinite(total):
        raise ValueError("Model returned a non-finite value")
    total = min(max(total, 0.1), PLAUSIBLE_MAX[d.category])
    remaining = max(total - d.storage_duration_days, 0.0)
    return {"food_name": d.food_name, "category": d.category,
            "total_shelf_life_days": round(total, 1), "estimated_remaining_days": round(remaining, 1),
            "predicted_expiry_date": d.purchase_date + timedelta(days=round(total)),
            "status": status_for(remaining), "model_version": b["version"],
            "storage_summary": f"{d.storage_type}, {d.temperature:g} °C, {d.humidity:g}% RH, {d.packaging_type}, condition: {d.freshness_condition}",
            "disclaimer": "Estimate from an educational model trained on synthetic data. Not a food-safety judgement."}

def metrics() -> dict:
    if not METRICS_PATH.exists():
        raise ModelNotAvailable("Metrics not found. Train the model first.")
    return json.loads(METRICS_PATH.read_text(encoding="utf-8"))
