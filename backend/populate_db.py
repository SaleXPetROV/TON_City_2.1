import asyncio
import os
import sys
import random
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

# Load environment
from dotenv import load_dotenv
load_dotenv()

mongo_url = os.environ.get('MONGO_URL', 'mongodb://127.0.0.1:27017/toncity')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'toncity')]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Business types list
BUSINESS_TYPES = [
    "helios", "nano_dc", "quartz_mine", "signal_tower", "hydro_cooling", "bio_food", "scrap_yard",
    "chips_factory", "nft_studio", "ai_lab", "logistics_hub", "cyber_cafe", "repair_shop", "vr_club",
    "gram_bank", "dex", "casino"
]

ZONES = ["core", "inner", "middle", "outer"]

async def create_100_users():
    print("🚀 Starting generation of 100 users...")
    
    users = []
    hashed_password = pwd_context.hash("password123")
    
    # 1. Create Users
    for i in range(1, 101):
        wallet_suffix = f"{i:04d}"
        wallet = f"0:user{wallet_suffix}user{wallet_suffix}user{wallet_suffix}user{wallet_suffix}"
        username = f"user_{i}"
        
        user = {
            "id": str(uuid.uuid4()),
            "wallet_address": wallet,
            "raw_address": wallet,
            "username": username,
            "display_name": f"Player {i}",
            "email": f"user{i}@example.com",
            "hashed_password": hashed_password,
            "avatar": None,
            "language": "en",
            "is_admin": False,
            "balance_ton": random.randint(50, 5000),  # Random balance
            "level": 1,
            "xp": random.randint(0, 1000),
            "total_turnover": 0,
            "total_income": 0.0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": datetime.now(timezone.utc).isoformat(),
            "plots_owned": [],
            "businesses_owned": []
        }
        users.append(user)
        
    # Bulk insert users
    if users:
        await db.users.insert_many(users)
        print(f"✅ Created {len(users)} users")
    
    # 2. Assign Plots and Businesses
    plots = []
    businesses = []
    
    # Grid size roughly 35x35 = 1225 cells. 100 users * 3 plots = 300 plots.
    # We'll pick random coordinates around center (17, 17)
    
    used_coords = set()
    
    for user in users:
        # Each user buys 1-5 plots
        num_plots = random.randint(1, 5)
        
        for _ in range(num_plots):
            # Try to find a free spot
            for attempt in range(50):
                x = random.randint(5, 30)
                y = random.randint(5, 30)
                
                if (x, y) not in used_coords:
                    used_coords.add((x, y))
                    
                    # Create plot
                    plot_id = str(uuid.uuid4())
                    price = random.randint(10, 50)
                    
                    plot = {
                        "id": plot_id,
                        "island_id": "ton_island",
                        "x": x,
                        "y": y,
                        "zone": random.choice(ZONES),
                        "price": price,
                        "owner": user["id"],
                        "owner_username": user["username"],
                        "business": None,
                        "warehouses": [],
                        "purchased_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    # Build business (70% chance)
                    if random.random() < 0.7:
                        biz_type = random.choice(BUSINESS_TYPES)
                        biz_id = str(uuid.uuid4())
                        
                        business = {
                            "id": biz_id,
                            "island_id": "ton_island",
                            "plot_id": plot_id,
                            "x": x,
                            "y": y,
                            "business_type": biz_type,
                            "level": random.randint(1, 5),
                            "durability": random.randint(50, 100),
                            "xp": 0,
                            "owner": user["id"],
                            "owner_wallet": user["wallet_address"],
                            "owner_username": user["username"],
                            "patron": None,
                            "patron_id": None,
                            "last_patron_change": None,
                            "storage": {
                                "capacity": 1000,
                                "items": {}
                            },
                            "pending_income": 0,
                            "last_collection": datetime.now(timezone.utc).isoformat(),
                            "last_wear_update": datetime.now(timezone.utc).isoformat(),
                            "created_at": datetime.now(timezone.utc).isoformat()
                        }
                        
                        plot["business"] = biz_type
                        businesses.append(business)
                        
                        # Add to user businesses list
                        user["businesses_owned"].append(biz_id)
                        
                    plots.append(plot)
                    user["plots_owned"].append(plot_id)
                    break
        
        # Update user with owned items
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "plots_owned": user["plots_owned"],
                "businesses_owned": user["businesses_owned"]
            }}
        )

    # Bulk insert plots and businesses
    if plots:
        await db.plots.insert_many(plots)
        print(f"✅ Created {len(plots)} plots")
        
    if businesses:
        await db.businesses.insert_many(businesses)
        print(f"✅ Created {len(businesses)} businesses")
        
    print("\n🎉 Population complete!")
    print(f"Test User Login Credentials:")
    print(f"Username: {users[0]['username']}")
    print(f"Wallet: {users[0]['wallet_address']}")
    print(f"Password: password123")

if __name__ == "__main__":
    asyncio.run(create_100_users())
