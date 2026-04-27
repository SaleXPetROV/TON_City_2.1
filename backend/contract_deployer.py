"""
TON Smart Contract Deployer for FundDistributor
Handles deployment via external tools and wallet management
"""

import os
import asyncio
import logging
import aiohttp
from typing import Optional, Dict
from datetime import datetime, timezone
from tonsdk.contract.wallet import Wallets, WalletVersionEnum
from tonsdk.utils import to_nano, from_nano, Address
from tonsdk.boc import begin_cell
import base64

logger = logging.getLogger(__name__)


class ContractDeployer:
    """Handles TON smart contract deployment configuration and wallet management"""
    
    def __init__(self, db):
        self.db = db
        self.api_url = "https://toncenter.com/api/v2"
        self.testnet_api_url = "https://testnet.toncenter.com/api/v2"
        
    async def get_deployer_wallet(self) -> Optional[Dict]:
        """Get deployer wallet settings"""
        settings = await self.db.admin_settings.find_one(
            {"type": "contract_deployer"}, {"_id": 0}
        )
        return settings
    
    async def save_deployer_wallet(self, mnemonic: str, network: str = "mainnet") -> Dict:
        """Save deployer wallet mnemonic"""
        mnemonics = mnemonic.strip().split()
        if len(mnemonics) != 24:
            raise ValueError("Mnemonic must be 24 words")
        
        _, _, _, wallet = Wallets.from_mnemonics(
            mnemonics, WalletVersionEnum.v4r2, 0
        )
        # Non-bounceable format (UQ...)
        address = wallet.address.to_string(is_user_friendly=True, is_bounceable=False, is_url_safe=True)
        
        await self.db.admin_settings.update_one(
            {"type": "contract_deployer"},
            {"$set": {
                "type": "contract_deployer",
                "mnemonic": mnemonic,
                "address": address,
                "network": network,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        return {"address": address, "network": network}
    
    async def delete_deployer_wallet(self) -> Dict:
        """Delete deployer wallet configuration"""
        await self.db.admin_settings.delete_one({"type": "contract_deployer"})
        return {"status": "deleted"}
    
    async def get_wallet_balance(self, address: str, network: str = "mainnet") -> float:
        """Get wallet balance"""
        api_url = self.api_url if network == "mainnet" else self.testnet_api_url
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{api_url}/getAddressBalance",
                    params={"address": address},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get("ok"):
                            balance = int(data.get("result", 0))
                            return from_nano(balance, "ton")
        except Exception as e:
            logger.error(f"Balance check error: {e}")
        return 0.0
    
    async def get_seqno(self, wallet_address: str, network: str = "mainnet") -> int:
        """Get wallet seqno"""
        api_url = self.api_url if network == "mainnet" else self.testnet_api_url
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{api_url}/runGetMethod",
                    json={"address": wallet_address, "method": "seqno", "stack": []},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get("ok"):
                            stack = data.get("result", {}).get("stack", [])
                            if stack and len(stack) > 0:
                                item = stack[0]
                                if isinstance(item, list) and len(item) >= 2:
                                    val = item[1]
                                    if isinstance(val, str):
                                        return int(val, 16) if val.startswith("0x") else int(val)
                                return int(item) if isinstance(item, (int, str)) else 0
        except Exception as e:
            logger.error(f"Seqno error: {e}")
        return 0
    
    async def send_ton(self, to_address: str, amount: float, comment: str = "") -> Dict:
        """Send TON from deployer wallet"""
        settings = await self.get_deployer_wallet()
        if not settings or not settings.get("mnemonic"):
            raise ValueError("Deployer wallet not configured")
        
        mnemonic = settings["mnemonic"].split()
        network = settings.get("network", "mainnet")
        api_url = self.api_url if network == "mainnet" else self.testnet_api_url
        
        try:
            _, private_key, public_key, wallet = Wallets.from_mnemonics(
                mnemonic, WalletVersionEnum.v4r2, 0
            )
            
            wallet_address = wallet.address.to_string(is_user_friendly=True, is_bounceable=False, is_url_safe=True)
            
            # Check balance
            balance = await self.get_wallet_balance(wallet_address, network)
            if balance < amount + 0.01:  # + gas reserve
                raise ValueError(f"Insufficient balance: {balance:.4f} TON")
            
            # Get seqno
            seqno = await self.get_seqno(wallet_address, network)
            logger.info(f"Sending {amount} TON to {to_address}, seqno={seqno}")
            
            # Create payload with comment if provided
            payload = None
            if comment:
                payload = begin_cell()
                payload.store_uint(0, 32)  # text comment prefix
                payload.store_string(comment)
                payload = payload.end_cell()
            
            # Create transfer message
            query = wallet.create_transfer_message(
                to_addr=to_address,
                amount=to_nano(amount, "ton"),
                seqno=seqno,
                payload=payload
            )
            
            boc = base64.b64encode(query["message"].to_boc()).decode()
            
            # Send with retry
            for attempt in range(3):
                try:
                    if attempt > 0:
                        await asyncio.sleep(2)
                    
                    async with aiohttp.ClientSession() as session:
                        async with session.post(
                            f"{api_url}/sendBoc",
                            json={"boc": boc},
                            timeout=aiohttp.ClientTimeout(total=30)
                        ) as resp:
                            result = await resp.json()
                            
                            if result.get("ok"):
                                return {"status": "sent", "amount": amount, "to": to_address}
                            elif result.get("code") == 429:
                                await asyncio.sleep(3)
                            else:
                                raise ValueError(result.get("error", str(result)))
                except Exception as e:
                    if attempt == 2:
                        raise
                    logger.warning(f"Send attempt {attempt+1} failed: {e}")
            
            raise ValueError("Failed after 3 attempts")
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Send error: {e}", exc_info=True)
            raise ValueError(f"Send failed: {str(e)}")
    
    async def deploy_contract(self) -> Dict:
        """
        Deploy is handled externally via Tact compiler + ton-connect.
        This endpoint saves the contract address after deployment.
        """
        settings = await self.get_deployer_wallet()
        if not settings:
            raise ValueError("Deployer wallet not configured")
        
        # Check if contract already deployed
        contract = await self.db.admin_settings.find_one({"type": "distribution_contract"})
        if contract and contract.get("contract_address"):
            return {
                "status": "already_deployed",
                "contract_address": contract["contract_address"],
                "message": "Контракт уже задеплоен. Используйте адрес ниже."
            }
        
        # Generate instructions for manual deploy
        wallet_address = settings.get("address", "")
        network = settings.get("network", "mainnet")
        
        return {
            "status": "manual_deploy_required",
            "message": "Автоматический деплой временно недоступен из-за ограничений API.",
            "instructions": {
                "step1": "Скомпилируйте контракт FundDistributor.tact используя 'npx tact'",
                "step2": f"Задеплойте через ton-connect или Tonkeeper с адреса {wallet_address}",
                "step3": "После деплоя введите адрес контракта ниже"
            },
            "deployer_address": wallet_address,
            "network": network
        }
    
    async def save_contract_address(self, contract_address: str) -> Dict:
        """Save deployed contract address"""
        settings = await self.get_deployer_wallet()
        network = settings.get("network", "mainnet") if settings else "mainnet"
        
        # Validate address
        try:
            addr = Address(contract_address)
            friendly = addr.to_string(is_user_friendly=True, is_bounceable=False, is_url_safe=True)
        except:
            raise ValueError("Invalid TON address")
        
        await self.db.admin_settings.update_one(
            {"type": "distribution_contract"},
            {"$set": {
                "type": "distribution_contract",
                "contract_address": friendly,
                "deployed_at": datetime.now(timezone.utc).isoformat(),
                "network": network,
                "deployer": settings.get("address") if settings else ""
            }},
            upsert=True
        )
        
        return {"status": "saved", "contract_address": friendly}
    
    async def get_contract_info(self) -> Dict:
        """Get contract information"""
        contract = await self.db.admin_settings.find_one(
            {"type": "distribution_contract"}, {"_id": 0}
        )
        
        if not contract or not contract.get("contract_address"):
            return {"configured": False}
        
        address = contract["contract_address"]
        network = contract.get("network", "mainnet")
        balance = await self.get_wallet_balance(address, network)
        
        wallets = await self.db.admin_wallets.find({}, {"_id": 0, "mnemonic": 0}).to_list(100)
        total_percent = sum(w.get("percentage", 0) for w in wallets)
        
        return {
            "configured": True,
            "contract_address": address,
            "network": network,
            "balance": balance,
            "deployed_at": contract.get("deployed_at"),
            "wallets": wallets,
            "total_percent": total_percent,
            "wallets_count": len(wallets)
        }
    
    async def add_wallet_to_contract(self, wallet_address: str, percent: int) -> Dict:
        """Validate and track wallet for distribution"""
        try:
            addr = Address(wallet_address)
            friendly = addr.to_string(is_user_friendly=True, is_bounceable=False, is_url_safe=True)
        except:
            raise ValueError("Invalid TON address")
        
        wallets = await self.db.admin_wallets.find({}, {"_id": 0}).to_list(100)
        total = sum(w.get("percentage", 0) for w in wallets)
        
        if total + percent > 100:
            raise ValueError(f"Total percent exceeds 100%. Available: {100 - total}%")
        
        return {"status": "success", "wallet": friendly, "percent": percent}
    
    async def add_wallet_onchain(self, wallet_address: str, percent: int) -> Dict:
        """
        Add wallet to FundDistributor contract ON-CHAIN via AddWallet message.
        
        The AddWallet message format (from Tact):
        - op: uint32 = 0x??? (Tact generates this)
        - address: Address
        - percent: uint8
        """
        # Get deployer wallet (contract owner)
        deployer = await self.get_deployer_wallet()
        if not deployer or not deployer.get("mnemonic"):
            raise ValueError("Deployer wallet not configured")
        
        # Get contract address
        contract = await self.db.admin_settings.find_one({"type": "distribution_contract"})
        if not contract or not contract.get("contract_address"):
            raise ValueError("Contract not deployed")
        
        contract_address = contract["contract_address"]
        mnemonic = deployer["mnemonic"].split()
        network = deployer.get("network", "mainnet")
        api_url = self.api_url if network == "mainnet" else self.testnet_api_url
        
        try:
            # Parse wallet address to add
            addr = Address(wallet_address)
            
            # Create wallet from mnemonic
            _, private_key, public_key, wallet = Wallets.from_mnemonics(
                mnemonic, WalletVersionEnum.v4r2, 0
            )
            
            wallet_addr_str = wallet.address.to_string(is_user_friendly=True, is_bounceable=False, is_url_safe=True)
            
            # Get seqno
            seqno = await self.get_seqno(wallet_addr_str, network)
            logger.info(f"Adding wallet to contract, seqno={seqno}")
            
            # Build AddWallet message body
            # Tact AddWallet message: op_code (4 bytes) + address + percent (uint8)
            # The op_code for AddWallet in Tact is calculated from the message name
            # AddWallet op = crc32("AddWallet") & 0x7fffffff = 0x???
            # We need to calculate it or use known value
            
            # For Tact, the opcode is: crc32c("AddWallet") & 0x7fffffff
            import binascii
            def crc32c(data):
                return binascii.crc32(data.encode()) & 0xffffffff
            
            add_wallet_op = crc32c("AddWallet") & 0x7fffffff
            
            payload = begin_cell()
            payload.store_uint(add_wallet_op, 32)  # op code
            payload.store_address(addr)            # address to add
            payload.store_uint(percent, 8)         # percent as uint8
            payload = payload.end_cell()
            
            # Create transfer to contract
            query = wallet.create_transfer_message(
                to_addr=contract_address,
                amount=to_nano(0.02, "ton"),  # Gas for contract execution (reduced from 0.05)
                seqno=seqno,
                payload=payload
            )
            
            boc = base64.b64encode(query["message"].to_boc()).decode()
            
            # Send transaction
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{api_url}/sendBoc",
                    json={"boc": boc},
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as resp:
                    result = await resp.json()
                    
                    if result.get("ok"):
                        tx_hash = result.get("result", {}).get("hash", "sent")
                        logger.info(f"✅ AddWallet TX sent: {wallet_address[:20]}... {percent}%")
                        return {
                            "status": "success",
                            "tx_hash": tx_hash,
                            "wallet": wallet_address,
                            "percent": percent
                        }
                    else:
                        error = result.get("error", str(result))
                        raise ValueError(f"Transaction failed: {error}")
                        
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error adding wallet on-chain: {e}", exc_info=True)
            raise ValueError(f"Failed to add wallet: {str(e)}")


# Singleton
contract_deployer: Optional[ContractDeployer] = None

def get_contract_deployer(db) -> ContractDeployer:
    global contract_deployer
    if contract_deployer is None:
        contract_deployer = ContractDeployer(db)
    return contract_deployer
