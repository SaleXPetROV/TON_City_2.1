"""TON Island routes — map, plots, buildings.

Split from server.py (was `# ==================== TON ISLAND ROUTES ====================`
section at lines 1041-1581, ~540 lines).
"""
from datetime import datetime, timezone
import logging
import os
import uuid

from fastapi import APIRouter, HTTPException, Depends

from core.dependencies import get_current_user
from core.models import User
from core.helpers import (
    get_user_identifiers as _helper_gui,
    is_owner,
    get_user_filter,
    resolve_business_config,
)
from business_config import BUSINESSES, PATRON_BONUSES, TIER_TAXES, RESOURCE_WEIGHTS, RESOURCE_TYPES
from ton_island import generate_ton_island_map, ZONES
from game_systems import get_production, get_consumption_breakdown, get_storage_capacity

logger = logging.getLogger(__name__)


def create_ton_island_router(db):
    router = APIRouter(prefix="/api", tags=["ton-island"])

    async def get_user_identifiers(current_user):
        return await _helper_gui(db, current_user)


    @router.get("/config")
    async def get_app_config():
        """Get application configuration"""
        deposit_address = ""

        # PRIORITY 1: Check distribution smart contract address first
        contract_settings = await db.admin_settings.find_one({"type": "distribution_contract"}, {"_id": 0})
        if contract_settings and contract_settings.get("contract_address"):
            deposit_address = contract_settings.get("contract_address", "")

        # PRIORITY 2: Fallback to admin_wallets (direct wallet addresses)
        if not deposit_address:
            admin_wallet = await db.admin_wallets.find_one({}, {"_id": 0, "address": 1})
            deposit_address = admin_wallet.get("address", "") if admin_wallet else ""

        # PRIORITY 3: Fallback to game_settings
        if not deposit_address:
            game_settings = await db.game_settings.find_one({"type": "ton_wallet"}, {"_id": 0})
            if game_settings:
                deposit_address = game_settings.get("receiver_address", "") or game_settings.get("receiver_address_display", "")

        return {
            "support_telegram": os.environ.get("SUPPORT_TELEGRAM", "https://t.me/support"),
            "deposit_address": deposit_address,
            "businesses": {k: {
                "name": v["name"],
                "tier": v["tier"],
                "icon": v["icon"],
                "produces": v["produces"],
                "consumes": get_consumption_breakdown(k, 1),
                "is_patron": v.get("is_patron", False),
                "patron_type": v.get("patron_type"),
                "description": v["description"],
                "base_production": get_production(k, 1),
            } for k, v in BUSINESSES.items()},
            "tier_taxes": TIER_TAXES,
            "resource_weights": RESOURCE_WEIGHTS,
            "zones": ZONES,
            "patron_bonuses": PATRON_BONUSES,
        }

    @router.get("/island")
    async def get_ton_island():
        """Get TON Island map data"""
        # Check if island exists in DB
        island = await db.islands.find_one({"id": "ton_island"}, {"_id": 0})

        if not island:
            # Generate and store
            island = generate_ton_island_map()
            await db.islands.insert_one(island.copy())

        # Merge ownership data from plots collection
        plots = await db.plots.find({"island_id": "ton_island"}, {"_id": 0}).to_list(1000)
        plots_map = {(p["x"], p["y"]): p for p in plots}

        # Merge businesses data
        businesses = await db.businesses.find({"island_id": "ton_island"}, {"_id": 0}).to_list(1000)
        businesses_map = {(b["x"], b["y"]): b for b in businesses}

        cells = island.get("cells", [])

        # Collect unique owner IDs to batch load avatars
        owner_ids = set()
        for cell in cells:
            x, y = cell["x"], cell["y"]
            plot = plots_map.get((x, y))
            if plot and plot.get("owner"):
                owner_ids.add(plot.get("owner"))

        # Load user avatars
        users_with_avatars = {}
        if owner_ids:
            users = await db.users.find(
                {"$or": [{"id": {"$in": list(owner_ids)}}, {"wallet_address": {"$in": list(owner_ids)}}]},
                {"_id": 0, "id": 1, "wallet_address": 1, "avatar": 1, "username": 1}
            ).to_list(100)
            for u in users:
                users_with_avatars[u.get("id")] = u
                if u.get("wallet_address"):
                    users_with_avatars[u.get("wallet_address")] = u

        for cell in cells:
            x, y = cell["x"], cell["y"]
            plot = plots_map.get((x, y))
            if plot:
                cell["owner"] = plot.get("owner")
                cell["owner_username"] = plot.get("owner_username")
                # ALWAYS get avatar from current user data to ensure it's up-to-date
                owner_user = users_with_avatars.get(plot.get("owner"))
                cell["owner_avatar"] = owner_user.get("avatar") if owner_user else plot.get("owner_avatar")

            business = businesses_map.get((x, y))
            if business:
                biz_type = business.get("business_type", "")
                biz_level = business.get("level", 1)
                biz_config = resolve_business_config(biz_type)
                cell["business"] = {
                    "id": business.get("id"),
                    "type": biz_type,
                    "level": biz_level,
                    "tier": biz_config.get("tier", 1),
                    "icon": biz_config.get("icon", "🏢"),
                    "produces": biz_config.get("produces"),
                    "base_production": get_production(biz_type, biz_level),
                }

        # Count statistics
        owned = sum(1 for c in cells if c.get("owner"))
        with_business = sum(1 for c in cells if c.get("business"))

        island["stats"] = {
            "total_cells": len(cells),
            "owned_cells": owned,
            "available_cells": len(cells) - owned,
            "businesses": with_business,
        }

        return island

    @router.get("/island/cell/{x}/{y}")
    async def get_island_cell(x: int, y: int):
        """Get fresh data for a specific cell on TON Island"""
        # Get island
        island = await db.islands.find_one({"id": "ton_island"}, {"_id": 0})
        if not island:
            island = generate_ton_island_map()
            await db.islands.insert_one(island.copy())

        # Find cell
        cell = None
        for c in island["cells"]:
            if c["x"] == x and c["y"] == y:
                cell = c.copy()
                break

        if not cell:
            raise HTTPException(status_code=404, detail="Cell not found")

        # Get ownership data
        plot = await db.plots.find_one({"island_id": "ton_island", "x": x, "y": y}, {"_id": 0})
        if plot:
            cell["owner"] = plot.get("owner")
            cell["owner_username"] = plot.get("owner_username")
            cell["is_available"] = False  # Cell is owned, not available for purchase
            # Get fresh avatar from user
            owner_user = await db.users.find_one(
                {"$or": [{"id": plot.get("owner")}, {"wallet_address": plot.get("owner")}]},
                {"_id": 0, "avatar": 1, "username": 1}
            )
            cell["owner_avatar"] = owner_user.get("avatar") if owner_user else plot.get("owner_avatar")

        # Get business data
        business = await db.businesses.find_one({"island_id": "ton_island", "x": x, "y": y}, {"_id": 0})
        if business:
            biz_type = business.get("business_type", "")
            biz_level = business.get("level", 1)
            biz_config = resolve_business_config(biz_type)
            cell["business"] = {
                "id": business.get("id"),
                "type": biz_type,
                "level": biz_level,
                "tier": biz_config.get("tier", 1),
                "icon": biz_config.get("icon", "🏢"),
                "produces": biz_config.get("produces"),
                "consumes": get_consumption_breakdown(biz_type, biz_level),
                "base_production": get_production(biz_type, biz_level),
            }
        elif cell.get("pre_business"):
            # For pre-assigned businesses that haven't been purchased yet
            biz_type = cell["pre_business"]
            biz_config = resolve_business_config(biz_type)
            cell["business"] = {
                "type": biz_type,
                "level": 1,
                "tier": biz_config.get("tier", 1),
                "icon": biz_config.get("icon", "🏢"),
                "produces": biz_config.get("produces"),
                "consumes": get_consumption_breakdown(biz_type, 1),
                "base_production": get_production(biz_type, 1),
                "name": biz_config.get("name"),
            }

        return cell

    @router.post("/island/buy/{x}/{y}")
    async def buy_island_plot(x: int, y: int, current_user: User = Depends(get_current_user)):
        """
        Buy a plot on TON Island.
        Most plots come with pre-assigned businesses.
        Only empty plots (50 total) allow building later.
        """
        # Get island
        island = await db.islands.find_one({"id": "ton_island"}, {"_id": 0})
        if not island:
            island = generate_ton_island_map()
            await db.islands.insert_one(island.copy())

        # Find cell
        cell = None
        for c in island["cells"]:
            if c["x"] == x and c["y"] == y:
                cell = c
                break

        if not cell:
            raise HTTPException(status_code=404, detail="Участок не найден")

        # Check if already owned (plot exists AND has a real owner)
        existing = await db.plots.find_one({"island_id": "ton_island", "x": x, "y": y})
        if existing and existing.get("owner"):
            raise HTTPException(status_code=400, detail="Участок уже куплен")

        # Get user - search by wallet_address OR email
        user = None
        if current_user.wallet_address:
            user = await db.users.find_one({"wallet_address": current_user.wallet_address}, {"_id": 0})
        if not user and current_user.email:
            user = await db.users.find_one({"email": current_user.email}, {"_id": 0})

        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        # Check plot limit - 3 plots max for regular users, unlimited for admins and banks
        is_admin = user.get("is_admin", False) or user.get("role") == "ADMIN"
        is_bank = user.get("is_bank", False) or user.get("role") == "BANK"

        if not is_admin and not is_bank:
            # Count current plots owned by this user
            user_id = user.get("id", str(user.get("_id")))
            current_plots = await db.plots.count_documents({
                "$or": [
                    {"owner": user_id},
                    {"owner": current_user.wallet_address},
                    {"owner": current_user.email}
                ]
            })
            max_plots = 3  # Fixed limit of 3 plots for all regular users
            if current_plots >= max_plots:
                raise HTTPException(status_code=400, detail="max_plots_reached")

        # Get price from cell (includes business price if pre-assigned)
        price_ton = cell.get("price_ton", cell.get("price", 5.0))
        price_city = cell.get("price_city", price_ton * 1000)  # 1 TON = 1000 $CITY

        # Balance is stored as balance_ton, convert to $CITY for comparison
        user_balance_city = user.get("balance_ton", 0) * 1000

        if user_balance_city < price_city:
            raise HTTPException(status_code=400, detail="Недостаточно средств")

        user_id = user.get("id", str(user.get("_id")))

        # Get pre-assigned business (if any)
        pre_business = cell.get("pre_business")
        is_empty = cell.get("is_empty", False)

        # Create business data if pre-assigned
        business_data = None
        business_id = None
        if pre_business and not is_empty:
            from ton_island import CITY_BUSINESSES
            biz_config = CITY_BUSINESSES.get(pre_business)
            if biz_config:
                business_id = str(uuid.uuid4())
                business_data = {
                    "id": business_id,
                    "type": pre_business,
                    "name": biz_config["name"],
                    "icon": biz_config["icon"],
                    "tier": biz_config["tier"],
                    "level": 1,
                    "monthly_income_ton": biz_config["monthly_income_ton"],
                    "monthly_income_city": biz_config["monthly_income_ton"] * 1000,
                    "built_at": datetime.now(timezone.utc).isoformat(),
                    "last_collection": datetime.now(timezone.utc).isoformat(),
                }

                # Also create full business record in businesses collection
                full_business = {
                    "id": business_id,
                    "business_type": pre_business,
                    "name": biz_config["name"],
                    "icon": biz_config["icon"],
                    "tier": biz_config["tier"],
                    "level": 1,
                    "owner": user_id,
                    "owner_username": user.get("username"),
                    "plot_id": None,  # Will be updated below
                    "island_id": "ton_island",
                    "x": x,
                    "y": y,
                    "zone": cell["zone"],
                    "durability": 100,
                    "is_active": True,
                    "pending_income": 0,
                    "total_income": 0,
                    "monthly_income_ton": biz_config["monthly_income_ton"],
                    "monthly_income_city": biz_config["monthly_income_ton"] * 1000,
                    "base_cost_ton": price_ton,
                    "storage": {"capacity": get_storage_capacity(pre_business, 1) or biz_config.get("storage_capacity", 100), "items": {}},
                    "workers": [],
                    "on_sale": False,
                    "built_at": datetime.now(timezone.utc).isoformat(),
                    "last_collection": datetime.now(timezone.utc).isoformat(),
                }
                await db.businesses.insert_one(full_business.copy())

        # Create plot
        plot = {
            "id": str(uuid.uuid4()),
            "island_id": "ton_island",
            "x": x,
            "y": y,
            "zone": cell["zone"],
            "price_ton": price_ton,
            "price_city": price_city,
            "owner": user_id,
            "owner_username": user.get("username"),
            "owner_avatar": user.get("avatar"),
            "business": business_data,  # Pre-assigned business or None
            "business_id": business_id,  # Link to businesses collection
            "is_empty": is_empty,  # True if player can build later
            "warehouses": [],
            "purchased_at": datetime.now(timezone.utc).isoformat()
        }

        await db.plots.insert_one(plot.copy())

        # Update business with plot_id
        if business_id:
            await db.businesses.update_one(
                {"id": business_id},
                {"$set": {"plot_id": plot["id"]}}
            )

        # Deduct balance (only balance_ton, $CITY is derived)
        user_filter = {"email": user.get("email")} if user.get("email") else {"wallet_address": current_user.wallet_address}
        await db.users.update_one(
            user_filter,
            {"$inc": {"balance_ton": -price_ton}}
        )

        # Tax to treasury (5%)
        tax_ton = price_ton * 0.05
        tax_city = price_city * 0.05
        await db.admin_stats.update_one(
            {"type": "treasury"},
            {"$inc": {
                "land_tax": tax_ton, 
                "total_tax": tax_ton,
                "first_sale_revenue": price_ton,
                "total_plot_sales": 1,
                "plot_sales_income": price_ton
            }},
            upsert=True
        )

        # Record transaction for history
        business_name = ""
        if business_data:
            business_name = f" с бизнесом {business_data.get('icon', '')} {business_data.get('name', {}).get('ru', '')}"

        tx = {
            "id": str(uuid.uuid4()),
            "type": "land_purchase",
            "user_id": user_id,
            "amount_ton": -price_ton,
            "amount_city": -price_city,
            "tax_ton": tax_ton,
            "tax_city": tax_city,
            "plot_id": plot["id"],
            "plot_coords": f"[{x}, {y}]",
            "island_id": "ton_island",
            "description": f"Покупка участка [{x}, {y}]{business_name}",
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.transactions.insert_one(tx)

        logger.info(f"Plot purchased: ({x},{y}) by {user.get('username')} for {price_ton} TON ({price_city} $CITY)")

        new_balance_city = user_balance_city - price_city
        new_balance_ton = new_balance_city / 1000

        return {
            "status": "purchased",
            "plot": plot,
            "business": business_data,
            "is_empty": is_empty,
            "new_balance_ton": new_balance_ton,
            "new_balance_city": new_balance_city
        }

    @router.post("/island/build/{x}/{y}")
    async def build_on_island(x: int, y: int, request: dict, current_user: User = Depends(get_current_user)):
        """
        Build a business on owned EMPTY plot only.
        Only Tier 1 and Tier 2 businesses can be built (Tier 3 zone is pre-filled).
        """
        business_type = request.get("business_type")
        if not business_type:
            raise HTTPException(status_code=400, detail="business_type is required")

        # Get plot
        plot = await db.plots.find_one({"island_id": "ton_island", "x": x, "y": y}, {"_id": 0})
        if not plot:
            raise HTTPException(status_code=404, detail="Участок не найден")

        # Check if plot is empty (only empty plots allow building)
        if not plot.get("is_empty", False):
            raise HTTPException(status_code=400, detail="На этом участке уже есть бизнес. Строительство разрешено только на пустых участках.")

        # Verify ownership
        user = None
        if current_user.wallet_address:
            user = await db.users.find_one({"wallet_address": current_user.wallet_address}, {"_id": 0})
        if not user and current_user.email:
            user = await db.users.find_one({"email": current_user.email}, {"_id": 0})

        if not user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        user_id = user.get("id", str(user.get("_id")))

        if plot["owner"] != user_id and plot["owner"] != current_user.wallet_address:
            raise HTTPException(status_code=403, detail="Это не ваш участок")

        if plot.get("business"):
            raise HTTPException(status_code=400, detail="На участке уже есть бизнес")

        # Get business config from new CITY_BUSINESSES
        from ton_island import CITY_BUSINESSES
        biz_config = CITY_BUSINESSES.get(business_type)
        if not biz_config:
            # Fallback to old BUSINESSES config
            biz_config = BUSINESSES.get(business_type)
            if not biz_config:
                raise HTTPException(status_code=400, detail="Неизвестный тип бизнеса")

        # Check tier - only Tier 1 and 2 allowed for building
        tier = biz_config.get("tier", 1)
        if tier == 3:
            raise HTTPException(
                status_code=400, 
                detail="Бизнесы Tier 3 нельзя строить. Все они уже размещены в зоне Ядро."
            )

        # Get build cost (same as purchase price for these businesses)
        build_cost_ton = biz_config.get("price_ton", biz_config.get("base_cost_ton", 10.0))
        build_cost_city = build_cost_ton * 1000

        user_balance_city = user.get("balance_ton", 0) * 1000
        if user_balance_city < build_cost_city:
            raise HTTPException(status_code=400, detail="Недостаточно средств для строительства")

        # Create business
        business = {
            "id": str(uuid.uuid4()),
            "type": business_type,
            "name": biz_config.get("name", {"en": business_type, "ru": business_type}),
            "icon": biz_config.get("icon", "🏢"),
            "tier": tier,
            "level": 1,
            "monthly_income_ton": biz_config.get("monthly_income_ton", 5.0),
            "monthly_income_city": biz_config.get("monthly_income_ton", 5.0) * 1000,
            "built_at": datetime.now(timezone.utc).isoformat(),
            "last_collection": datetime.now(timezone.utc).isoformat(),
        }

        # Update plot with business
        await db.plots.update_one(
            {"id": plot["id"]},
            {
                "$set": {
                    "business": business,
                    "is_empty": False
                }
            }
        )

        # Deduct balance
        user_filter = {"email": user.get("email")} if user.get("email") else {"wallet_address": current_user.wallet_address}
        await db.users.update_one(
            user_filter,
            {"$inc": {"balance_ton": -build_cost_ton}}
        )

        # Record transaction
        tx = {
            "id": str(uuid.uuid4()),
            "type": "business_build",
            "user_id": user_id,
            "amount_ton": -build_cost_ton,
            "amount_city": -build_cost_city,
            "business_type": business_type,
            "plot_id": plot["id"],
            "plot_coords": f"[{x}, {y}]",
            "description": f"Строительство {biz_config.get('icon', '')} {biz_config.get('name', {}).get('ru', business_type)}",
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.transactions.insert_one(tx)

        new_balance_city = user_balance_city - build_cost_city

        return {
            "status": "built",
            "business": business,
            "new_balance_ton": new_balance_city / 1000,
            "new_balance_city": new_balance_city
        }


    # Old build function removed, replaced with new one above
    @router.get("/island/buildable-businesses")
    async def get_buildable_businesses():
        """
        Get list of businesses that can be built on empty plots.
        Only Tier 1 and Tier 2 allowed (Tier 3 zone is fully occupied).
        """
        from ton_island import CITY_BUSINESSES, ton_to_city

        result = []
        for b_id, b in CITY_BUSINESSES.items():
            if b["tier"] in [1, 2]:  # Only Tier 1 and 2
                result.append({
                    "id": b_id,
                    "name": b["name"],
                    "icon": b["icon"],
                    "tier": b["tier"],
                    "price_ton": b["price_ton"],
                    "price_city": ton_to_city(b["price_ton"]),
                    "monthly_income_ton": b["monthly_income_ton"],
                    "monthly_income_city": ton_to_city(b["monthly_income_ton"]),
                })

        return {"businesses": result}



    return router
