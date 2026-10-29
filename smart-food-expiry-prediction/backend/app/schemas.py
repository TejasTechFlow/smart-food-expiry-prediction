from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel, Field, ValidationInfo, field_validator

CATEGORIES = ("Fruits", "Vegetables", "Dairy Products", "Meat", "Fish and Seafood", "Bakery Products", "Cooked Food", "Other")
STORAGE_TYPES = ("Room Temperature", "Refrigerator", "Freezer", "Controlled Storage")
PACKAGING = ("Open", "Plastic Container", "Airtight Container", "Vacuum Sealed", "Paper Packaging", "Original Packaging")
FRESHNESS = ("Excellent", "Good", "Fair", "Poor")

class FoodInput(BaseModel):
    food_name: str = Field(min_length=1, max_length=100)
    category: Literal[CATEGORIES]
    purchase_date: date
    storage_type: Literal[STORAGE_TYPES]
    temperature: float = Field(ge=-40, le=60)
    humidity: float = Field(ge=0, le=100)
    packaging_type: Literal[PACKAGING]
    freshness_condition: Literal[FRESHNESS]
    storage_duration_days: int = Field(ge=0, le=365)

    @field_validator("food_name")
    @classmethod
    def strip_name(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Food name cannot be blank")
        return v

    @field_validator("purchase_date")
    @classmethod
    def not_future(cls, v):
        if v > date.today():
            raise ValueError("Purchase date cannot be in the future")
        return v

    @field_validator("temperature")
    @classmethod
    def temp_matches_storage(cls, v, info: ValidationInfo):
        s = info.data.get("storage_type")
        if s == "Freezer" and v > 0:
            raise ValueError("Freezer temperature must be 0 °C or below")
        if s and s != "Freezer" and v < -5:
            raise ValueError("Temperature below -5 °C only makes sense for Freezer storage")
        return v

class FoodCreate(FoodInput):
    prediction_id: Optional[int] = None  # link an existing history record
