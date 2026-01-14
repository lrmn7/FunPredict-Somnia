
export const truncateAddress = (address: string): string => {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatPoints = (points: number): string => {
  return points.toLocaleString();
};