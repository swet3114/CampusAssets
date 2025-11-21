from flask import Flask, request, jsonify, make_response, send_file
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
# Normalize origins list (strip whitespace and drop empties) so matching is exact
# ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",") if o.strip()]
# CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})
CORS(app, resources={r"/api/*": {"origins": [os.getenv("FRONTEND_ORIGIN"),"http://localhost:3000"]}}, supports_credentials=True)

# --- Mongo / Env ---
MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "Dataset")
ASSETS_COLLECTION = os.getenv("ASSETS_COLLECTION", "Assets")          # single+bulk assets live here
USER_COLLECTION = os.getenv("USER_COLLECTION", "Users")
QR_COLLECTION = os.getenv("QR_COLLECTION", "QrRegistry")              # QR registry is separate
AUDIT_COLLECTION = os.getenv("AUDIT_COLLECTION", "AuditLogs")
INFO_COLLECTION = os.getenv("INFO_COLLECTION", "OtherInfo")
JWT_SECRET = os.getenv("JWT_SECRET")
SIGNUP_SECRET = os.getenv("SECRET_KEY", "")


client = MongoClient(MONGO_URL)
db = client[DB_NAME]
assets = db[ASSETS_COLLECTION]
users = db[USER_COLLECTION]
qr_registry = db[QR_COLLECTION]
audit = db[AUDIT_COLLECTION]
info = db[INFO_COLLECTION]

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

def update_asset_by_registration(registration_number, update_data):
    # Remove _id if present in update_data
    if '_id' in update_data:
        del update_data['_id']
    
    # Add update timestamp
    update_data['updated_at'] = datetime.now(timezone.utc)
    
    result = assets.find_one_and_update(
        {"registration_number": registration_number},
        {"$set": update_data},
        return_document=ReturnDocument.AFTER
    )
    
    if result:
        result['_id'] = str(result['_id'])
        return result
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
    name = sanitize_token(asset_name)[:6]
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
# DEPRECATED ROUTE: POST /api/assets/bulk
# The bulk creation logic has been moved to the primary POST /api/assets endpoint.
# Keep the function available (so the create_asset_single wrapper can call it),
# but disable the explicit /api/assets/bulk route to force clients to use /api/assets.
# @app.route("/api/assets/bulk", methods=["POST"])
# @require_role("Super_Admin", "Admin")
def create_assets_bulk():
    data = request.get_json(silent=True) or {}

    # Core
    asset_name = (data.get("asset_name") or "").strip()
    category = (data.get("category") or "").strip()

    # Assignment/lifecycle
    assign_date = (data.get("assign_date") or "").strip()
    status = (data.get("status") or "").strip()

    # Description and remarks (UI: Description -> desc)
    desc = (data.get("desc") or "").strip()
    remarks = (data.get("remarks") or "").strip()

    verification_date = (data.get("verification_date") or "").strip()
    verified = bool(data.get("verified", False))
    verified_by = (data.get("verified_by") or "").strip()

    # Org
    institute = (data.get("institute") or "").strip()
    department = (data.get("department") or "").strip()

    # Assignment type
    assigned_type = (data.get("assigned_type") or "").strip().lower()
    assigned_faculty_name = (data.get("assigned_faculty_name") or "").strip()
    employee_code = (data.get("employee_code") or "").strip()

    # Procurement
    bill_no = (data.get("bill_no") or "").strip()
    vendor_name = (data.get("vendor_name") or "").strip()
    purchase_date = (data.get("purchase_date") or "").strip()
    rate_per_unit_raw = (data.get("rate_per_unit") or "").strip()
    po_no = (data.get("po_no") or "").strip()

    # Physical/specs
    size_lxwxh = (data.get("size_lxwxh") or "").strip()
    company_model = (data.get("company_model") or "").strip()
    it_serial_no = (data.get("it_serial_no") or "").strip()
    dead_stock_no = (data.get("dead_stock_no") or "").strip()

    # Location fields (kept compatibility: location optional text; primary short fields)
    room_no = (data.get("room_no") or "").strip()
    building_name = (data.get("building_name") or "").strip()
    #location = (data.get("location") or "").strip()  # optional long field, may be empty in new UI

    # Quantity
    try:
        quantity = int(data.get("quantity") or 1)
    except Exception:
        return jsonify({"error": "quantity must be an integer"}), 400

    # Coerce rate_per_unit to numeric if possible (store as float), else keep string
    rate_per_unit = None
    if rate_per_unit_raw:
        try:
            rate_per_unit = float(rate_per_unit_raw.replace(",", ""))
        except Exception:
            # keep original text if parsing fails
            rate_per_unit = rate_per_unit_raw

    # Required checks
    missing = []
    if not asset_name: missing.append("asset_name")
    if not category: missing.append("category")
    if not institute: missing.append("institute")
    # department optional per previous behavior
    if assigned_type and assigned_type not in ("individual", "general"):
        return jsonify({"error": "assigned_type must be 'individual' or 'general' or empty"}), 400
    if assigned_type == "individual" and not assigned_faculty_name:
        missing.append("assigned_faculty_name")
    if missing:
        return jsonify({"error": f"Missing or empty field(s): {', '.join(missing)}"}), 400

    if quantity < 1 or quantity > 1000:
        return jsonify({"error": "quantity must be between 1 and 1000"}), 400

    allowed_status = {"active", "inactive", "repair", "scrape", "damage"}
    if status and status not in allowed_status:
        return jsonify({"error": f"status must be one of {sorted(list(allowed_status))}"}), 400

    # Date parsing leniency: keep raw if parse fails
    if assign_date:
        try:
            _ = datetime.strptime(assign_date, DATE_FMT_DATE)
        except Exception:
            pass

    if purchase_date:
        try:
            _ = datetime.strptime(purchase_date, DATE_FMT_DATE)
        except Exception:
            pass

    prefix = reg_prefix_from_asset(asset_name)

    # Allocate serial numbers up-front to avoid race on per-insert
    start_serial = next_asset_serial()
    docs = []
    now_ts = int(time.time())
    for i in range(1, quantity + 1):
        doc = {
            "serial_no": start_serial + (i - 1),
            "registration_number": reg_with_seq(prefix, i),

            # Core
            "asset_name": asset_name,
            "category": category,

            # Location
            #"location": location,
            "room_no": room_no,
            "building_name": building_name,

            # Assignment/lifecycle
            "assign_date": assign_date,
            "status": status,

            # Details
            "desc": desc,
            "remarks": remarks,

            # Verification
            "verification_date": verification_date or "",
            "verified": bool(verified),
            "verified_by": verified_by,

            # Org
            "institute": institute,
            "department": department,

            # Assignment
            "assigned_type": assigned_type,
            "assigned_faculty_name": assigned_faculty_name if assigned_type == "individual" else "",
            "employee_code": employee_code if assigned_type == "individual" else "",

            # Procurement
            "bill_no": bill_no,
            "vendor_name": vendor_name,
            "purchase_date": purchase_date,
            "rate_per_unit": rate_per_unit,
            "po_no": po_no,

            # Physical/specs
            "size_lxwxh": size_lxwxh,
            "company_model": company_model,
            "it_serial_no": it_serial_no,
            "dead_stock_no": dead_stock_no,

            "created_at": now_ts,
        }
        docs.append(doc)

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
    """
    Compatibility: forward POST /api/assets to the bulk asset creator so this
    endpoint supports the same fields and behavior as /api/assets/bulk.
    """
    return create_assets_bulk()



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


@app.route("/api/assets/update-by-registration/<path:registration_number>", methods=["PUT"])
@require_auth
def update_asset_by_reg(registration_number):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No update data provided"}), 400

        # Update the asset
        updated_asset = update_asset_by_registration(registration_number, data)
        
        if not updated_asset:
            return jsonify({"error": f"Asset with registration number {registration_number} not found"}), 404
            
        return jsonify(updated_asset)
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route("/api/assets/<id>", methods=["PUT"])
@require_role("Super_Admin", "Admin","Verifier")
def update_asset(id):
    try:
        oid = ObjectId(id)
    except Exception:
        return jsonify({"error": "Invalid id"}), 400

    data = request.get_json(silent=True) or {}
    allowed = [
        # Core identity / org
        "asset_name", "category", "institute", "department",
        # Placement
        #"location",
        # Lifecycle
        "assign_date", "status",
        # Description + remarks
        "desc", "remarks",
        # Verification
        "verification_date", "verified", "verified_by",
        # Assignment
        "assigned_type", "assigned_faculty_name", "employee_code",
        # Procurement
        "bill_no", "vendor_name", "purchase_date", "rate_per_unit", "po_no",
        # Physical/specs
        "size_lxwxh", "company_model", "it_serial_no", "dead_stock_no",
        # Room/building
        "room_no", "building_name",
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





#-------------------------------------------------------------
# @app.route("/api/qr/bulk", methods=["POST"])
# @require_role("Super_Admin", "Admin")
# def qr_bulk():
#     body = request.get_json(silent=True) or {}
#     institute = (body.get("institute") or body.get("college") or "").strip()
#     department = (body.get("department") or "").strip()
#     try:
#         quantity = int(body.get("quantity") or body.get("count") or 1)
#     except Exception:
#         return jsonify({"error": "quantity must be an integer"}), 400

#     if not institute or not department:
#         return jsonify({"error": "institute and department are required"}), 400
#     if quantity < 1 or quantity > 2000:
#         return jsonify({"error": "quantity must be between 1 and 2000"}), 400

#     inst = sanitize_token(institute).upper()
#     dept = sanitize_token(department).upper()
#     stamp = qr_timestamp_str()

#     results = []
#     now_ts = int(time.time())
#     for seq in range(1, quantity + 1):
#         attempts = 0
#         doc = None
#         while attempts < 8:
#             serial_no = next_serial_for_institute(inst)
#             qr_id = f"{inst}/{dept}/{stamp}/{seq:04d}"
#             candidate = {
#                 "qr_id": qr_id,
#                 "serial_no": serial_no,
#                 "institute": inst,
#                 "department": dept,
#                 "ts": stamp,
#                 "created_at": now_ts,
#                 "used": False,
#                 "linked_at": None,
#             }
#             try:
#                 res = qr_registry.insert_one(candidate)
#                 candidate["_id"] = str(res.inserted_id)
#                 doc = candidate
#                 break
#             except Exception as e:
#                 msg = str(e).lower()
#                 if "duplicate key" in msg:
#                     if qr_registry.find_one({"qr_id": qr_id}, {"_id": 1}):
#                         stamp = qr_timestamp_str()
#                     attempts += 1
#                     continue
#                 return jsonify({"error": "Failed to create QR entries"}), 500
#         if not doc:
#             return jsonify({"error": "Could not allocate unique identifiers"}), 500
#         results.append(doc)

#     # AUDIT
#     sample_qr = [r["qr_id"] for r in results[:50]]
#     audit_log(
#         audit, request, request.user, "qr.bulk_create",
#         resource={"type":"QR"}, changes={"after":{"count": len(results), "sample_qr_id": sample_qr}},
#         ok=True, status=201, institute=inst, department=dept
#     )

#     return jsonify({"count": len(results), "items": results}), 201




#--------------
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
    try:
        # ensure 'assets' is a valid collection object
        doc = assets.find_one({"serial_no": {"$exists": True}}, sort=[("serial_no", -1)])
        max_serial = int(doc["serial_no"]) if doc and "serial_no" in doc else 0
        return jsonify({"next_serial": max_serial + 1}), 200
    except Exception as e:
        app.logger.exception("Error computing max serial")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/assets/bulk-update-by-serial", methods=["POST"])
def bulk_update_by_serial():
    updates = request.get_json(silent=True) or []
    allowed_fields = [
        "qr_id", "institute", "department", "ts", "used", "linked_at", "registration_number",
        "asset_name", "category", "location", "assign_date", "status", "desc",
        "verification_date", "verified", "verified_by", "assigned_type", "assigned_faculty_name","employee_code","bill_no"
    ]
    results = []
    qr_registry = db["QrRegistry"]

    for u in updates:
        serial_no = u.get("serial_no")
        serial_no = str(serial_no).replace('\uFEFF', '').strip() if serial_no else None
        verified_by = (u.get("verified_by") or "").strip()
        if not serial_no or not verified_by:
            results.append({
                "serial_no": serial_no,
                "matched": 0,
                "modified": 0,
                "skipped": True,
                "reason": "Missing serial_no or verified_by"
            })
            continue  # Skip rows without serial_no or verified_by

        # Build update_fields (permitted fields except ones to overwrite)
        update_fields = {k: u[k] for k in allowed_fields if k in u and k != "serial_no" and k != "verified_by" and k != "used"}

        update_fields["used"] = True
        update_fields["verified_by"] = verified_by
        update_fields["verified"] = True
        update_fields["linked_at"] = int(time.time())
        update_fields["verification_date"] = datetime.now().strftime("%Y-%m-%d")
        
        # Auto-fill assign_date if missing/blank
        assign_date = u.get("assign_date")
        if not assign_date or str(assign_date).strip() == "":
            assign_date = datetime.now().strftime("%Y-%m-%d")
        update_fields["assign_date"] = assign_date

        matched, modified = 0, 0

        # Update in Assets collection
        asset_result = assets.update_one(
            {"serial_no": serial_no}, {"$set": update_fields}
        )
        matched += asset_result.matched_count
        modified += asset_result.modified_count

        # Also update in QrRegistry if needed:
        qr_result = qr_registry.update_one(
            {"serial_no": serial_no}, {"$set": update_fields}
        )
        matched += qr_result.matched_count
        modified += qr_result.modified_count

        results.append({
            "serial_no": serial_no,
            "matched": matched,
            "modified": modified,
            "skipped": False
        })
    return jsonify({"updated": results}), 200


@app.route('/api/assets/single-import', methods=['POST'])
def import_excel_single():
    asset_data = request.get_json(silent=True) or {}
    print('DEBUG: Received asset_data:', asset_data)

    serial_no = asset_data.get("serial_no")
    try:
        serial_no = int(str(serial_no).replace('\uFEFF', '').strip()) if serial_no is not None else None
    except ValueError:
        serial_no = None
    verified_by = (asset_data.get("verified_by") or "").strip()
    print('DEBUG: serial_no:', serial_no)
    print('DEBUG: verified_by:', verified_by)

    if not serial_no or not verified_by:
        return jsonify({"skipped": True, "reason": "Missing serial_no or verified_by"}), 200

    # Standardize/auto-fill assign_date if needed
    assign_date = asset_data.get("assign_date")
    if not assign_date or str(assign_date).strip() == "":
        assign_date = datetime.now().strftime("%Y-%m-%d")
    verification_date = datetime.now().strftime("%Y-%m-%d")

    # Prepare update fields, excluding keys we'll overwrite
    allowed_fields = [
        "registration_number", "asset_name", "category", "location", "assign_date",
        "status", "desc", "verification_date", "verified", "verified_by",
        "institute", "department", "assigned_type", "assigned_faculty_name","employee_code","bill_no"
    ]
    update_fields = {k: asset_data[k] for k in allowed_fields if k in asset_data and k not in ["serial_no", "verified_by"]}
    # System-controlled fields:
    update_fields["assign_date"] = assign_date
    update_fields["verified_by"] = verified_by
    update_fields["verified"] = True
    update_fields["verification_date"] = verification_date

    result = assets.update_one({"serial_no": serial_no}, {"$set": update_fields})
    print('DEBUG: update_one matched:', result.matched_count, 'modified:', result.modified_count)
    return jsonify({"serial_no": serial_no, "updated": bool(result.modified_count), "skipped": False}), 200

# ---------------- Graph Analytics API ----------------
# ==================== GRAPH ANALYTICS ENDPOINTS ====================

@app.route('/api/assets/filter-options', methods=['GET'])
@require_role("Super_Admin", "Admin", "Faculty", "Verifier")
def get_filter_options():
    """
    Get unique values for filter dropdowns
    Returns distinct values for all filterable fields
    """
    try:
        # Get distinct values for each filter field
        institutes = assets.distinct('institute')
        departments = assets.distinct('department')
        categories = assets.distinct('category')
        statuses = assets.distinct('status')
        asset_names = assets.distinct('asset_name')
        assigned_types = assets.distinct('assigned_type')
        locations = assets.distinct('location')
        
        # Filter out None, empty strings, and sort
        institutes = sorted([i for i in institutes if i and i.strip()])
        departments = sorted([d for d in departments if d and d.strip()])
        categories = sorted([c for c in categories if c and c.strip()])
        statuses = sorted([s for s in statuses if s and s.strip()])
        asset_names = sorted([a for a in asset_names if a and a.strip()])
        assigned_types = sorted([t for t in assigned_types if t and t.strip()])
        locations = sorted([l for l in locations if l and l.strip()])
        
        return jsonify({
            'success': True,
            'institutes': institutes,
            'departments': departments,
            'categories': categories,
            'statuses': statuses,
            'asset_names': asset_names,
            'assigned_types': assigned_types,
            'locations': locations
        }), 200
        
    except Exception as e:
        print(f"Error fetching filter options: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to fetch filter options'
        }), 500


@app.route('/api/assets/stats', methods=['GET'])
@require_role("Super_Admin", "Admin")
def get_asset_stats():
    """
    Get aggregated asset statistics for graph visualization
    Supports filters: institute, department, category, status, asset_name, assigned_type, location
    """
    # Get filter parameters
    institute = (request.args.get('institute') or '').strip()
    department = (request.args.get('department') or '').strip()
    category = (request.args.get('category') or '').strip()
    status = (request.args.get('status') or '').strip()
    asset_name = (request.args.get('asset_name') or '').strip()
    assigned_type = (request.args.get('assigned_type') or '').strip()
    location = (request.args.get('location') or '').strip()
    
    # Build match stage for MongoDB aggregation
    match_stage = {}
    if institute:
        match_stage['institute'] = institute
    if department:
        match_stage['department'] = department
    if category:
        match_stage['category'] = category
    if status:
        match_stage['status'] = status
    if asset_name:
        match_stage['asset_name'] = asset_name
    if assigned_type:
        match_stage['assigned_type'] = assigned_type
    if location:
        match_stage['location'] = location
    
    try:
        # 1. Total asset count
        total_assets = assets.count_documents(match_stage)
        
        # 2. Assets grouped by Category
        by_category = list(assets.aggregate([
            {'$match': match_stage},
            {'$group': {'_id': '$category', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]))
        
        # 3. Assets grouped by Status
        by_status = list(assets.aggregate([
            {'$match': match_stage},
            {'$group': {'_id': '$status', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]))
        
        # 4. Assets grouped by Department
        by_department = list(assets.aggregate([
            {'$match': match_stage},
            {'$group': {'_id': '$department', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]))
        
        # 5. Assets grouped by Institute
        by_institute = list(assets.aggregate([
            {'$match': match_stage},
            {'$group': {'_id': '$institute', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]))
        
        # 6. Assets grouped by Location (top 10)
        by_location = list(assets.aggregate([
            {'$match': match_stage},
            {'$group': {'_id': '$location', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]))
        
        # 7. Verified vs Unverified count
        verified_count = assets.count_documents({**match_stage, 'verified': True})
        unverified_count = assets.count_documents({**match_stage, 'verified': {'$ne': True}})
        
        # 8. FIXED: Assets by Assigned Type - ONLY for SINGLE assets (without serial_no)
        by_assigned_type = list(assets.aggregate([
            {'$match': match_stage},
            {'$group': {'_id': '$assigned_type', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]))


        # Assets grouped by asset_name (e.g., Chair, Table, etc.)
        by_asset = list(assets.aggregate([
            {'$match': match_stage},
            {'$group': {'_id': '$asset_name', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]))

        
        # 9. SIMPLIFIED: Total assets added per date (no single/bulk breakdown)
        try:
            assets_by_date = list(assets.aggregate([
                {'$match': match_stage},
                {
                    '$project': {
                        'date': {
                            '$cond': {
                                # Check if assign_date exists and is not empty
                                'if': {'$and': [
                                    {'$ne': [{'$type': '$assign_date'}, 'missing']},
                                    {'$ne': ['$assign_date', '']},
                                    {'$ne': ['$assign_date', None]}
                                ]},
                                'then': '$assign_date',  # Use assign_date directly (YYYY-MM-DD format)
                                'else': '1970-01-01'  # Default date for assets without assign_date
                            }
                        }
                    }
                },
                # Filter out default dates
                {'$match': {'date': {'$ne': '1970-01-01'}}},
                {
                    '$group': {
                        '_id': '$date',  # Group only by date, not by type
                        'count': {'$sum': 1}
                    }
                },
                {'$sort': {'_id': 1}}  # Sort by date ascending
            ]))
        except Exception as date_error:
            print(f"Error in assets_by_date aggregation: {date_error}")
            import traceback
            traceback.print_exc()
            assets_by_date = []
        
        # AUDIT
        # AUDIT - With filter information in resource dictionary
        audit_log(
            audit, 
            request, 
            request.user, 
            "stats.view",
            resource={
                "type": "Stats",
                "filters": {
                    "institute": institute or None,
                    "department": department or None,
                    "category": category or None,
                    "status": status or None,
                    "asset_name": asset_name or None,
                    "assigned_type": assigned_type or None,
                    "location": location or None
                }
            },
            ok=True, 
            status=200
        )


        
        return jsonify({
            'success': True,
            'by_category': by_category,
            'by_asset': by_asset
        }), 200

        
    except Exception as e:
        print(f"Error fetching stats: {e}")
        import traceback
        traceback.print_exc()
        audit_log(
            audit, request, request.user, "stats.view",
            ok=False, status=500, error=str(e)
        )
        return jsonify({'success': False, 'error': 'Failed to fetch statistics'}), 500


@app.route('/api/assets/bulk-stats', methods=['GET'])
@require_role("Super_Admin", "Admin")
def get_bulk_asset_stats():
    """
    Get aggregated statistics for BULK QR codes from QrRegistry collection
    Key metric: Linked (used=true) vs Not Linked (used=false)
    """
    # Get filter parameters
    institute = (request.args.get('institute') or '').strip()
    department = (request.args.get('department') or '').strip()
    
    # Build match stage for QrRegistry collection
    match_stage = {}
    
    if institute:
        match_stage['institute'] = institute
    if department:
        match_stage['department'] = department
    
    try:
        # Access QrRegistry collection
        qr_registry = db['QrRegistry']
        
        # 1. Total QR codes count
        total_qr_codes = qr_registry.count_documents(match_stage)
        
        # 2. Linked (used=true) vs Not Linked (used=false) count
        linked_count = qr_registry.count_documents({
            **match_stage,
            'used': True
        })
        
        not_linked_count = qr_registry.count_documents({
            **match_stage,
            'used': False
        })
        
        # 3. QR codes grouped by Institute
        by_institute = list(qr_registry.aggregate([
            {'$match': match_stage},
            {'$group': {'_id': '$institute', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]))
        
        # 4. QR codes grouped by Department
        by_department = list(qr_registry.aggregate([
            {'$match': match_stage},
            {'$group': {'_id': '$department', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]))
        
        # 5. QR codes by creation date (using created_at timestamp)
        try:
            qr_by_date = list(qr_registry.aggregate([
                {'$match': match_stage},
                {
                    '$project': {
                        'date': {
                            '$dateToString': {
                                'format': '%Y-%m-%d',
                                'date': {'$toDate': {'$multiply': ['$created_at', 1000]}}
                            }
                        }
                    }
                },
                {
                    '$group': {
                        '_id': '$date',
                        'count': {'$sum': 1}
                    }
                },
                {'$sort': {'_id': 1}}
            ]))
        except Exception as date_error:
            print(f"Error in qr_by_date aggregation: {date_error}")
            import traceback
            traceback.print_exc()
            qr_by_date = []
        
        # 6. Link status (Linked/Not Linked) by Institute
        link_status_by_institute = list(qr_registry.aggregate([
            {'$match': match_stage},
            {
                '$project': {
                    'institute': 1,
                    'link_status': {
                        '$cond': {
                            'if': {'$eq': ['$used', True]},
                            'then': 'Linked',
                            'else': 'Not Linked'
                        }
                    }
                }
            },
            {
                '$group': {
                    '_id': {
                        'institute': '$institute',
                        'status': '$link_status'
                    },
                    'count': {'$sum': 1}
                }
            },
            {'$sort': {'_id.institute': 1, '_id.status': 1}}
        ]))
        
        # 7. For linked QR codes, get category breakdown from Assets collection
        # Get all linked QR IDs
        linked_qrs = list(qr_registry.find({**match_stage, 'used': True}, {'qr_id': 1}))
        linked_qr_ids = [qr['qr_id'] for qr in linked_qrs]
        
        # Query Assets collection for these QR IDs to get categories
        by_category = []
        if linked_qr_ids:
            by_category = list(assets.aggregate([
                {'$match': {'qr_id': {'$in': linked_qr_ids}}},
                {'$group': {'_id': '$category', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}}
            ]))
        
        print(f"Bulk Stats Summary:")
        print(f"  Total QR Codes: {total_qr_codes}")
        print(f"  Linked: {linked_count}")
        print(f"  Not Linked: {not_linked_count}")
        print(f"  By Institute: {by_institute}")
        print(f"  By Department: {by_department}")
        print(f"  By Category (linked only): {by_category}")
        
        # AUDIT
        audit_log(
            audit, 
            request, 
            request.user, 
            "bulk_stats.view",
            resource={"type": "BulkStats"},
            ok=True, 
            status=200
        )
        
        return jsonify({
            'success': True,
            'total_bulk_assets': total_qr_codes,
            'linked_count': linked_count,
            'not_linked_count': not_linked_count,
            'link_status': {
                'linked': linked_count,
                'not_linked': not_linked_count
            },
            'by_institute': by_institute,
            'by_department': by_department,
            'by_category': by_category,
            'assets_by_date': qr_by_date,
            'link_status_by_institute': link_status_by_institute
        }), 200
        
    except Exception as e:
        print(f"Error fetching bulk stats from QrRegistry: {e}")
        import traceback
        traceback.print_exc()
        audit_log(
            audit, request, request.user, "bulk_stats.view",
            ok=False, status=500, error=str(e)
        )
        return jsonify({'success': False, 'error': 'Failed to fetch bulk QR statistics'}), 500

# MASTER_COLLECTIONS = {
#     'asset-names': db.asset_names,
#     'institutes': db.institutes,
#     'departments': db.departments
# }











# NEW APPROACH: Single master document in "OtherInfo" collection
MASTER_DOC_FILTER = {"type": "master"}  # single master record in OtherInfo

# 1) Add Asset Name + Category pair (stores as "Name:Category" => 1)
@app.post("/api/setup/asset-names")
def add_asset_name_with_category():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    category = (data.get("category") or "").strip()
    if not name or not category:
        return jsonify({"error": "Both 'name' and 'category' are required"}), 400

    pair_key = f"{name}:{category}"
    update = {"$set": {f"Asset_NameCategory.{pair_key}": 1}}
    info.find_one_and_update(
        MASTER_DOC_FILTER, update, upsert=True, return_document=ReturnDocument.AFTER
    )
    return jsonify({"ok": True, "saved": pair_key}), 200

# 2) Add Institute (unique)
@app.post("/api/setup/institutes")
def add_institute():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "'name' is required"}), 400
    info.update_one(MASTER_DOC_FILTER, {"$addToSet": {"Institutes": name}}, upsert=True)
    return jsonify({"ok": True, "saved": name}), 200

# 3) Add Department (unique)
@app.post("/api/setup/departments")
def add_department():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "'name' is required"}), 400
    info.update_one(MASTER_DOC_FILTER, {"$addToSet": {"Departments": name}}, upsert=True)
    return jsonify({"ok": True, "saved": name}), 200



@app.get("/api/setup/asset-names")
def list_asset_name_category():
    doc = info.find_one(MASTER_DOC_FILTER, {"_id": 0, "Asset_NameCategory": 1}) or {}
    kv = doc.get("Asset_NameCategory", {})
    return jsonify(sorted(kv.keys())), 200

@app.get("/api/setup/institutes")
def list_institutes():
    doc = info.find_one(MASTER_DOC_FILTER, {"_id": 0, "Institutes": 1}) or {}
    return jsonify(sorted(doc.get("Institutes", []))), 200

@app.get("/api/setup/departments")
def list_departments():
    doc = info.find_one(MASTER_DOC_FILTER, {"_id": 0, "Departments": 1}) or {}
    return jsonify(sorted(doc.get("Departments", []))), 200




from urllib.parse import unquote

@app.delete("/api/setup/asset-names/<path:key>")
def delete_asset_pair(key):
    # key will be URL-encoded e.g., "Mouse%3AElectronics"
    decoded = unquote(key)
    info.update_one(MASTER_DOC_FILTER, {"$unset": {f"Asset_NameCategory.{decoded}": ""}}, upsert=True)
    return jsonify({"ok": True, "deleted": decoded}), 200

@app.delete("/api/setup/institutes/<path:value>")
def delete_institute(value):
    info.update_one(MASTER_DOC_FILTER, {"$pull": {"Institutes": value}})
    return jsonify({"ok": True, "deleted": value}), 200

@app.delete("/api/setup/departments/<path:value>")
def delete_department(value):
    info.update_one(MASTER_DOC_FILTER, {"$pull": {"Departments": value}})
    return jsonify({"ok": True, "deleted": value}), 200

# Correct: get the collection object from the database
def get_users_collection():
    return db[USER_COLLECTION]


from bson import ObjectId

def mongo_to_json(doc):
    """Convert _id to string in a MongoDB document or list."""
    if isinstance(doc, list):
        return [mongo_to_json(d) for d in doc]
    doc = dict(doc)
    if '_id' in doc and isinstance(doc['_id'], ObjectId):
        doc['_id'] = str(doc['_id'])
    return doc    


@app.route('/api/users', methods=['GET'])
@require_role('Super_Admin')
def list_users():
    users_collection = db[USER_COLLECTION]
    role = request.args.get('role')
    query = {}
    if role:
        query['role'] = role
    users = list(users_collection.find(query, {'password': 0}))
    users = mongo_to_json(users)            # <-- Fix: Make _id serializable
    counts = list(users_collection.aggregate([
        {'$group': {'_id': '$role', 'count': {'$sum': 1}}}
    ]))
    # Optionally process counts for _id as string, too.
    for c in counts:
        c['_id'] = str(c['_id'])
    return jsonify({
        'success': True,
        'users': users,
        'counts': counts
    })


from flask import jsonify

@app.route('/api/users/<user_id>', methods=['DELETE', 'OPTIONS'])
def delete_user(user_id):
    if request.method == 'OPTIONS':
        return ('', 204)
    users_collection = db[USER_COLLECTION]
    try:
        result = users_collection.delete_one({'_id': ObjectId(user_id)})
        if result.deleted_count == 1:
            return jsonify({'success': True}), 200
        else:
            return jsonify({'success': False, 'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
from werkzeug.security import generate_password_hash, check_password_hash

@app.route('/api/users/<user_id>/reset-password', methods=['POST', 'OPTIONS'])
def reset_user_password(user_id):
    if request.method == 'OPTIONS':
        return ('', 204)

    new_pw = request.json.get('password')
    if not new_pw or len(new_pw) < 5:
        return jsonify({'success': False, 'error': 'Invalid password'}), 400

    # ✅ Use the same hash function as signup
    try:
        hashed_pw = hash_password(new_pw)   # same as used in signup()
    except Exception as e:
        return jsonify({'success': False, 'error': f'Password hashing failed: {str(e)}'}), 500

    users_collection = db[USER_COLLECTION]
    result = users_collection.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'password': hashed_pw}}
    )

    if result.modified_count == 1:
        return jsonify({'success': True, 'message': 'Password updated successfully'})
    else:
        return jsonify({'success': False, 'error': 'User not found'}), 404



# ---------------- Run ----------------

@app.route("/download/sample-report", methods=["GET"])
def download_sample_report():
    """Serve the sample Excel file located in frontend/resource/sample_report.xlsx

    This endpoint returns the file as an attachment so the browser will download it.
    """
    # Compute absolute path relative to backend directory
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "resource"))
    filename = "sample_report.xlsx"
    filepath = os.path.join(base_dir, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "Sample file not found"}), 404
    try:
        return send_file(filepath, as_attachment=True, attachment_filename=filename)
    except TypeError:
        # For newer Flask versions use download_name
        return send_file(filepath, as_attachment=True, download_name=filename)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("BACKEND_PORT", 5000)), debug=True)
