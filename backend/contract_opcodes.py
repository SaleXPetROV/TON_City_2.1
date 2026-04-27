# FundDistributor Contract Opcodes
# Generated from compiled Tact contract

FUND_DISTRIBUTOR_OPCODES = {
    "Deploy": 2490013878,
    "DeployOk": 2952335191,
    "FactoryDeploy": 1829761339,
    "ChangeOwner": 2174598809,
    "ChangeOwnerOk": 846932810,
    "AddWallet": 2265409812,           # 0x87021A14
    "RemoveWallet": 1729309605,        # 0x67100BA5
    "UpdateWalletPercent": 367970722,  # 0x15F14DA2
    "WithdrawEmergency": 3214380190,   # 0xBF8D989E
    "TransferOwnership": 1882669034,   # 0x7036496A
    "SetMinDistribution": 4137757115,  # 0xF6A3D1BB
    "OwnerDistribute": 3235229450,     # 0xC0D4730A
}

def get_opcode(message_name: str) -> int:
    """Get opcode for a message by name"""
    return FUND_DISTRIBUTOR_OPCODES.get(message_name, 0)

def get_opcode_hex(message_name: str) -> str:
    """Get opcode in hex format"""
    opcode = get_opcode(message_name)
    return hex(opcode) if opcode else "0x0"
