import { ethers } from 'ethers';

const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const POLYGON_RPC = 'https://polygon-rpc.com';

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

export async function fetchUsdcBalance(walletAddress: string): Promise<number> {
  const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
  const balance: bigint = await usdc.balanceOf(walletAddress);
  // USDC has 6 decimals
  return Number(balance) / 1e6;
}
