from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Text, ForeignKey
from .database import Base

class FoodItem(Base):
    __tablename__ = "food_items"
    id = Column(Integer, primary_key=True, index=True)
    food_name = Column(String(100), nullable=False)
    category = Column(String(40), nullable=False)
    purchase_date = Column(Date, nullable=False)
    storage_type = Column(String(40), nullable=False)
    temperature = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    packaging_type = Column(String(40), nullable=False)
    freshness_condition = Column(String(20), nullable=False)
    storage_duration_days = Column(Integer, nullable=False)
    predicted_expiry_date = Column(Date, nullable=False)
    estimated_remaining_days = Column(Float, nullable=False)
    status = Column(String(40), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PredictionHistory(Base):
    __tablename__ = "prediction_history"
    id = Column(Integer, primary_key=True, index=True)
    food_item_id = Column(Integer, ForeignKey("food_items.id", ondelete="SET NULL"), nullable=True)
    food_name = Column(String(100), nullable=False)
    category = Column(String(40), nullable=False)
    input_features = Column(Text, nullable=False)  # JSON string
    estimated_remaining_days = Column(Float, nullable=False)
    predicted_expiry_date = Column(Date, nullable=False)
    status = Column(String(40), nullable=False)
    prediction_date = Column(DateTime, default=datetime.utcnow)
    model_version = Column(String(40), nullable=False)
