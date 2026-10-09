const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatMoney(amount: number): string {
  return inr.format(amount);
}

export function formatSignedMoney(amount: number): string {
  if (amount > 0) return `+${inr.format(amount)}`;
  return inr.format(amount);
}

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}
