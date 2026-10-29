from datetime import date, timedelta
import pytest

def sample(**kw):
    d = {"food_name": "Milk", "category": "Dairy Products", "purchase_date": str(date.today() - timedelta(days=2)),
         "storage_type": "Refrigerator", "temperature": 4, "humidity": 55, "packaging_type": "Original Packaging",
         "freshness_condition": "Good", "storage_duration_days": 2}
    d.update(kw); return d

def test_health_and_model_loaded(client):
    assert client.get("/api/health").json() == {"api": "ok", "model": "loaded", "database": "ok"}

def test_categories(client):
    assert "Fruits" in client.get("/api/categories").json()["categories"]

def test_valid_prediction_and_date_math(client):
    r = client.post("/api/predict", json=sample())
    assert r.status_code == 200
    j = r.json(); total = j["total_shelf_life_days"]
    assert 0 < total <= 270
    assert j["estimated_remaining_days"] == pytest.approx(max(total - 2, 0), abs=0.11)
    assert j["predicted_expiry_date"] == str(date.today() - timedelta(days=2) + timedelta(days=round(total)))

@pytest.mark.parametrize("bad", [{"humidity": 120}, {"humidity": -1}, {"category": "Candy"}, {"food_name": "  "},
                                 {"temperature": -10}, {"storage_duration_days": -3},
                                 {"purchase_date": str(date.today() + timedelta(days=5))}])
def test_invalid_input_rejected(client, bad):
    assert client.post("/api/predict", json=sample(**bad)).status_code == 422

def test_freezer_negative_temperature(client):
    ok = sample(storage_type="Freezer", temperature=-18, category="Meat", food_name="Beef")
    assert client.post("/api/predict", json=ok).status_code == 200
    assert client.post("/api/predict", json={**ok, "temperature": 5}).status_code == 422

def test_end_to_end_predict_save_retrieve(client):
    p = client.post("/api/predict", json=sample(food_name="E2E Yogurt")).json()
    s = client.post("/api/foods", json={**sample(food_name="E2E Yogurt"), "prediction_id": p["prediction_id"]})
    assert s.status_code == 201
    fid = s.json()["id"]
    assert any(i["id"] == fid for i in client.get("/api/foods").json())
    assert client.get(f"/api/foods/{fid}").json()["food_name"] == "E2E Yogurt"
    hist = [h for h in client.get("/api/history").json() if h["food_name"] == "E2E Yogurt"]
    assert len(hist) == 1 and hist[0]["food_item_id"] == fid

def test_crud_update_delete_and_404(client):
    fid = client.post("/api/foods", json=sample(food_name="CRUD")).json()["id"]
    u = client.put(f"/api/foods/{fid}", json=sample(food_name="CRUD2", storage_type="Room Temperature", temperature=25))
    assert u.status_code == 200 and u.json()["food_name"] == "CRUD2"
    assert client.delete(f"/api/foods/{fid}").status_code == 204
    assert client.get(f"/api/foods/{fid}").status_code == 404

def test_history_persists_filters_and_delete(client):
    pid = client.post("/api/predict", json=sample(food_name="HistOnly")).json()["prediction_id"]
    assert [h["id"] for h in client.get("/api/history?search=HistOnly").json()] == [pid]
    assert client.get("/api/history?category=Meat&search=HistOnly").json() == []
    assert client.delete(f"/api/history/{pid}").status_code == 204
    assert client.delete(f"/api/history/{pid}").status_code == 404

def test_stats_and_metrics(client):
    assert {"total", "avg_shelf_life", "recent"} <= set(client.get("/api/stats").json())
    assert "mae" in client.get("/api/model/metrics").json()["test_metrics"]
