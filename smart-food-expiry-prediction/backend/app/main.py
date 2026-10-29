from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import init_db
from .routes import foods, history, prediction
from .services import predictor

@asynccontextmanager
async def lifespan(app):
    init_db()
    try:
        predictor.load_model()
    except predictor.ModelNotAvailable as e:
        print("WARNING:", e)  # API still starts; /api/predict returns 503
    yield

app = FastAPI(title="Smart Food Expiry Prediction System", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5500", "http://127.0.0.1:5500"],
                   allow_methods=["*"], allow_headers=["*"])
for r in (prediction.router, foods.router, history.router):
    app.include_router(r, prefix="/api")
