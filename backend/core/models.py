"""
Pydantic models for the application
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, ConfigDict


# ==================== USER MODELS ====================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: Optional[str] = None
    email: Optional[str] = None
    wallet_address: Optional[str] = None
    raw_address: Optional[str] = None
    display_name: Optional[str] = None
    language: str = "en"
    level: Union[str, int] = "novice"
    xp: int = 0
    balance_ton: float = 0.0
    total_turnover: float = 0.0
    total_income: float = 0.0
    plots_owned: List[str] = []
    businesses_owned: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_admin: bool = False


# ==================== PLOT MODELS ====================

class Plot(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    x: int
    y: int
    zone: str = "outskirts"
    price: float = 10.0
    owner: Optional[str] = None
    business_id: Optional[str] = None
    is_available: bool = True
    is_rented: bool = False
    rent_price: Optional[float] = None
    renter: Optional[str] = None
    purchased_at: Optional[datetime] = None


# ==================== BUSINESS MODELS ====================

class Business(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    plot_id: str
    owner: str
    business_type: str
    level: int = 1
    xp: int = 0
    income_rate: float = 0.0
    production_rate: float = 0.0
    storage: Dict[str, float] = {}
    connected_businesses: List[str] = []
    is_active: bool = True
    last_collection: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    building_progress: float = 100.0
    builders: List[str] = []


# ==================== TRANSACTION MODELS ====================

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tx_type: str
    from_address: str
    to_address: Optional[str] = None
    amount_ton: float
    commission: float = 0.0
    tax: float = 0.0
    plot_id: Optional[str] = None
    business_id: Optional[str] = None
    resource_type: Optional[str] = None
    resource_amount: Optional[float] = None
    status: str = "pending"
    blockchain_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None


# ==================== REQUEST MODELS ====================

class WithdrawRequest(BaseModel):
    amount: float
    totp_code: Optional[str] = None


class InstantWithdrawRequest(BaseModel):
    bank_id: str
    amount: float
    totp_code: Optional[str] = None


class PurchasePlotRequest(BaseModel):
    plot_x: int
    plot_y: int


class ResalePlotRequest(BaseModel):
    plot_id: str
    resale_price: float


class BuildBusinessRequest(BaseModel):
    plot_id: str
    business_type: str


class CreateContractRequest(BaseModel):
    seller_business_id: str
    buyer_business_id: str
    resource_type: str
    amount_per_hour: float
    price_per_unit: float


class TradeResourceRequest(BaseModel):
    seller_business_id: str
    buyer_id: str
    resource_type: str
    amount: float
    price_per_unit: float


class WalletVerifyRequest(BaseModel):
    address: str
    proof: Optional[Dict[str, Any]] = None
    language: str = "en"
    username: Optional[str] = None
    email: Optional[str] = None     
    password: Optional[str] = None 


class ConfirmTransactionRequest(BaseModel):
    transaction_id: str
    blockchain_hash: Optional[str] = None


class RentPlotRequest(BaseModel):
    plot_id: str
    rent_price: float


class AcceptRentRequest(BaseModel):
    plot_id: str


class EmailRegister(BaseModel):
    email: str
    password: str
    username: str


class WalletAuth(BaseModel):
    address: str
    public_key: Optional[str] = None
    username: Optional[str] = None


class MarketListing(BaseModel):
    business_id: str
    resource_type: str
    amount: float
    price_per_unit: float


class BuyFromMarketRequest(BaseModel):
    listing_id: str
    amount: float


class ResourceListingRequest(BaseModel):
    business_id: str
    resource_type: str
    amount: float
    price_per_unit: float


class LandListingRequest(BaseModel):
    plot_id: str
    price: float


class BuyLandRequest(BaseModel):
    listing_id: str


class SellBusinessRequest(BaseModel):
    price: float


class CalculateSaleTaxRequest(BaseModel):
    business_type: str


class CreditSystemRequest(BaseModel):
    business_id: str
    amount: float
    lender_type: str = "government"
