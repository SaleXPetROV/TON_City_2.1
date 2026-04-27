"""
Tutorial Steps Configuration (v2)
=================================
New 15-step flow where the user REALLY buys a T1 business (illusion mode),
sees it idle for lack of fuel, gets gifted 50 biomass to make it active,
REALLY buys a T3 resource lot from a hidden tutorial bot, and REALLY lists
his own lot — all inside the real UI but isolated by the `tutorial:true` flag.

Steps 0..14 (15 total):
 0  welcome
 1  go_dashboard   (TON CITY logo → /)
 2  go_island      (→ /island)
 3  fake_buy_plot  (click free cell → buy modal → Buy a Helios T1 business)
 4  go_businesses  (→ /my-businesses, see the bought business)
 5  explain_idle   (the Helios is idle — needs biomass; we gift 50 biomass)
 6  go_trading_buy (→ /trading, Buy tab)
 7  buy_lot        (click Buy on the 🤖 Tutorial Bot lot — gets 5 Neuro Core)
 8  go_trading_my  (switch to My tab)
 9  create_lot     (list 4 of 5 Neuro Core, 1 stays)
10  observe_listing
11  go_businesses_check (→ /my-businesses, see the 1 leftover Neuro Core)
12  explain_t3_buff (read: T3 resources are also buffs for your businesses)
13  go_credit
14  go_leaderboard
15  finish
"""

BLOCKED_WRITES_DURING_TUTORIAL = [
    "/api/withdraw",
    "/api/transactions/withdraw",
    "/api/credit/apply",
    "/api/loans/apply",
    "/api/credit/take",
    "/api/chat/messages",
    "/api/chat/send",
]

ALWAYS_ALLOWED = [
    "/api/tutorial/",
    "/api/auth/",
    "/api/config",
    "/api/health",
    "/api/users/me",
    "/api/me/",
    "/api/notifications",
    "/api/sprites/",
    "/api/profile",
    "/api/currency",
    "/api/language",
    "/api/business/catalog",
    "/api/stats",
    "/api/patrons",
    "/api/cities",
    "/api/chat",
    "/api/security",
]


TUTORIAL_STEPS = [
    {"id": "welcome", "index": 0, "target_route": None, "target_selector": None, "mobile_target_selector": None, "gate": "client_ack", "optional": False},
    {"id": "go_dashboard", "index": 1, "target_route": "/", "target_selector": "sidebar-logo", "mobile_target_selector": "mobile-menu-item-home", "gate": "page_visit", "optional": False},
    {"id": "go_island", "index": 2, "target_route": "/island", "target_selector": "sidebar-nav-map", "mobile_target_selector": "mobile-menu-item-map", "gate": "page_visit", "optional": False},
    {"id": "fake_buy_plot", "index": 3, "target_route": "/island", "target_selector": None, "mobile_target_selector": None, "gate": "server_action", "optional": False, "allow_interaction": True},
    {"id": "go_businesses", "index": 4, "target_route": "/my-businesses", "target_selector": "sidebar-nav-my-businesses", "mobile_target_selector": "mobile-menu-item-my-businesses", "gate": "page_visit", "optional": False},
    {"id": "explain_idle", "index": 5, "target_route": "/my-businesses", "target_selector": "tutorial-business-card", "mobile_target_selector": "tutorial-business-card", "gate": "client_ack", "optional": False, "allow_interaction": False},
    {"id": "go_trading_buy", "index": 6, "target_route": "/trading", "target_selector": "sidebar-nav-trading", "mobile_target_selector": "mobile-menu-item-trading", "gate": "page_visit", "optional": False},
    {"id": "buy_lot", "index": 7, "target_route": "/trading", "target_selector": "tutorial-buy-bot-lot-btn", "mobile_target_selector": "tutorial-buy-bot-lot-btn", "gate": "server_action", "optional": False, "allow_interaction": True},
    {"id": "go_trading_my", "index": 8, "target_route": "/trading", "target_selector": "tutorial-trading-tab-my", "mobile_target_selector": "tutorial-trading-tab-my", "gate": "client_ack", "optional": False},
    {"id": "create_lot", "index": 9, "target_route": "/trading", "target_selector": "tutorial-create-lot-btn", "mobile_target_selector": "tutorial-create-lot-btn", "gate": "db_check", "optional": False, "allow_interaction": True},
    {"id": "observe_listing", "index": 10, "target_route": "/trading", "target_selector": "tutorial-trading-tab-my", "mobile_target_selector": "tutorial-trading-tab-my", "gate": "client_ack", "optional": False},
    {"id": "go_businesses_check", "index": 11, "target_route": "/my-businesses", "target_selector": "sidebar-nav-my-businesses", "mobile_target_selector": "mobile-menu-item-my-businesses", "gate": "page_visit", "optional": False},
    {"id": "explain_t3_buff", "index": 12, "target_route": "/my-businesses", "target_selector": "resource-card-neuro_core", "mobile_target_selector": "resource-card-neuro_core", "gate": "client_ack", "optional": False},
    {"id": "go_credit", "index": 13, "target_route": "/credit", "target_selector": "sidebar-nav-credit", "mobile_target_selector": "mobile-menu-item-credit", "gate": "client_ack", "optional": False, "block_target_clicks": True},
    {"id": "go_leaderboard", "index": 14, "target_route": "/leaderboard", "target_selector": "sidebar-nav-leaderboard", "mobile_target_selector": "mobile-menu-item-leaderboard", "gate": "page_visit", "optional": False},
    {"id": "finish", "index": 15, "target_route": None, "target_selector": None, "mobile_target_selector": None, "gate": "client_ack", "optional": False},
]

TUTORIAL_STEP_IDS = [s["id"] for s in TUTORIAL_STEPS]
STEP_BY_ID = {s["id"]: s for s in TUTORIAL_STEPS}
TOTAL_STEPS = len(TUTORIAL_STEPS)


def get_step(step_id: str):
    return STEP_BY_ID.get(step_id)


def get_step_by_index(idx: int):
    if 0 <= idx < TOTAL_STEPS:
        return TUTORIAL_STEPS[idx]
    return None


def get_next_step(current_id: str):
    step = STEP_BY_ID.get(current_id)
    if not step:
        return TUTORIAL_STEPS[0]
    next_idx = step["index"] + 1
    if next_idx >= TOTAL_STEPS:
        return None
    return TUTORIAL_STEPS[next_idx]


def is_write_blocked_during_tutorial(method: str, path: str) -> bool:
    if method.upper() not in ("POST", "PUT", "PATCH", "DELETE"):
        return False
    for prefix in BLOCKED_WRITES_DURING_TUTORIAL:
        if path.startswith(prefix):
            return True
    return False


def is_api_allowed_in_step(step_id: str, path: str) -> bool:
    return True
