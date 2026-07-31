#!/usr/bin/env python3
"""
Import legacy reps + providers into the current portal schema.

Reads data/Registered Providers.csv + data/All Orders.csv.
- Reps come from All Orders `RequestedbyEmail` (davie/jordan active; casey/keric
  suspended = data only). Rep of a provider = who ordered most for that practice.
- Providers with no order history -> HOUSE ACCOUNTS owned by admin Robert
  (admins see all via RLS; no rep sees them).
- Missing NPI -> 0000000000 placeholder (admin fills real one before ordering).

Dry-run by default. Pass --commit to write. Idempotent by email / practice name.
"""
import csv, re, sys, json, secrets, urllib.request

SUPABASE_URL = "https://lqrrmlmeagpgwlyijeyd.supabase.co"
SERVICE_KEY = sys.argv[sys.argv.index("--key") + 1] if "--key" in sys.argv else None
COMMIT = "--commit" in sys.argv
ROBERT_ID = "6634d855-e406-47be-800a-8c470eb23806"  # house-account owner (admin)

REPS = {
    "davie@agilemedgroup.com":  {"name": "Davie Wilden",  "status": "active"},
    "jordan@agilemedgroup.com": {"name": "Jordan Adams",  "status": "active"},
    "casey@agilemedgroup.com":  {"name": "Casey",         "status": "suspended"},
    "keric@agilemedgroup.com":  {"name": "Keric",         "status": "suspended"},
}

def norm(s): return re.sub(r"[^a-z0-9]", "", (s or "").lower())

def api(method, path, body=None, auth=True):
    url = f"{SUPABASE_URL}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", SERVICE_KEY)
    req.add_header("Authorization", f"Bearer {SERVICE_KEY}")
    req.add_header("Content-Type", "application/json")
    if method in ("POST", "PATCH"):
        req.add_header("Prefer", "return=representation")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or "null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]

def parse_provider(name):
    """'Joshua Wilensky, MD' -> (first, last, credentials)."""
    name = (name or "").strip()
    if not name:
        return "Unknown", "Provider", None
    cred = None
    if "," in name:
        nm, cred = name.split(",", 1)
        nm, cred = nm.strip(), cred.strip() or None
    else:
        nm = name
    toks = [t for t in re.split(r"\s+", nm) if t]
    if len(toks) == 1:
        return toks[0], "-", cred
    return toks[0], toks[-1], cred

def parse_address(addr):
    """Best-effort single-line -> (line1, city, state, zip)."""
    addr = (addr or "").strip()
    m = re.search(r"([A-Za-z]{2})[,\s]+(\d{5})(?:-\d{4})?\s*$", addr)
    if not m:
        return (addr or "Unknown"), "Unknown", "NA", "00000"
    state, zc = m.group(1).upper(), m.group(2)
    rest = addr[: m.start()].rstrip(" ,")
    parts = [p.strip() for p in rest.split(",") if p.strip()]
    if len(parts) >= 2:
        city = parts[-1]
        line1 = ", ".join(parts[:-1])
    else:
        city, line1 = "Unknown", rest or "Unknown"
    return line1, city, state, zc

def main():
    prov = list(csv.DictReader(open("data/Registered Providers.csv")))
    orders = list(csv.DictReader(open("data/All Orders.csv")))

    # practice -> {rep_email: count}
    p2rep = {}
    for o in orders:
        pn = norm(o.get("Practice Name"))
        e = (o.get("RequestedbyEmail") or "").strip().lower()
        if pn and e:
            p2rep.setdefault(pn, {}).setdefault(e, 0)
            p2rep[pn][e] += 1

    # Resolve rep ids
    rep_ids, creds = {}, {}
    print("=== REPS ===")
    for email, meta in REPS.items():
        if COMMIT:
            pw = secrets.token_urlsafe(12) if meta["status"] == "active" else secrets.token_urlsafe(24)
            st, u = api("POST", "/auth/v1/admin/users",
                        {"email": email, "password": pw, "email_confirm": True})
            if isinstance(u, dict) and u.get("id"):
                uid = u["id"]
            else:  # already exists — look it up
                _, lst = api("GET", f"/auth/v1/admin/users?email={email}")
                uid = (lst.get("users") or [{}])[0].get("id") if isinstance(lst, dict) else None
            api("POST", "/rest/v1/profiles",
                {"id": uid, "role": "rep", "status": meta["status"],
                 "display_name": meta["name"], "email": email})
            api("POST", "/rest/v1/rep_details", {"profile_id": uid})
            rep_ids[email] = uid
            if meta["status"] == "active":
                creds[email] = pw
        print(f"  {meta['status']:10} {meta['name']:14} {email}")

    print("\n=== PROVIDERS ===")
    house = matched = 0
    for r in prov:
        pn = norm(r.get("Practice Name"))
        reps = p2rep.get(pn)
        if reps:
            rep_email = max(reps, key=reps.get)
            rep_id = rep_ids.get(rep_email, ROBERT_ID)
            owner = rep_email.split("@")[0]
            matched += 1
        else:
            rep_id, owner = ROBERT_ID, "HOUSE"
            house += 1
        first, last, cred = parse_provider(r.get("Practice Provider"))
        line1, city, state, zc = parse_address(r.get("Location Address"))
        approved = (r.get("Approve/Reject") or "").strip().lower() == "approved"
        row = {
            "rep_id": rep_id, "practice_name": r.get("Practice Name"),
            "address_line1": line1, "city": city, "state": state, "zip": zc,
            "provider_first": first, "provider_last": last, "credentials": cred,
            "individual_npi": "0000000000",
            "contact_name": (r.get("Contact Name") or "").strip() or None,
            "contact_email": (r.get("Contact Email") or "").strip() or None,
            "contact_phone": (r.get("Contact Phone Number") or "").strip() or None,
            "approved": approved, "created_by": ROBERT_ID,
            **({"approved_by": ROBERT_ID, "approved_at": "2026-07-29T00:00:00Z"} if approved else {}),
        }
        print(f"  {owner:8} appr={str(approved):5} {r.get('Practice Name')[:34]:34} | {first} {last} | {city},{state} {zc}")
        if COMMIT:
            st, resp = api("POST", "/rest/v1/providers", row)
            if st >= 300:
                print(f"      !! insert failed {st}: {resp}")

    print(f"\nSUMMARY: reps={len(REPS)} providers={len(prov)} matched_to_rep={matched} house_accounts={house}")
    if COMMIT and creds:
        print("\n=== ACTIVE REP TEMP PASSWORDS (give to each; they change on first login) ===")
        for e, pw in creds.items():
            print(f"  {e}: {pw}")
    if not COMMIT:
        print("\n(DRY RUN — no writes. Re-run with --commit to apply.)")

if __name__ == "__main__":
    main()
