import json
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import PredictionHistory as H

router = APIRouter(prefix="/history")

def to_dict(h: H) -> dict:
    return {"id": h.id, "food_item_id": h.food_item_id, "food_name": h.food_name, "category": h.category,
            "input_features": json.loads(h.input_features), "estimated_remaining_days": h.estimated_remaining_days,
            "predicted_expiry_date": str(h.predicted_expiry_date), "status": h.status,
            "prediction_date": h.prediction_date.isoformat(timespec="seconds"), "model_version": h.model_version}

@router.get("")
def list_history(search: Optional[str] = None, category: Optional[str] = None, date_from: Optional[date] = None,
                 date_to: Optional[date] = None, sort: str = "newest", db: Session = Depends(get_db)):
    q = db.query(H)
    if search: q = q.filter(H.food_name.ilike(f"%{search}%"))
    if category: q = q.filter(H.category == category)
    if date_from: q = q.filter(H.prediction_date >= date_from)
    if date_to: q = q.filter(H.prediction_date < date.fromordinal(date_to.toordinal() + 1))
    order = {"oldest": H.id.asc(), "shelf_asc": H.estimated_remaining_days.asc(),
             "shelf_desc": H.estimated_remaining_days.desc()}.get(sort, H.id.desc())
    return [to_dict(h) for h in q.order_by(order).all()]

@router.delete("/{prediction_id}", status_code=204)
def delete(prediction_id: int, db: Session = Depends(get_db)):
    h = db.get(H, prediction_id)
    if not h:
        raise HTTPException(404, f"Prediction {prediction_id} not found")
    db.delete(h); db.commit()
    return Response(status_code=204)
