from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import FoodItem, PredictionHistory
from ..schemas import FoodCreate, FoodInput
from ..services import predictor

router = APIRouter(prefix="/foods")

def food_to_dict(f: FoodItem) -> dict:
    left = (f.predicted_expiry_date - date.today()).days  # live status relative to today
    return {"id": f.id, "food_name": f.food_name, "category": f.category, "purchase_date": str(f.purchase_date),
            "storage_type": f.storage_type, "temperature": f.temperature, "humidity": f.humidity,
            "packaging_type": f.packaging_type, "freshness_condition": f.freshness_condition,
            "storage_duration_days": f.storage_duration_days, "predicted_expiry_date": str(f.predicted_expiry_date),
            "estimated_remaining_days": f.estimated_remaining_days, "days_until_expiry": left,
            "status": predictor.status_for(left), "created_at": f.created_at.isoformat(), "updated_at": f.updated_at.isoformat()}

def _predict(data):
    try:
        return predictor.predict(data)
    except predictor.ModelNotAvailable as e:
        raise HTTPException(503, str(e))

def _get(db, food_id):
    f = db.get(FoodItem, food_id)
    if not f:
        raise HTTPException(404, f"Food item {food_id} not found")
    return f

def _apply(f, data, r):
    for k in ("food_name", "category", "purchase_date", "storage_type", "temperature", "humidity",
              "packaging_type", "freshness_condition", "storage_duration_days"):
        setattr(f, k, getattr(data, k))
    f.predicted_expiry_date, f.estimated_remaining_days, f.status = r["predicted_expiry_date"], r["estimated_remaining_days"], r["status"]

@router.post("", status_code=201)
def create(data: FoodCreate, db: Session = Depends(get_db)):
    r = _predict(data)
    f = FoodItem(); _apply(f, data, r); db.add(f); db.commit(); db.refresh(f)
    h = db.get(PredictionHistory, data.prediction_id) if data.prediction_id else None
    if h and h.food_item_id is None:
        h.food_item_id = f.id  # link the prediction that was already logged
    else:
        db.add(PredictionHistory(food_item_id=f.id, food_name=f.food_name, category=f.category,
                                 input_features=FoodInput(**data.model_dump(exclude={"prediction_id"})).model_dump_json(),
                                 estimated_remaining_days=r["estimated_remaining_days"],
                                 predicted_expiry_date=r["predicted_expiry_date"], status=r["status"],
                                 model_version=r["model_version"]))
    db.commit()
    return food_to_dict(f)

@router.get("")
def list_foods(search: Optional[str] = None, category: Optional[str] = None, status: Optional[str] = None,
               sort: str = "expiry_asc", db: Session = Depends(get_db)):
    q = db.query(FoodItem)
    if search: q = q.filter(FoodItem.food_name.ilike(f"%{search}%"))
    if category: q = q.filter(FoodItem.category == category)
    q = q.order_by(FoodItem.predicted_expiry_date.desc() if sort == "expiry_desc" else FoodItem.predicted_expiry_date.asc())
    items = [food_to_dict(f) for f in q.all()]
    return [i for i in items if not status or i["status"] == status]

@router.get("/{food_id}")
def get_one(food_id: int, db: Session = Depends(get_db)):
    return food_to_dict(_get(db, food_id))

@router.put("/{food_id}")
def update(food_id: int, data: FoodInput, db: Session = Depends(get_db)):
    f = _get(db, food_id); r = _predict(data); _apply(f, data, r)
    f.updated_at = datetime.utcnow(); db.commit(); db.refresh(f)
    return food_to_dict(f)

@router.delete("/{food_id}", status_code=204)
def delete(food_id: int, db: Session = Depends(get_db)):
    f = _get(db, food_id)
    db.query(PredictionHistory).filter(PredictionHistory.food_item_id == food_id).update({"food_item_id": None})
    db.delete(f); db.commit()
    return Response(status_code=204)
