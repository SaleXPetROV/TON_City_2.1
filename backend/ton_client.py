import os
from tonsdk.wallet import Wallets, WalletVersionEnum
from tonsdk.contract.wallet import Wallet
from tonsdk.utils import to_nano
from tonsdk.provider import ToncenterClient


class TonClient:
    def __init__(self):
        mnemonic = os.getenv("TON_WALLET_MNEMONIC")
        if not mnemonic:
            raise RuntimeError("TON_WALLET_MNEMONIC not set")

        self.client = ToncenterClient(
            base_url="https://toncenter.com/api/v2",
            api_key=os.getenv("TONCENTER_API_KEY")
        )

        wallet = Wallets.from_mnemonics(
            mnemonic.split(),
            wallet_version=WalletVersionEnum.v4r2,
            workchain=0
        )

        self.wallet: Wallet = wallet
        self.address = wallet.address.to_string(
            is_user_friendly=True,
            is_bounceable=True,
            is_test_only=False
        )

    async def send_transfer(self, destination_address: str, amount_ton: float) -> str:
        seqno = await self.wallet.get_seqno(self.client)

        transfer = self.wallet.create_transfer_message(
            to_addr=destination_address,
            amount=to_nano(amount_ton, "ton"),
            seqno=seqno,
            payload=None,
            send_mode=3
        )

        await self.client.send_boc(
            transfer["message"].to_boc(False)
        )

        return transfer["message"].hash.hex()
