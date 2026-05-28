import { ethers } from 'ethers';
import { env } from '../env.js';

const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const CHAIN_ID = 137; // Polygon mainnet

// EIP-712 domain for Polymarket CLOB
const DOMAIN = {
  name: 'Polymarket CTF Exchange',
  version: '1',
  chainId: CHAIN_ID,
  verifyingContract: CTF_EXCHANGE,
} as const;

const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
  ],
};

export interface SignedOrder {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: number;
  signatureType: number;
  signature: string;
}

export async function signOrder(params: {
  tokenId: string;
  side: 'BUY' | 'SELL';
  price: number;
  sizeUsdc: number;
}): Promise<SignedOrder> {
  if (!env.walletPrivateKey || !env.walletAddress) {
    throw new Error('Wallet credentials required for signing');
  }

  const wallet = new ethers.Wallet(env.walletPrivateKey);
  const salt = Math.floor(Math.random() * 1e15).toString();
  const expiration = Math.floor(Date.now() / 1000) + 3600; // 1hr expiry
  const side = params.side === 'BUY' ? 0 : 1;

  // Convert USDC amounts to 6-decimal units
  const makerAmount = Math.floor(params.sizeUsdc * 1e6).toString();
  const takerAmount = Math.floor((params.sizeUsdc / params.price) * 1e6).toString();

  const orderData = {
    salt,
    maker: env.walletAddress,
    signer: env.walletAddress,
    taker: ethers.ZeroAddress,
    tokenId: params.tokenId,
    makerAmount,
    takerAmount,
    expiration: expiration.toString(),
    nonce: '0',
    feeRateBps: '0',
    side,
    signatureType: 0,
  };

  const signature = await wallet.signTypedData(DOMAIN, ORDER_TYPES, orderData);

  return { ...orderData, signature };
}
