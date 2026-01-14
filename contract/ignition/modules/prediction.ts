import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const PrizePoolPredictionModule = buildModule("PrizePoolPredictionModule", (m) => {
  const PrizePoolPrediction = m.contract("PrizePoolPrediction", []);

  return { PrizePoolPrediction };
});

export default PrizePoolPredictionModule;
