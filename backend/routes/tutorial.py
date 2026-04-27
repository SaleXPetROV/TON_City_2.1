"""
Tutorial Routes
===============
Endpoints for the interactive sandbox tutorial.

All endpoints are under /api/tutorial/* and are always allowed (even during tutorial).
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from pydantic import BaseModel, Field

from tutorial_steps import (
    TUTORIAL_STEPS,
    STEP_BY_ID,
    TUTORIAL_STEP_IDS,
    TOTAL_STEPS,
    get_step,
    get_next_step,
    get_step_by_index,
)
from ton_island import generate_ton_island_map

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


# ------------- Request models -------------
class AdvanceRequest(BaseModel):
    step_id: str
    # Optional: client's claim of what it did; server still enforces gates.
    reason: Optional[str] = None


class FakeBuyPlotRequest(BaseModel):
    x: int
    y: int
    zone: Optional[str] = "outskirts"
    business_icon: Optional[str] = None
    business_name: Optional[str] = None


class FakeGrantResourceRequest(BaseModel):
    resource_type: str = "neuro_core"
    amount: int = 10


class FinishRequest(BaseModel):
    confirm: bool = True


class CreateLotRequest(BaseModel):
    resource_type: str = "neuro_core"
    amount: int = 5
    price_per_unit: float = 1.0


# ------------- Helpers -------------
def _now():
    return datetime.now(timezone.utc).isoformat()


def _serialize_user(user_doc: Dict[str, Any]) -> Dict[str, Any]:
    d = dict(user_doc)
    d.pop("_id", None)
    d.pop("hashed_password", None)
    d.pop("password_hash", None)
    d.pop("two_factor_secret", None)
    return d


def _make_snapshot(user_doc: Dict[str, Any]) -> Dict[str, Any]:
    """Copy fields that may be mutated during tutorial, for later restore."""
    return {
        "balance_ton": user_doc.get("balance_ton", 0.0),
        "resources": dict(user_doc.get("resources", {}) or {}),
        "active_resource_buffs": list(user_doc.get("active_resource_buffs", []) or []),
        "level": user_doc.get("level", 1),
        "xp": user_doc.get("xp", 0),
        "total_turnover": user_doc.get("total_turnover", 0.0),
        "total_income": user_doc.get("total_income", 0.0),
        "plots_owned": list(user_doc.get("plots_owned", []) or []),
        "businesses_owned": list(user_doc.get("businesses_owned", []) or []),
    }


def create_tutorial_router(db, secret_key: str, algorithm: str = "HS256") -> APIRouter:
    """Factory for the tutorial router."""
    router = APIRouter(prefix="/api/tutorial", tags=["tutorial"])

    async def _get_user(credentials: Optional[HTTPAuthorizationCredentials]) -> Dict[str, Any]:
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        try:
            payload = jwt.decode(credentials.credentials, secret_key, algorithms=[algorithm])
            identifier = payload.get("sub")
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")
        if not identifier:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_doc = await db.users.find_one({
            "$or": [
                {"wallet_address": identifier},
                {"email": identifier},
                {"username": identifier},
            ]
        })
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        return user_doc

    def _user_filter(user_doc: Dict[str, Any]) -> Dict[str, Any]:
        if user_doc.get("id"):
            return {"id": user_doc["id"]}
        if user_doc.get("email"):
            return {"email": user_doc["email"]}
        if user_doc.get("wallet_address"):
            return {"wallet_address": user_doc["wallet_address"]}
        return {"_id": user_doc["_id"]}

    # -----------------------------------
    # GET /api/tutorial/status
    # -----------------------------------
    @router.get("/status")
    async def tutorial_status(credentials: HTTPAuthorizationCredentials = Depends(security)):
        user = await _get_user(credentials)
        active = bool(user.get("tutorial_active"))
        current_step_id = user.get("tutorial_current_step") or "welcome"
        step = get_step(current_step_id) if active else None
        completed = bool(user.get("tutorial_completed"))
        state = user.get("tutorial_state") or {"fake_plots": [], "fake_resources": {}, "fake_lot_id": None}
        return {
            "active": active,
            "completed": completed,
            "current_step_id": current_step_id if active else None,
            "current_step": step,
            "total_steps": TOTAL_STEPS,
            "step_ids": TUTORIAL_STEP_IDS,
            "steps": TUTORIAL_STEPS,
            "state": state,
        }

    # -----------------------------------
    # POST /api/tutorial/start
    # -----------------------------------
    @router.post("/start")
    async def tutorial_start(credentials: HTTPAuthorizationCredentials = Depends(security)):
        user = await _get_user(credentials)
        if user.get("tutorial_active"):
            return {
                "ok": True,
                "already_active": True,
                "current_step_id": user.get("tutorial_current_step") or "welcome",
            }
        snapshot = _make_snapshot(user)
        # Pick a deterministic tutorial plot — a free cell that's pre-assigned to
        # the `helios` business. The user is restricted to buying *this* cell
        # during the `fake_buy_plot` step.
        tutorial_plot = None
        try:
            island = generate_ton_island_map()
            for c in island.get("cells", []):
                if c.get("pre_business") == "helios" and not c.get("owner") and not c.get("is_empty"):
                    tutorial_plot = {"x": c["x"], "y": c["y"], "zone": c.get("zone", "outer")}
                    break
        except Exception as e:
            logger.warning(f"Tutorial: could not pick helios plot: {e}")
        if not tutorial_plot:
            # Safe fallback — any reasonable inner-zone coords (will still be
            # validated against the live map by the buy endpoint).
            tutorial_plot = {"x": 16, "y": 16, "zone": "core"}

        initial_state = {
            "fake_plots": [],
            "fake_resources": {},
            "fake_lot_id": None,
            "tutorial_plot": tutorial_plot,
        }
        # Tutorial gives the user exactly 50 TON to play with (≈ 50 000 $CITY).
        # Real balance is preserved in `tutorial_snapshot.balance_ton` and
        # restored by /finish or /reset.
        TUTORIAL_VIRTUAL_BALANCE = 50.0
        await db.users.update_one(
            _user_filter(user),
            {
                "$set": {
                    "tutorial_active": True,
                    "tutorial_completed": False,
                    "tutorial_current_step": "welcome",
                    "tutorial_started_at": _now(),
                    "tutorial_snapshot": snapshot,
                    "tutorial_state": initial_state,
                    "balance_ton": TUTORIAL_VIRTUAL_BALANCE,
                },
                "$unset": {
                    "tutorial_skipped": "",
                    "tutorial_skipped_at": "",
                    "tutorial_completed_at": "",
                },
            },
        )
        # Seed a hidden tutorial-bot market lot that only this user can see & buy from.
        # It will be consumed by /api/tutorial/buy-lot and cleaned up by /finish.
        uid = user.get("id")
        # Remove any stale seed lots for this user first
        try:
            await db.market_listings.delete_many({
                "tutorial_seed_for": uid,
            })
        except Exception:
            pass
        seed_lot = {
            "id": str(uuid.uuid4()),
            "seller_id": "tutorial_bot",
            "seller_email": None,
            "seller_username": "🤖 Tutorial Bot",
            "business_id": None,
            "resource_type": "neuro_core",
            "amount": 10,
            "price_per_unit": 0.5,
            "total_price": 5.0,
            "status": "active",
            "tutorial": True,
            "tutorial_seed_for": uid,
            "created_at": _now(),
        }
        try:
            await db.market_listings.insert_one(seed_lot.copy())
        except Exception as e:
            logger.warning(f"seed lot insert failed: {e}")
        logger.info(f"Tutorial started for user {user.get('username')}")
        return {
            "ok": True,
            "already_active": False,
            "current_step_id": "welcome",
            "state": initial_state,
        }

    # -----------------------------------
    # POST /api/tutorial/advance
    # -----------------------------------
    @router.post("/advance")
    async def tutorial_advance(
        data: AdvanceRequest,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        user = await _get_user(credentials)
        if not user.get("tutorial_active"):
            raise HTTPException(status_code=400, detail="Tutorial is not active")

        current_id = user.get("tutorial_current_step") or "welcome"
        step = get_step(current_id)
        if not step:
            raise HTTPException(status_code=400, detail="Unknown tutorial step")

        # Only the current step can be advanced (or an optional step skip)
        if data.step_id != current_id:
            raise HTTPException(
                status_code=400,
                detail=f"step_id mismatch: current is {current_id}, got {data.step_id}",
            )

        # Gate checks
        gate = step.get("gate")
        if gate == "db_check" and current_id == "create_lot":
            count = await db.market_listings.count_documents({
                "seller_id": user.get("id"),
                "tutorial": True,
            })
            if count < 1:
                raise HTTPException(
                    status_code=400,
                    detail="tutorial_gate_failed: no tutorial lot found",
                )
        # Other gates (client_ack, page_visit, server_action) are satisfied by the
        # mere fact the client called advance — frontend enforces navigation first.

        # Compute next step id
        if current_id == "finish":
            raise HTTPException(status_code=400, detail="Use /api/tutorial/finish to complete")

        nxt = get_next_step(current_id)
        next_id = nxt["id"] if nxt else "finish"

        # Side-effects when advancing OUT of certain steps.
        # `explain_idle`: gift 50 biomass so the user's Helios actually starts producing.
        # The grant is wiped at /finish or /reset thanks to `tutorial_snapshot.resources`.
        if current_id == "explain_idle":
            await db.users.update_one(
                _user_filter(user),
                {"$inc": {"resources.biomass": 50}},
            )
            # Also push into the storage of the tutorial-flagged Helios business
            # so the in-game Warehouse view immediately shows fuel for the cycle.
            try:
                await db.businesses.update_one(
                    {"owner": user.get("id"), "tutorial": True, "business_type": "helios"},
                    {"$inc": {"storage.items.biomass": 50}},
                )
            except Exception as e:
                logger.warning(f"Tutorial: could not seed business biomass: {e}")

        await db.users.update_one(
            _user_filter(user),
            {"$set": {"tutorial_current_step": next_id}},
        )
        return {"ok": True, "previous_step_id": current_id, "current_step_id": next_id}

    # -----------------------------------
    # POST /api/tutorial/skip  (optional steps only)
    # -----------------------------------
    @router.post("/skip")
    async def tutorial_skip(
        data: AdvanceRequest,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        user = await _get_user(credentials)
        if not user.get("tutorial_active"):
            raise HTTPException(status_code=400, detail="Tutorial is not active")
        current_id = user.get("tutorial_current_step") or "welcome"
        step = get_step(current_id)
        if data.step_id != current_id:
            raise HTTPException(
                status_code=400,
                detail=f"step_id mismatch: current is {current_id}, got {data.step_id}",
            )
        if not step or not step.get("optional"):
            raise HTTPException(status_code=400, detail="This step is not optional")
        nxt = get_next_step(current_id)
        next_id = nxt["id"] if nxt else "finish"
        await db.users.update_one(
            _user_filter(user),
            {"$set": {"tutorial_current_step": next_id}},
        )
        return {"ok": True, "skipped_step_id": current_id, "current_step_id": next_id}

    # -----------------------------------
    # POST /api/tutorial/fake-buy-plot
    # Creates a REAL tutorial business document (tutorial:true) so the user
    # actually sees it on the "My Businesses" page during the tutorial. On
    # finish/reset we delete everything tagged `tutorial:true`.
    # -----------------------------------
    @router.post("/fake-buy-plot")
    async def tutorial_fake_buy_plot(
        data: FakeBuyPlotRequest,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        user = await _get_user(credentials)
        if not user.get("tutorial_active"):
            raise HTTPException(status_code=400, detail="Tutorial is not active")
        if user.get("tutorial_current_step") != "fake_buy_plot":
            raise HTTPException(status_code=400, detail="Not on fake_buy_plot step")

        # Restrict the purchase to the predetermined HELIOS plot only.
        tutorial_plot = (user.get("tutorial_state") or {}).get("tutorial_plot") or {}
        if (tutorial_plot.get("x") is not None and tutorial_plot.get("y") is not None
            and (data.x, data.y) != (tutorial_plot["x"], tutorial_plot["y"])):
            raise HTTPException(
                status_code=400,
                detail="tutorial_only_helios_plot: только подсвеченный участок с HELIOS доступен для покупки во время обучения.",
            )

        uid = user.get("id")
        fake_plots: List[Dict[str, Any]] = list(
            (user.get("tutorial_state") or {}).get("fake_plots", [])
        )
        fake_plots.append({
            "x": data.x,
            "y": data.y,
            "zone": data.zone or "outskirts",
            "business_icon": data.business_icon or "☀️",
            "business_name": data.business_name or "Helios Solar",
            "acquired_at": _now(),
        })

        # Also insert a REAL tutorial business doc so it shows on /my-businesses.
        # We pick `helios` — a simple T1 business with no resource consumption.
        biz_id = str(uuid.uuid4())
        tutorial_biz = {
            "id": biz_id,
            "plot_id": f"tutorial-plot-{uid}",
            "owner": uid,
            "owner_wallet": user.get("wallet_address"),
            "business_type": "helios",
            "level": 1,
            "building_progress": 100,
            "is_active": True,
            "last_collection": _now(),
            "created_at": _now(),
            "durability": 100,
            "storage": {"capacity": 100, "items": {}},
            "tutorial": True,
        }
        try:
            await db.businesses.insert_one(tutorial_biz.copy())
        except Exception as e:
            logger.warning(f"tutorial business insert failed: {e}")

        # Advance step to go_businesses
        nxt = get_next_step("fake_buy_plot")
        next_id = nxt["id"] if nxt else "finish"

        await db.users.update_one(
            _user_filter(user),
            {
                "$set": {
                    "tutorial_state.fake_plots": fake_plots,
                    "tutorial_state.fake_business_id": biz_id,
                    "tutorial_current_step": next_id,
                }
            },
        )
        return {"ok": True, "fake_plots": fake_plots, "business_id": biz_id, "current_step_id": next_id}

    # -----------------------------------
    # GET /api/tutorial/seed-lot
    # Returns the hidden tutorial-bot lot for the current user, if any.
    # Used by the Trading page to inject the bot lot into the public buy list
    # while tutorial is active.
    # -----------------------------------
    @router.get("/seed-lot")
    async def tutorial_seed_lot(credentials: HTTPAuthorizationCredentials = Depends(security)):
        user = await _get_user(credentials)
        uid = user.get("id")
        lot = await db.market_listings.find_one({"tutorial_seed_for": uid, "status": "active"})
        if not lot:
            return {"ok": True, "lot": None}
        lot.pop("_id", None)
        return {"ok": True, "lot": lot}

    # -----------------------------------
    # POST /api/tutorial/buy-lot
    # Buy (illusory) 5 units of Neuro Core from the tutorial-bot lot.
    # Adds to user's real resources (tracked in tutorial_state.fake_resources so
    # we can roll back on finish). Does NOT deduct balance.
    # -----------------------------------
    class BuyLotRequest(BaseModel):
        amount: int = 5

    @router.post("/buy-lot")
    async def tutorial_buy_lot(
        data: BuyLotRequest,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        user = await _get_user(credentials)
        if not user.get("tutorial_active"):
            raise HTTPException(status_code=400, detail="Tutorial is not active")
        if user.get("tutorial_current_step") != "buy_lot":
            raise HTTPException(status_code=400, detail="Not on buy_lot step")

        amount = max(1, min(int(data.amount), 5))

        uid = user.get("id")
        # Delete the seed lot (consumed)
        await db.market_listings.delete_many({"tutorial_seed_for": uid})

        fake_resources = dict((user.get("tutorial_state") or {}).get("fake_resources", {}))
        fake_resources["neuro_core"] = int(fake_resources.get("neuro_core", 0)) + amount

        # Advance step
        nxt = get_next_step("buy_lot")
        next_id = nxt["id"] if nxt else "finish"

        await db.users.update_one(
            _user_filter(user),
            {
                "$set": {
                    "tutorial_state.fake_resources": fake_resources,
                    "tutorial_current_step": next_id,
                },
                "$inc": {f"resources.neuro_core": amount},
            },
        )
        return {"ok": True, "amount": amount, "current_step_id": next_id}

    # -----------------------------------
    # POST /api/tutorial/fake-grant-resource  (legacy, kept for compat)
    # -----------------------------------
    @router.post("/fake-grant-resource")
    async def tutorial_fake_grant_resource(
        data: FakeGrantResourceRequest,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        user = await _get_user(credentials)
        if not user.get("tutorial_active"):
            raise HTTPException(status_code=400, detail="Tutorial is not active")
        if user.get("tutorial_current_step") != "fake_add_resources":
            raise HTTPException(status_code=400, detail="Not on fake_add_resources step")

        fake_resources = dict((user.get("tutorial_state") or {}).get("fake_resources", {}))
        fake_resources[data.resource_type] = int(fake_resources.get(data.resource_type, 0)) + int(data.amount)

        # Also add them to real user.resources so they appear naturally in trading flow.
        # They are tracked in tutorial_state.fake_resources so finish() can deduct them.
        await db.users.update_one(
            _user_filter(user),
            {
                "$set": {"tutorial_state.fake_resources": fake_resources},
                "$inc": {f"resources.{data.resource_type}": int(data.amount)},
            },
        )

        # Advance step
        nxt = get_next_step("fake_add_resources")
        next_id = nxt["id"] if nxt else "finish"
        await db.users.update_one(
            _user_filter(user),
            {"$set": {"tutorial_current_step": next_id}},
        )

        return {"ok": True, "fake_resources": fake_resources, "current_step_id": next_id}

    # -----------------------------------
    # POST /api/tutorial/create-lot
    # Wrapper that creates a real tutorial market listing using the fake resources.
    # Keeps flow consistent: deducts from user.resources (which were granted), marks
    # listing with tutorial:true (hidden from others), and stores fake_lot_id.
    # -----------------------------------
    @router.post("/create-lot")
    async def tutorial_create_lot(
        data: CreateLotRequest,
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        user = await _get_user(credentials)
        if not user.get("tutorial_active"):
            raise HTTPException(status_code=400, detail="Tutorial is not active")
        if user.get("tutorial_current_step") != "create_lot":
            raise HTTPException(status_code=400, detail="Not on create_lot step")

        amount = int(data.amount)
        price = float(data.price_per_unit)
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be > 0")
        if price <= 0:
            raise HTTPException(status_code=400, detail="Price must be > 0")

        # Deduct from user's resources (these were granted during fake_add_resources)
        user_resources = user.get("resources", {}) or {}
        have = int(user_resources.get(data.resource_type, 0))
        if have < amount:
            raise HTTPException(status_code=400, detail=f"Not enough {data.resource_type}")

        await db.users.update_one(
            _user_filter(user),
            {"$inc": {f"resources.{data.resource_type}": -amount}},
        )

        listing = {
            "id": str(uuid.uuid4()),
            "seller_id": user.get("id"),
            "seller_email": user.get("email"),
            "seller_username": user.get("username") or user.get("display_name") or "Tutorial",
            "business_id": None,
            "resource_type": data.resource_type,
            "amount": amount,
            "price_per_unit": round(price, 6),
            "total_price": round(amount * price, 2),
            "status": "active",
            "tutorial": True,  # critical: hide from public
            "created_at": _now(),
        }
        await db.market_listings.insert_one(listing.copy())

        # Advance step
        nxt = get_next_step("create_lot")
        next_id = nxt["id"] if nxt else "finish"

        await db.users.update_one(
            _user_filter(user),
            {
                "$set": {
                    "tutorial_state.fake_lot_id": listing["id"],
                    "tutorial_current_step": next_id,
                }
            },
        )
        listing.pop("_id", None)
        return {"ok": True, "listing": listing, "current_step_id": next_id}

    # -----------------------------------
    # POST /api/tutorial/finish
    # -----------------------------------
    @router.post("/finish")
    async def tutorial_finish(
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        user = await _get_user(credentials)
        if not user.get("tutorial_active"):
            # Idempotent
            return {"ok": True, "already_completed": bool(user.get("tutorial_completed"))}

        uid = user.get("id")
        # 1. Remove tutorial market listings (user-created + bot seed lots)
        try:
            await db.market_listings.delete_many({"seller_id": uid, "tutorial": True})
        except Exception as e:
            logger.warning(f"finish: delete tutorial listings error: {e}")
        try:
            await db.market_listings.delete_many({"tutorial_seed_for": uid})
        except Exception as e:
            logger.warning(f"finish: delete seed lots error: {e}")
        # 1b. Remove tutorial businesses
        try:
            await db.businesses.delete_many({"owner": uid, "tutorial": True})
        except Exception as e:
            logger.warning(f"finish: delete tutorial businesses error: {e}")
        # 2. Remove tutorial transactions
        try:
            await db.transactions.delete_many({"user_id": uid, "tutorial": True})
        except Exception:
            pass
        try:
            await db.transactions.delete_many({"from_address": user.get("wallet_address"), "tutorial": True})
        except Exception:
            pass

        # 3. Restore snapshot
        snap = user.get("tutorial_snapshot") or {}
        set_doc = {
            "tutorial_active": False,
            "tutorial_completed": True,
            "tutorial_completed_at": _now(),
        }
        # Only restore keys that exist in the snapshot
        for key in ("balance_ton", "resources", "active_resource_buffs", "level", "xp",
                    "total_turnover", "total_income", "plots_owned", "businesses_owned"):
            if key in snap:
                set_doc[key] = snap[key]

        await db.users.update_one(
            _user_filter(user),
            {
                "$set": set_doc,
                "$unset": {
                    "tutorial_snapshot": "",
                    "tutorial_state": "",
                    "tutorial_current_step": "",
                    "tutorial_started_at": "",
                },
            },
        )
        logger.info(f"Tutorial finished for user {user.get('username')}")
        return {"ok": True, "rolled_back": True}

    # -----------------------------------
    # POST /api/tutorial/mark-skipped
    # User chose NOT to start the tutorial from the welcome modal.
    # We persist completed=true so the prompt never auto-opens again.
    # -----------------------------------
    @router.post("/mark-skipped")
    async def tutorial_mark_skipped(
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        user = await _get_user(credentials)
        # If tutorial is active, do nothing — user must finish/reset explicitly
        if user.get("tutorial_active"):
            return {"ok": True, "already_active": True}
        await db.users.update_one(
            _user_filter(user),
            {
                "$set": {
                    "tutorial_active": False,
                    "tutorial_completed": True,
                    "tutorial_skipped": True,
                    "tutorial_skipped_at": _now(),
                },
            },
        )
        return {"ok": True, "marked_skipped": True}

    # -----------------------------------
    # POST /api/tutorial/reset  (admin/debug — allows replay)
    # -----------------------------------
    @router.post("/reset")
    async def tutorial_reset(
        credentials: HTTPAuthorizationCredentials = Depends(security),
    ):
        user = await _get_user(credentials)
        uid = user.get("id")
        # Clean up any tutorial-owned data regardless of current state
        try:
            await db.market_listings.delete_many({"seller_id": uid, "tutorial": True})
        except Exception:
            pass
        try:
            await db.market_listings.delete_many({"tutorial_seed_for": uid})
        except Exception:
            pass
        try:
            await db.businesses.delete_many({"owner": uid, "tutorial": True})
        except Exception:
            pass
        # Restore snapshot if we have one
        snap = user.get("tutorial_snapshot") or {}
        set_doc = {"tutorial_active": False, "tutorial_completed": False}
        for key in ("balance_ton", "resources", "active_resource_buffs", "level", "xp",
                    "total_turnover", "total_income", "plots_owned", "businesses_owned"):
            if key in snap:
                set_doc[key] = snap[key]
        await db.users.update_one(
            _user_filter(user),
            {
                "$set": set_doc,
                "$unset": {
                    "tutorial_snapshot": "",
                    "tutorial_state": "",
                    "tutorial_current_step": "",
                    "tutorial_started_at": "",
                    "tutorial_completed_at": "",
                    "tutorial_skipped": "",
                    "tutorial_skipped_at": "",
                },
            },
        )
        return {"ok": True, "reset": True}

    return router
