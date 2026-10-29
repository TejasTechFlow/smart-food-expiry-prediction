from collections import Counter, defaultdict
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import FoodItem, PredictionHistory
from ..schemas import CATEGORIES, FRESHNESS, PACKAGING, STORAGE_TYPES, FoodInput
from ..services import predictor
from .foods import food_to_dict

router = APIRouter()

@router.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1")); dbs = "ok"
    except Exception:
        dbs = "error"
    try:
        predictor.load_model(); ml = "loaded"
    except predictor.ModelNotAvailable:
        ml = "missing"
    return {"api": "ok", "model": ml, "database": dbs}

@router.get("/categories")
def categories():
    return {"categories": CATEGORIES, "storage_types": STORAGE_TYPES, "packaging_types": PACKAGING,
            "freshness_conditions": FRESHNESS, "status_thresholds": predictor.THRESHOLDS}

@router.post("/predict")
def predict(data: FoodInput, db: Session = Depends(get_db)):
    try:
        r = predictor.predict(data)
    except predictor.ModelNotAvailable as e:
        raise HTTPException(503, str(e))
    except ValueError as e:
        raise HTTPException(500, f"Prediction failed: {e}")
    h = PredictionHistory(food_name=r["food_name"], category=r["category"], input_features=data.model_dump_json(),
                          estimated_remaining_days=r["estimated_remaining_days"], predicted_expiry_date=r["predicted_expiry_date"],
                          status=r["status"], model_version=r["model_version"], prediction_date=datetime.utcnow())
    db.add(h); db.commit(); db.refresh(h)  # workflow: every prediction is logged to history
    return {**r, "prediction_id": h.id, "predicted_expiry_date": str(r["predicted_expiry_date"]),
            "prediction_timestamp": h.prediction_date.isoformat(timespec="seconds") + "Z"}

@router.get("/model/metrics")
def model_metrics():
    try:
        return predictor.metrics()
    except predictor.ModelNotAvailable as e:
        raise HTTPException(503, str(e))

@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    items = [food_to_dict(f) for f in db.query(FoodItem).all()]
    st = Counter(i["status"] for i in items)
    daily = defaultdict(list)
    for h in db.query(PredictionHistory).order_by(PredictionHistory.prediction_date).all():
        daily[h.prediction_date.date().isoformat()].append(h.estimated_remaining_days)
    recent = db.query(PredictionHistory).order_by(PredictionHistory.id.desc()).limit(8).all()
    return {"total": len(items), "expiring_soon": st["Use Soon"] + st["Near Estimated Expiry"],
            "expired": st["Estimated Shelf Life Exceeded"],
            "avg_shelf_life": round(sum(i["estimated_remaining_days"] for i in items) / len(items), 1) if items else None,
            "status_counts": dict(st), "category_counts": dict(Counter(i["category"] for i in items)),
            "trend": [{"date": k, "avg_remaining": round(sum(v) / len(v), 1)} for k, v in daily.items()],
            "recent": [{"id": h.id, "food_name": h.food_name, "category": h.category,
                        "prediction_date": h.prediction_date.isoformat(timespec="seconds"),
                        "estimated_remaining_days": h.estimated_remaining_days,
                        "predicted_expiry_date": str(h.predicted_expiry_date), "status": h.status} for h in recent]}
