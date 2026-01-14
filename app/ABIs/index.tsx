import PrizePoolPredictionABI from "./Prediction.json";

export const PrizePredictionContract = {
  address: process.env.NEXT_PUBLIC_FUN_PREDICT_CONTRACT_ADDRESS as `0x${string}`,
  abi: PrizePoolPredictionABI,
};
