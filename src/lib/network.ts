interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
  downlink?: number;
}

// Browsers without Network Information keep the normal experience. Call this
// when scheduling work so a connection change also affects later navigations.
export const isConstrainedConnection = () => {
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return Boolean(connection && (connection.saveData
    || /^(slow-2g|2g|3g)$/.test(connection.effectiveType ?? '')
    || (typeof connection.downlink === 'number' && connection.downlink < 1.5)));
};
