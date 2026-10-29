import os, sys, tempfile
from pathlib import Path
BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND)); sys.path.insert(0, str(BACKEND / "ml"))
os.environ["FOOD_DB_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
import pytest
from fastapi.testclient import TestClient

@pytest.fixture(scope="session")
def client():
    if not (BACKEND / "models" / "food_expiry_model.joblib").exists():
        import train_model; train_model.train()
    from app.main import app
    with TestClient(app) as c:
        yield c
