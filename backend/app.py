from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.collection import ReturnDocument
from bson.objectid import ObjectId
from dotenv import load_dotenv
import os
import re
from datetime import datetime, timedelta, timezone
import time
import bcrypt
import jwt
from functools import wraps
import hashlib
import uuid

load_dotenv()

app = Flask(__name__)

# CORS
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})

# --- Mongo / Env ---
MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "Dataset")
ASSETS_COLLECTION = os.getenv("ASSETS_COLLECTION", "Assets")          # single+bulk assets live here
USER_COLLECTION = os.getenv("USER_COLLECTION", "Users")
QR_COLLECTION = os.getenv("QR_COLLECTION", "QrRegistry")              # QR registry is separate
AUDIT_COLLECTION = os.getenv("AUDIT_COLLECTION", "AuditLogs")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
SIGNUP_SECRET = os.getenv("SECRET_KEY", "")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
assets = db[ASSETS_COLLECTION]
users = db[USER_COLLECTION]
qr_registry = db[QR_COLLECTION]
audit = db[AUDIT_COLLECTION]

# Indexes (idempotent)
users.create_index("emp_id", unique=True)
assets.create_index([("serial_no", ASCENDING)])
qr_registry.create_index([("qr_id", ASCENDING)], unique=True)
qr_registry.create_index([("serial_no", ASCENDING), ("institute", ASCENDING)], unique=True)
qr_registry.create_index([("institute", ASCENDING), ("department", ASCENDING)])
qr_registry.create_index([("created_at", DESCENDING)])
qr_registry.create_index([("used", ASCENDING), ("created_at", DESCENDING)])
qr_registry.create_index([("asset_id", ASCENDING)])

# Audit indexes
audit.create_index([("ts", DESCENDING)])
audit.create_index([("action", ASCENDING)])
audit.create_index([("actor.emp_id", ASCENDING), ("ts", DESCENDING)])
audit.create_index([("resource.id", ASCENDING), ("ts", DESCENDING)])
audit.create_index([("resource.serial_no", ASCENDING)])
audit.create_index([("resource.qr_id", ASCENDING)])

# ---------------- Helpers: Auth ----------------
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

# ---------------- Helpers: Audit ----------------
def mask_ip(ip: str) -> str:
    try:
        parts = (ip or "").split(".")
        if len(parts) == 4:
            parts[-1] = "0"
            return ".".join(parts)
        return ip or ""
    except Exception:
        return ip or ""

def hash_ua(ua: str) -> str:
    try:
        return hashlib.sha256((ua or "").encode("utf-8")).hexdigest()
    except Exception:
        return ""

def get_request_context(req):
    ip = req.headers.get("X-Forwarded-For", "").split(",")[0].strip() or req.remote_addr or ""
    ua = req.headers.get("User-Agent", "")
    ctx = {
        "ip_masked": mask_ip(ip),
        "ua_hash": hash_ua(ua),
        "method": req.method,
        "route": req.path,
        "request_id": req.headers.get("X-Request-ID", str(uuid.uuid4())),
    }
    return ctx

def audit_log(audit_col, req, user, action, resource=None, changes=None,
              ok=True, status=200, error=None, institute=None, department=None, severity="info"):
    try:
        now = int(time.time())
        doc = {
            "ts": now,
            "ts_iso": datetime.utcnow().replace(tzinfo=timezone.utc).isoformat(),
            "actor": {
                "user_id": (user or {}).get("_id") if isinstance(user, dict) else None,
                "emp_id": (user or {}).get("emp_id") if isinstance(user, dict) else None,
                "name": (user or {}).get("name") if isinstance(user, dict) else None,
                "role": (user or {}).get("role") if isinstance(user, dict) else None,
            },
            "action": str(action),
            "resource": resource or {},
            "result": {"ok": bool(ok), "status": int(status), "error": str(error) if error else None},
            "context": get_request_context(req),
            "changes": changes or {},
            "institute": institute,
            "department": department,
            "severity": severity,
        }
        # Remove None keys inside nested maps for cleanliness
        if doc["result"]["error"] is None:
            del doc["result"]["error"]
        if not doc["changes"]:
            del doc["changes"]
        if not doc["resource"]:
            del doc["resource"]
        if not doc.get("institute"):
            doc.pop("institute", None)
        if not doc.get("department"):
            doc.pop("department", None)
        audit_col.insert_one(doc)
    except Exception:
        # Never break the main flow because of audit failures
        pass

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
        audit_log(audit, request, None, "auth.signup", ok=False, status=400, error="Missing required fields")
        return jsonify({"error": "Missing required fields"}), 400
    if not EMP_RE.match(emp_id):
        audit_log(audit, request, None, "auth.signup", ok=False, status=400, error="Invalid emp_id format")
        return jsonify({"error": "emp_id must be 3-64 chars (letters, numbers, _ or -)"}), 400
    if secret_key != SIGNUP_SECRET:
        audit_log(audit, request, None, "auth.signup", ok=False, status=403, error="Invalid secret key")
        return jsonify({"error": "Invalid secret key"}), 403
    if role not in ["Super_Admin", "Admin", "Faculty", "Verifier"]:
        audit_log(audit, request, None, "auth.signup", ok=False, status=400, error="Invalid role")
        return jsonify({"error": "Invalid role"}), 400

    try:
        hashed = hash_password(password)
        doc = {"emp_id": emp_id, "name": name, "password": hashed, "role": role, "created_at": int(time.time())}
        users.insert_one(doc)
    except Exception as e:
        if "duplicate key" in str(e).lower():
            audit_log(audit, request, None, "auth.signup", ok=False, status=409, error="Duplicate emp_id")
            return jsonify({"error": "emp_id already exists"}), 409
        audit_log(audit, request, None, "auth.signup", ok=False, status=500, error="Insert failed")
        return jsonify({"error": "Failed to create user"}), 500

    user = users.find_one({"emp_id": emp_id})
    token = jwt_issue(user)
    user_out = {"_id": str(user["_id"]), "emp_id": user["emp_id"], "name": user["name"], "role": user["role"]}
    audit_log(audit, request, user_out, "auth.signup", ok=True, status=201)
    resp = make_response(jsonify({"user": user_out}))
    return set_auth_cookie(resp, token), 201

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    body = request.get_json(silent=True) or {}
    emp_id = (body.get("emp_id") or "").strip()
    password = (body.get("password") or "")

    if not emp_id or not password:
        audit_log(audit, request, None, "auth.login", ok=False, status=400, error="Missing credentials")
        return jsonify({"error": "Missing credentials"}), 400

    user = users.find_one({"emp_id": emp_id})
    if not user or not check_password(password, user.get("password") or b""):
        audit_log(audit, request, None, "auth.login", ok=False, status=401, error="Invalid credentials")
        return jsonify({"error": "Invalid credentials"}), 401

    token = jwt_issue(user)
    user_out = {"_id": str(user["_id"]), "emp_id": user["emp_id"], "name": user["name"], "role": user.get("role", "Faculty")}
    audit_log(audit, request, user_out, "auth.login", ok=True, status=200)
    resp = make_response(jsonify({"user": user_out}))
    return set_auth_cookie(resp, token), 200

@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    # user might be missing cookie; try to resolve softly
    user, _ = current_user()
    audit_log(audit, request, user, "auth.logout", ok=True, status=200)
    resp = make_response(jsonify({"message": "Logged out"}))
    return clear_auth_cookie(resp), 200

@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    user, err = current_user()
    if err:
        return jsonify({"error": err}), 401
    return jsonify(user), 200

# ---------------- Assets helpers ----------------
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

# Assets serial number generator (global sequential 1..N)
def next_asset_serial() -> int:
    cur = assets.find({}, {"serial_no": 1}).sort([("serial_no", DESCENDING)]).limit(1)
    try:
        last = list(cur)[0].get("serial_no")
        return int(last) + 1
    except Exception:
        return 1

# ---------------- Assets (create/list/update) ----------------
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

    # Allocate serial numbers up-front to avoid race on per-insert
    start_serial = next_asset_serial()
    docs = []
    now_ts = int(time.time())
    for i in range(1, quantity + 1):
        docs.append({
            "serial_no": start_serial + (i - 1),
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
            "created_at": now_ts,
        })

    try:
        res = assets.insert_many(docs, ordered=True)
    except Exception:
        # Re-generate prefix and registration_numbers to avoid dup conflicts
        prefix = reg_prefix_from_asset(asset_name)
        for i in range(1, quantity + 1):
            docs[i - 1]["registration_number"] = reg_with_seq(prefix, i)
        res = assets.insert_many(docs, ordered=True)

    inserted_ids = [str(x) for x in res.inserted_ids]
    for j, _id in enumerate(inserted_ids):
        docs[j]["_id"] = _id

    # AUDIT (bulk)
    try:
        sample_serials = [d["serial_no"] for d in docs[:50]]
        audit_log(
            audit, request, request.user, "asset.bulk_create",
            resource={"type": "Asset", "id": None},
            changes={"after": {"count": len(docs), "sample_serial_no": sample_serials}},
            ok=True, status=201, institute=institute, department=department
        )
    except Exception:
        pass

    return jsonify({"count": len(docs), "items": docs}), 201

# Single asset create with serial_no
@app.route("/api/assets", methods=["POST"])
@require_role("Super_Admin", "Admin")
def create_asset_single():
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

    if assign_date:
        try:
            _ = datetime.strptime(assign_date, DATE_FMT_DATE)
        except Exception:
            pass

    prefix = reg_prefix_from_asset(asset_name)
    serial_no = next_asset_serial()
    doc = {
        "serial_no": serial_no,
        "registration_number": reg_with_seq(prefix, 1),
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
        "created_at": int(time.time()),
    }

    res = assets.insert_one(doc)
    doc["_id"] = str(res.inserted_id)

    # AUDIT (single create)
    audit_log(
        audit, request, request.user, "asset.create",
        resource={"type": "Asset", "id": doc["_id"], "serial_no": serial_no, "registration_number": doc["registration_number"]},
        changes={"after": {k: doc.get(k) for k in ["serial_no","registration_number","asset_name","category","location","status","institute","department"]}},
        ok=True, status=201, institute=institute, department=department
    )

    return jsonify(doc), 201

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
@require_role("Super_Admin", "Admin","Verifier")
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

    if "verifiedBy" in data and "verified_by" not in update:
        update["verified_by"] = str(data["verifiedBy"]).strip()
    if "verified" in data:
        update["verified"] = bool(data["verified"])
    if update.get("verified") is True and "verification_date" not in update:
        update["verification_date"] = datetime.now(timezone.utc).date().isoformat()

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

    # Load before for diff
    before = assets.find_one({"_id": oid}) or {}
    updated = assets.find_one_and_update(
        {"_id": oid},
        {"$set": update},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        return jsonify({"error": "Not found"}), 404

    # Build diff
    changed = {}
    for k, v in update.items():
        changed[k] = [before.get(k), updated.get(k)]

    # AUDIT (update)
    audit_log(
        audit, request, request.user, "asset.update",
        resource={"type": "Asset", "id": str(oid), "serial_no": before.get("serial_no"), "registration_number": before.get("registration_number")},
        changes={"diff": changed},
        ok=True, status=200, institute=updated.get("institute"), department=updated.get("department")
    )

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
    audit_log(audit, request, user, "user.profile_update", ok=True, status=200)
    return jsonify({"name": name}), 200

# ---------------- Bulk QR Registry ----------------
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
    now_ts = int(time.time())
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
                "created_at": now_ts,
                "used": False,
                "linked_at": None,
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

    # AUDIT
    sample_qr = [r["qr_id"] for r in results[:50]]
    audit_log(
        audit, request, request.user, "qr.bulk_create",
        resource={"type":"QR"}, changes={"after":{"count": len(results), "sample_qr_id": sample_qr}},
        ok=True, status=201, institute=inst, department=dept
    )

    return jsonify({"count": len(results), "items": results}), 201

# Fields to mirror from an Asset when enriching QR responses
ASSET_FIELDS = [
    "registration_number",
    "asset_name", "category", "location", "assign_date", "status",
    "desc", "verification_date", "verified", "verified_by",
    "institute", "department", "assigned_type", "assigned_faculty_name"
]

def enrich_qr_with_asset(qr_doc):
    out = dict(qr_doc)
    if "asset_id" in qr_doc and isinstance(qr_doc.get("asset_id"), ObjectId):
        aid = qr_doc["asset_id"]
        asset_doc = assets.find_one({"_id": aid}, {f: 1 for f in ASSET_FIELDS})
        if asset_doc:
            for f in ASSET_FIELDS:
                out[f] = asset_doc.get(f, out.get(f, ""))
        out["asset_id"] = str(aid)
    else:
        for f in ASSET_FIELDS:
            out[f] = qr_doc.get(f, out.get(f, ""))

    out["used"] = bool(out.get("used", False))
    return out

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

    # Optional fast lookup by asset_id if provided
    aid = request.args.get("asset_id")
    if aid:
        try:
            q["asset_id"] = ObjectId(aid)
        except Exception:
            return jsonify({"error": "Invalid asset_id"}), 400

    try:
        page = max(1, int(request.args.get("page", 1)))
        size = min(100, max(1, int(request.args.get("size", 25))))
    except Exception:
        page, size = 1, 25
    skip = (page - 1) * size

    total = qr_registry.count_documents(q)
    cur = qr_registry.find(q).sort([("created_at", DESCENDING), ("_id", DESCENDING)]).skip(skip).limit(size)

    items = []
    for d in cur:
        d["_id"] = str(d["_id"])
        items.append(enrich_qr_with_asset(d))

    return jsonify({"total": total, "page": page, "size": size, "items": items}), 200

@app.route("/api/qr/by-id/<path:qr_id>", methods=["GET"])
@require_auth
def qr_get_by_id(qr_id):
    doc = qr_registry.find_one({"qr_id": qr_id})
    if not doc:
        return jsonify({"error": "Not found"}), 404
    doc["_id"] = str(doc["_id"])
    enriched = enrich_qr_with_asset(doc)
    return jsonify(enriched), 200

# Editable fields for bulk QR scan-to-fill
QR_EDITABLE = {
    "asset_name", "category", "location", "assign_date", "status",
    "desc", "verification_date", "verified", "verified_by",
    "institute", "department", "assigned_type", "assigned_faculty_name"
}

def _has_meaningful_updates(update_dict: dict) -> bool:
    for k, v in update_dict.items():
        if k == "verified":
            return True
        if isinstance(v, str) and v.strip() != "":
            return True
    return False

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

    if "verifiedBy" in body and "verified_by" not in update:
        update["verified_by"] = str(body["verifiedBy"]).strip()
    if update.get("verified") is True and "verification_date" not in update:
        update["verification_date"] = datetime.now(timezone.utc).date().isoformat()

    if not update:
        return jsonify({"error": "No editable fields supplied"}), 400

    set_used = _has_meaningful_updates(update)

    ops = {"$set": update}
    if set_used:
        ops["$set"]["used"] = True
        ops["$set"]["linked_at"] = int(time.time())

    doc = qr_registry.find_one_and_update(
        {"qr_id": qr_id},
        ops,
        return_document=ReturnDocument.AFTER
    )
    if not doc:
        return jsonify({"error": "QR not found"}), 404

    # AUDIT (qr update fields)
    audit_log(
        audit, request, request.user, "qr.update",
        resource={"type":"QR", "qr_id": qr_id},
        changes={"after": {k: update.get(k) for k in update}},
        ok=True, status=200, institute=doc.get("institute"), department=doc.get("department")
    )

    doc["_id"] = str(doc["_id"])
    enriched = enrich_qr_with_asset(doc)
    return jsonify(enriched), 200

@app.route("/api/qr/<path:qr_id>/link-asset/<id>", methods=["PATCH"])
@require_auth
def qr_link_asset(qr_id, id):
    try:
        oid = ObjectId(id)
    except Exception:
        return jsonify({"error": "Invalid asset id"}), 400
    upd = qr_registry.find_one_and_update(
        {"qr_id": qr_id},
        {"$set": {"used": True, "asset_id": oid, "linked_at": int(time.time())}},
        return_document=ReturnDocument.AFTER,
    )
    if not upd:
        return jsonify({"error": "QR not found"}), 404

    # AUDIT
    audit_log(
        audit, request, request.user, "qr.link",
        resource={"type":"QR","qr_id": qr_id, "asset_id": str(oid)},
        ok=True, status=200, institute=upd.get("institute"), department=upd.get("department")
    )

    upd["_id"] = str(upd["_id"])
    enriched = enrich_qr_with_asset(upd)
    return jsonify(enriched), 200

# --------- DELETE by QR ID (hard delete: asset + QR) ----------
@app.route("/api/qr/<path:qr_id>/delete-asset", methods=["DELETE"])
@require_role("Super_Admin", "Admin")
def delete_asset_by_qrid(qr_id):
    qr_doc = qr_registry.find_one({"qr_id": qr_id})
    if not qr_doc:
        return jsonify({"error": "QR not found"}), 404

    deleted_asset = 0
    aid = qr_doc.get("asset_id")
    if isinstance(aid, ObjectId):
        res = assets.delete_one({"_id": aid})
        deleted_asset = res.deleted_count

    res_qr = qr_registry.delete_one({"_id": qr_doc["_id"]})

    # AUDIT
    audit_log(
        audit, request, request.user, "qr.delete_with_asset",
        resource={"type":"QR","qr_id": qr_id, "asset_id": str(aid) if isinstance(aid, ObjectId) else None},
        changes={"before": {"asset_deleted": int(deleted_asset), "qr_deleted": int(res_qr.deleted_count)}},
        ok=True, status=200, institute=qr_doc.get("institute"), department=qr_doc.get("department")
    )

    return jsonify({"deleted_asset": int(deleted_asset), "deleted_qr": int(res_qr.deleted_count)}), 200

# Optional: delete only QR row, keep asset
@app.route("/api/qr/by-id/<path:qr_id>", methods=["DELETE"])
@require_role("Super_Admin", "Admin")
def delete_qr_only(qr_id):
    res = qr_registry.delete_one({"qr_id": qr_id})
    if res.deleted_count == 0:
        return jsonify({"error": "Not found"}), 404

    audit_log(
        audit, request, request.user, "qr.delete",
        resource={"type":"QR","qr_id": qr_id},
        ok=True, status=200
    )
    return jsonify({"deleted_qr": 1}), 200

# --------- DELETE Asset by Serial (hard delete: asset + all linked QRs) ----------
@app.route("/api/assets/by-serial/<int:serial_no>", methods=["DELETE"])
@require_role("Super_Admin", "Admin")
def delete_asset_by_serial(serial_no):
    # Find asset by serial_no
    asset_doc = assets.find_one({"serial_no": int(serial_no)})
    if not asset_doc:
        audit_log(audit, request, request.user, "asset.delete", resource={"type":"Asset","serial_no": serial_no}, ok=False, status=404, error="Asset not found")
        return jsonify({"error": "Asset not found"}), 404
    aid = asset_doc["_id"]

    # Delete asset
    res_a = assets.delete_one({"_id": aid})
    if res_a.deleted_count == 0:
        audit_log(audit, request, request.user, "asset.delete", resource={"type":"Asset","id": str(aid),"serial_no": serial_no}, ok=False, status=500, error="Delete failed")
        return jsonify({"error": "Asset delete failed"}), 500

    # Delete all QR rows linked to this asset (complete purge)
    res_q = qr_registry.delete_many({"asset_id": aid})

    # AUDIT
    snapshot = {k: asset_doc.get(k) for k in ["serial_no","registration_number","asset_name","category","location","status","institute","department"]}
    audit_log(
        audit, request, request.user, "asset.delete",
        resource={"type":"Asset","id": str(aid),"serial_no": serial_no,"registration_number": asset_doc.get("registration_number")},
        changes={"before": snapshot, "after": {"deleted_qr_rows": int(res_q.deleted_count)}},
        ok=True, status=200, institute=asset_doc.get("institute"), department=asset_doc.get("department")
    )

    return jsonify({"deleted_asset": 1, "deleted_qr": int(res_q.deleted_count)}), 200

# ---------------- Audit READ APIs (Super Admin) ----------------
def _parse_bool(s):
    return True if str(s).lower() == "true" else False if str(s).lower() == "false" else None

@app.route("/api/audit", methods=["GET"])
@require_role("Super_Admin",)
def audit_list():
    q = {}
    # Filters
    action = (request.args.get("action") or "").strip()
    emp_id = (request.args.get("emp_id") or "").strip()
    resource_type = (request.args.get("resource_type") or "").strip()
    resource_id = (request.args.get("resource_id") or "").strip()
    serial_no = request.args.get("serial_no")
    qr_id = (request.args.get("qr_id") or "").strip()
    result = (request.args.get("result") or "").strip()  # "success" or "failure"
    try:
        from_ts = int(request.args.get("from_ts")) if request.args.get("from_ts") else None
        to_ts = int(request.args.get("to_ts")) if request.args.get("to_ts") else None
    except Exception:
        from_ts = to_ts = None

    if action:
        q["action"] = action
    if emp_id:
        q["actor.emp_id"] = emp_id
    if resource_type:
        q["resource.type"] = resource_type
    if resource_id:
        q["resource.id"] = resource_id
    if serial_no is not None and serial_no != "":
        try:
            q["resource.serial_no"] = int(serial_no)
        except Exception:
            q["resource.serial_no"] = serial_no
    if qr_id:
        q["resource.qr_id"] = qr_id
    if result in ("success","failure"):
        q["result.ok"] = (result == "success")
    if from_ts is not None or to_ts is not None:
        q["ts"] = {}
        if from_ts is not None:
            q["ts"]["$gte"] = from_ts
        if to_ts is not None:
            q["ts"]["$lte"] = to_ts

    try:
        page = max(1, int(request.args.get("page", 1)))
        size = min(100, max(1, int(request.args.get("size", 25))))
    except Exception:
        page, size = 1, 25
    skip = (page - 1) * size

    total = audit.count_documents(q)
    cur = audit.find(q).sort([("ts", DESCENDING)]).skip(skip).limit(size)

    items = []
    for d in cur:
        d["_id"] = str(d["_id"])
        items.append(d)

    return jsonify({"total": total, "page": page, "size": size, "items": items}), 200

@app.route("/api/audit/<id>", methods=["GET"])
@require_role("Super_Admin",)
def audit_get_one(id):
    try:
        oid = ObjectId(id)
    except Exception:
        return jsonify({"error": "Invalid id"}), 400
    doc = audit.find_one({"_id": oid})
    if not doc:
        return jsonify({"error": "Not found"}), 404
    doc["_id"] = str(doc["_id"])
    return jsonify(doc), 200


@app.route("/api/assets/max-serial", methods=["GET"])
def get_max_serial():
    # Safely get the max serial_no; default to 0 if none
    doc = assets.find_one({"serial_no": {"$exists": True}}, sort=[("serial_no", -1)])
    max_serial = doc["serial_no"] if doc else 0
    return jsonify({"next_serial": max_serial + 1}), 200



# ---------------- Run ----------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
