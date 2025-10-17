from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.collection import ReturnDocument
from bson.objectid import ObjectId
from dotenv import load_dotenv
import os
import re
from datetime import datetime, timedelta
import time
import bcrypt
import jwt
from functools import wraps

load_dotenv()

app = Flask(__name__)

# CORS
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})

# --- Mongo / Env ---
MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "Dataset")
ASSETS_COLLECTION = os.getenv("ASSETS_COLLECTION", "Assets")
USER_COLLECTION = os.getenv("USER_COLLECTION", "Users")
QR_COLLECTION = os.getenv("QR_COLLECTION", "QrRegistry")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
SIGNUP_SECRET = os.getenv("SECRET_KEY", "")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
assets = db[ASSETS_COLLECTION]
users = db[USER_COLLECTION]
qr_registry = db[QR_COLLECTION]

# Indexes (idempotent)
users.create_index("emp_id", unique=True)
# assets.create_index("registration_number", unique=True)

# QR registry indexes
qr_registry.create_index([("qr_id", ASCENDING)], unique=True)
qr_registry.create_index([("serial_no", ASCENDING), ("institute", ASCENDING)], unique=True)
qr_registry.create_index([("institute", ASCENDING), ("department", ASCENDING)])
qr_registry.create_index([("created_at", DESCENDING)])

# ---------------- Auth helpers ----------------
EMP_RE = re.compile(r"^[A-Za-z0-9_-]{3,64}$")

def hash_password(plain: str) -> bytes:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt())

def check_password(plain: str, hashed: bytes) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed)
    except Exception:
        return False

def jwt_issue(user, ttl_hours=8):
    now = int(time.time())
    payload = {
        "sub": str(user["_id"]),
        "emp_id": user["emp_id"],
        "role": user.get("role", "Faculty"),
        "iat": now,
        "exp": now + 60 * 60 * ttl_hours,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def jwt_verify(token: str):
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

def get_token_from_request():
    token = request.cookies.get("auth_token")
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth.split(" ", 1)[1].strip()
    return None

def current_user():
    token = get_token_from_request()
    if not token:
        return None, "Missing token"
    try:
        payload = jwt_verify(token)
        uid = payload.get("sub")
        if not uid:
            return None, "Invalid token"
        doc = users.find_one({"_id": ObjectId(uid)}, {"password": 0})
        if not doc:
            return None, "User not found"
        doc["_id"] = str(doc["_id"])
        return doc, None
    except Exception:
        return None, "Invalid or expired token"

def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user, err = current_user()
        if err:
            return jsonify({"error": "Unauthorized"}), 401
        request.user = user
        return fn(*args, **kwargs)
    return wrapper

def require_role(*roles):
    def deco(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user, err = current_user()
            if err:
                return jsonify({"error": "Unauthorized"}), 401
            if user.get("role") not in roles:
                return jsonify({"error": "Forbidden"}), 403
            request.user = user
            return fn(*args, **kwargs)
        return wrapper
    return deco

def set_auth_cookie(resp, token, hours=8):
    expires = datetime.utcnow() + timedelta(hours=hours)
    secure_flag = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    same_site = os.getenv("COOKIE_SAMESITE", "Lax")
    resp.set_cookie(
        "auth_token",
        token,
        httponly=True,
        secure=secure_flag,
        samesite=same_site,
        expires=expires,
        path="/",
    )
    return resp

def clear_auth_cookie(resp):
    resp.set_cookie("auth_token", "", expires=0, path="/")
    return resp

# ---------------- Auth routes ----------------
@app.route("/api/auth/signup", methods=["POST"])
def auth_signup():
    body = request.get_json(silent=True) or {}
    emp_id = (body.get("emp_id") or "").strip()
    name = (body.get("name") or "").strip()
    password = (body.get("password") or "")
    role = (body.get("role") or "Faculty").strip()
    secret_key = (body.get("secret_key") or "")

    if not emp_id or not name or not password or not role or not secret_key:
        return jsonify({"error": "Missing required fields"}), 400
    if not EMP_RE.match(emp_id):
        return jsonify({"error": "emp_id must be 3-64 chars (letters, numbers, _ or -)"}), 400
    if secret_key != SIGNUP_SECRET:
        return jsonify({"error": "Invalid secret key"}), 403
    if role not in ["Super_Admin", "Admin", "Faculty", "Verifier"]:
        return jsonify({"error": "Invalid role"}), 400

    try:
        hashed = hash_password(password)
        doc = {"emp_id": emp_id, "name": name, "password": hashed, "role": role, "created_at": int(time.time())}
        users.insert_one(doc)
    except Exception as e:
        if "duplicate key" in str(e).lower():
            return jsonify({"error": "emp_id already exists"}), 409
        return jsonify({"error": "Failed to create user"}), 500

    user = users.find_one({"emp_id": emp_id})
    token = jwt_issue(user)
    user_out = {"_id": str(user["_id"]), "emp_id": user["emp_id"], "name": user["name"], "role": user["role"]}
    resp = make_response(jsonify({"user": user_out}))
    return set_auth_cookie(resp, token), 201

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    body = request.get_json(silent=True) or {}
    emp_id = (body.get("emp_id") or "").strip()
    password = (body.get("password") or "")

    if not emp_id or not password:
        return jsonify({"error": "Missing credentials"}), 400

    user = users.find_one({"emp_id": emp_id})
    if not user or not check_password(password, user.get("password") or b""):
        return jsonify({"error": "Invalid credentials"}), 401

    token = jwt_issue(user)
    user_out = {"_id": str(user["_id"]), "emp_id": user["emp_id"], "name": user["name"], "role": user.get("role", "Faculty")}
    resp = make_response(jsonify({"user": user_out}))
    return set_auth_cookie(resp, token), 200

@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    resp = make_response(jsonify({"message": "Logged out"}))
    return clear_auth_cookie(resp), 200

@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    user, err = current_user()
    if err:
        return jsonify({"error": err}), 401
    return jsonify(user), 200

# ---------------- Assets (existing flow) ----------------
SAFE_TOKEN_RE = re.compile(r"[^A-Za-z0-9_-]+")
DATE_FMT_DATE = "%Y-%m-%d"
REG_RE = re.compile(r"^[A-Za-z0-9_-]+/\d{14}/\d{5}$")

def sanitize_token(s: str) -> str:
    base = (s or "").strip().replace(" ", "_")
    return SAFE_TOKEN_RE.sub("", base)[:48] or "ASSET"

def reg_prefix_from_asset(asset_name: str) -> str:
    name = sanitize_token(asset_name)
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"{name}/{ts}"

def reg_with_seq(prefix: str, idx: int) -> str:
    return f"{prefix}/{idx:05d}"

@app.route("/api/assets/bulk", methods=["POST"])
@require_role("Super_Admin", "Admin")
def create_assets_bulk():
    data = request.get_json(silent=True) or {}

    asset_name = (data.get("asset_name") or "").strip()
    category = (data.get("category") or "").strip()
    location = (data.get("location") or "").strip()
    assign_date = (data.get("assign_date") or "").strip()
    status = (data.get("status") or "").strip()

    desc = (data.get("desc") or "").strip()
    verification_date = (data.get("verification_date") or "").strip()
    verified = bool(data.get("verified", False))
    verified_by = (data.get("verified_by") or "").strip()

    institute = (data.get("institute") or "").strip()
    department = (data.get("department") or "").strip()
    assigned_type = (data.get("assigned_type") or "general").strip().lower()
    assigned_faculty_name = (data.get("assigned_faculty_name") or "").strip()

    try:
        quantity = int(data.get("quantity") or 1)
    except Exception:
        return jsonify({"error": "quantity must be an integer"}), 400

    missing = []
    if not asset_name: missing.append("asset_name")
    if not category: missing.append("category")
    if not location: missing.append("location")
    if not status: missing.append("status")
    if assigned_type not in ("individual", "general"):
        return jsonify({"error": "assigned_type must be 'individual' or 'general'"}), 400
    if assigned_type == "individual" and not assigned_faculty_name:
        missing.append("assigned_faculty_name")
    if missing:
        return jsonify({"error": f"Missing or empty field(s): {', '.join(missing)}"}), 400

    if quantity < 1 or quantity > 1000:
        return jsonify({"error": "quantity must be between 1 and 1000"}), 400

    allowed_status = {"active", "inactive", "repair", "scrape", "damage"}
    if status not in allowed_status:
        return jsonify({"error": f"status must be one of {sorted(list(allowed_status))}"}), 400

    if assign_date:
        try:
            _ = datetime.strptime(assign_date, DATE_FMT_DATE)
        except Exception:
            pass

    prefix = reg_prefix_from_asset(asset_name)
    docs = []
    for i in range(1, quantity + 1):
        docs.append({
            "registration_number": reg_with_seq(prefix, i),
            "asset_name": asset_name,
            "category": category,
            "location": location,
            "assign_date": assign_date,
            "status": status,
            "desc": desc,
            "verification_date": verification_date or "",
            "verified": bool(verified),
            "verified_by": verified_by,
            "institute": institute,
            "department": department,
            "assigned_type": assigned_type,
            "assigned_faculty_name": assigned_faculty_name if assigned_type == "individual" else "",
        })

    try:
        res = assets.insert_many(docs, ordered=True)
    except Exception:
        prefix = reg_prefix_from_asset(asset_name)
        for i in range(1, quantity + 1):
            docs[i - 1]["registration_number"] = reg_with_seq(prefix, i)
        res = assets.insert_many(docs, ordered=True)

    inserted_ids = [str(x) for x in res.inserted_ids]
    for j, _id in enumerate(inserted_ids):
        docs[j]["_id"] = _id

    return jsonify({"count": len(docs), "items": docs}), 201

@app.route("/api/assets", methods=["GET"])
@require_auth
def list_assets():
    out = []
    for d in assets.find():
        d["_id"] = str(d["_id"])
        out.append(d)
    return jsonify(out), 200

@app.route("/api/assets/by-reg/<path:registration_number>", methods=["GET"])
@require_auth
def get_by_registration(registration_number):
    if not REG_RE.match(registration_number):
        return jsonify({"error": "Not found"}), 404
    doc = assets.find_one({"registration_number": registration_number})
    if not doc:
        return jsonify({"error": "Not found"}), 404
    doc["_id"] = str(doc["_id"])
    return jsonify(doc), 200

@app.route("/api/assets/<id>", methods=["GET"])
@require_auth
def get_by_id(id):
    try:
        oid = ObjectId(id)
    except Exception:
        return jsonify({"error": "Invalid id"}), 400
    doc = assets.find_one({"_id": oid})
    if not doc:
        return jsonify({"error": "Not found"}), 404
    doc["_id"] = str(doc["_id"])
    return jsonify(doc), 200

@app.route("/api/assets/<id>", methods=["PUT"])
@require_role("Super_Admin", "Admin")
def update_asset(id):
    try:
        oid = ObjectId(id)
    except Exception:
        return jsonify({"error": "Invalid id"}), 400

    data = request.get_json(silent=True) or {}
    allowed = [
        "asset_name", "category", "location", "assign_date", "status",
        "desc", "verification_date", "verified", "verified_by", "institute", "department",
        "assigned_type", "assigned_faculty_name"
    ]
    update = {}
    for f in allowed:
        if f in data:
            if f == "verified":
                update[f] = bool(data[f])
            else:
                update[f] = str(data[f]).strip()

    if "assigned_type" in update:
        if update["assigned_type"] not in ("individual", "general"):
            return jsonify({"error": "assigned_type must be 'individual' or 'general'"}), 400
        if update["assigned_type"] == "individual":
            if "assigned_faculty_name" not in update:
                current = assets.find_one({"_id": oid}, {"assigned_faculty_name": 1})
                if not current or not (current.get("assigned_faculty_name") or "").strip():
                    return jsonify({"error": "assigned_faculty_name required for 'individual'"}), 400
        else:
            update["assigned_faculty_name"] = ""

    if "status" in update:
        allowed_status = {"active", "inactive", "repair", "scrape", "damage"}
        if update["status"] not in allowed_status:
            return jsonify({"error": f"status must be one of {sorted(list(allowed_status))}"}), 400

    if not update:
        return jsonify({"error": "No fields to update"}), 400

    updated = assets.find_one_and_update(
        {"_id": oid},
        {"$set": update},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        return jsonify({"error": "Not found"}), 404

    updated["_id"] = str(updated["_id"])
    return jsonify(updated), 200

# ---------------- Profile API ----------------
@app.route("/api/auth/profile", methods=["PUT"])
@require_auth
def update_profile():
    user = request.user
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Name cannot be empty"}), 400
    users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"name": name}})
    return jsonify({"name": name}), 200

# ---------------- Bulk QR Registry (new) ----------------
QR_TS_FMT = "%d%m%Y%H%M%S"  # ddmmyyyyHHMMSS

def qr_timestamp_str(dt=None) -> str:
    return (dt or datetime.now()).strftime(QR_TS_FMT)

def institute_serial_prefix(institute: str) -> str:
    inst = (institute or "").strip().upper()
    if inst == "UVPCE":
        return "U"
    if inst == "BSPP":
        return "B"
    return inst[:1] or "X"

def next_serial_for_institute(institute: str) -> str:
    """
    Return next free serial like U01, U02... per institute.
    Uses a best-effort max lookup, then probes for a free slot.
    """
    inst = (institute or "").strip().upper()
    prefix = institute_serial_prefix(inst)
    cur = qr_registry.find(
        {"institute": inst, "serial_no": {"$regex": f"^{prefix}\\d{{2,}}$"}},
        {"serial_no": 1}
    ).sort([("serial_no", DESCENDING)]).limit(1)
    try:
        last_serial = list(cur)[0]["serial_no"]
        last_num = int(last_serial[len(prefix):])
    except Exception:
        last_num = 0
    n = last_num + 1
    while True:
        cand = f"{prefix}{n:02d}"
        if not qr_registry.find_one({"institute": inst, "serial_no": cand}, {"_id": 1}):
            return cand
        n += 1

@app.route("/api/qr/bulk", methods=["POST"])
@require_role("Super_Admin", "Admin")
def qr_bulk():
    """
    Body: { "institute": "UVPCE", "department": "IT", "quantity": 20 }
    Returns: { "count": N, "items": [ {qr_id, serial_no, institute, department, ts, _id}, ... ] }
    """
    body = request.get_json(silent=True) or {}
    institute = (body.get("institute") or body.get("college") or "").strip()
    department = (body.get("department") or "").strip()
    try:
        quantity = int(body.get("quantity") or body.get("count") or 1)
    except Exception:
        return jsonify({"error": "quantity must be an integer"}), 400

    if not institute or not department:
        return jsonify({"error": "institute and department are required"}), 400
    if quantity < 1 or quantity > 2000:
        return jsonify({"error": "quantity must be between 1 and 2000"}), 400

    inst = sanitize_token(institute).upper()
    dept = sanitize_token(department).upper()
    stamp = qr_timestamp_str()

    results = []
    for seq in range(1, quantity + 1):
        attempts = 0
        doc = None
        while attempts < 8:
            serial_no = next_serial_for_institute(inst)
            qr_id = f"{inst}/{dept}/{stamp}/{seq:04d}"
            candidate = {
                "qr_id": qr_id,
                "serial_no": serial_no,
                "institute": inst,
                "department": dept,
                "ts": stamp,
                "created_at": int(time.time()),
                "used": False,
            }
            try:
                res = qr_registry.insert_one(candidate)
                candidate["_id"] = str(res.inserted_id)
                doc = candidate
                break
            except Exception as e:
                msg = str(e).lower()
                if "duplicate key" in msg:
                    if qr_registry.find_one({"qr_id": qr_id}, {"_id": 1}):
                        stamp = qr_timestamp_str()
                    attempts += 1
                    continue
                return jsonify({"error": "Failed to create QR entries"}), 500
        if not doc:
            return jsonify({"error": "Could not allocate unique identifiers"}), 500
        results.append(doc)

    return jsonify({"count": len(results), "items": results}), 201

@app.route("/api/qr", methods=["GET"])
@require_auth
def qr_list():
    inst = (request.args.get("institute") or "").strip().upper()
    dept = (request.args.get("department") or "").strip().upper()
    used = request.args.get("used")  # "true" | "false" | None

    q = {}
    if inst:
        q["institute"] = inst
    if dept:
        q["department"] = dept
    if used in ("true", "false"):
        q["used"] = (used == "true")

    try:
        page = max(1, int(request.args.get("page", 1)))
        size = min(100, max(1, int(request.args.get("size", 25))))
    except Exception:
        page, size = 1, 25
    skip = (page - 1) * size

    total = qr_registry.count_documents(q)
    cur = qr_registry.find(q).sort([("created_at", DESCENDING)]).skip(skip).limit(size)

    items = []
    for d in cur:
        d["_id"] = str(d["_id"])
        # default empty asset-style fields for UI
        d["asset_name"] = d.get("asset_name", "")
        d["status"] = d.get("status", "")
        d["assign_date"] = d.get("assign_date", "")
        items.append(d)

    return jsonify({"total": total, "page": page, "size": size, "items": items}), 200

@app.route("/api/qr/by-id/<path:qr_id>", methods=["GET"])
@require_auth
def qr_get_by_id(qr_id):
    doc = qr_registry.find_one({"qr_id": qr_id})
    if not doc:
        return jsonify({"error": "Not found"}), 404
    doc["_id"] = str(doc["_id"])
    if "asset_id" in doc and isinstance(doc.get("asset_id"), ObjectId):
        doc["asset_id"] = str(doc["asset_id"])
    return jsonify(doc), 200

# NEW: editable fields for bulk QR scan-to-fill
QR_EDITABLE = {
    "asset_name", "category", "location", "assign_date", "status",
    "desc", "verification_date", "verified", "verified_by",
    "institute", "department", "assigned_type", "assigned_faculty_name"
}

@app.route("/api/qr/<path:qr_id>", methods=["PATCH"])
@require_auth
def qr_update_fields(qr_id):
    body = request.get_json(silent=True) or {}
    update = {}

    for k, v in body.items():
        if k not in QR_EDITABLE:
            continue
        if k == "verified":
            update[k] = bool(v)
        else:
            update[k] = ("" if v is None else str(v).strip())

    if not update:
        return jsonify({"error": "No editable fields supplied"}), 400

    doc = qr_registry.find_one_and_update(
        {"qr_id": qr_id},
        {"$set": update},
        return_document=ReturnDocument.AFTER
    )
    if not doc:
        return jsonify({"error": "QR not found"}), 404

    doc["_id"] = str(doc["_id"])
    if "asset_id" in doc and isinstance(doc.get("asset_id"), ObjectId):
        doc["asset_id"] = str(doc["asset_id"])
    return jsonify(doc), 200

@app.route("/api/qr/<path:qr_id>/link-asset/<id>", methods=["PATCH"])
@require_auth
def qr_link_asset(qr_id, id):
    try:
        oid = ObjectId(id)
    except Exception:
        return jsonify({"error": "Invalid asset id"}), 400
    upd = qr_registry.find_one_and_update(
        {"qr_id": qr_id},
        {"$set": {"used": True, "asset_id": oid}},
        return_document=ReturnDocument.AFTER,
    )
    if not upd:
        return jsonify({"error": "QR not found"}), 404
    upd["_id"] = str(upd["_id"])
    if "asset_id" in upd and isinstance(upd.get("asset_id"), ObjectId):
        upd["asset_id"] = str(upd["asset_id"])
    return jsonify(upd), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
