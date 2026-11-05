/** IST time for server console logs, e.g. "10:15:20.345 AM IST" */
export const istTime = (ms: number): string => {
  const time = new Date(ms).toLocaleTimeString("en-US", {
    timeZone: "Asia/Kolkata",
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const millis = String(ms % 1000).padStart(3, "0");
  return time.replace(/(\d{2}:\d{2}:\d{2})/, `$1.${millis}`) + " IST";
};

/** Duration for server console logs, e.g. "10.123s" */
export const seconds = (ms: number): string => `${(ms / 1000).toFixed(3)}s`;
