export type ParsedShopItem = {
  name: string;
  quantity: number;
  unit: string | null;
};

const UNIT =
  String.raw`(?:ק["״']?ג|קילו(?:גרם)?|גרם|ג["״']?ר|ליטר|ליטרים|ל["״']|מ["״']ל|מיליליטר|יח(?:ידה|ידות)?|חבילה|חבילות|שקית|שקיות|בקבוק|בקבוקים|קופסה|קופסאות|מארז|מארזים)`;

const LEADING = new RegExp(String.raw`^(\d+(?:[.,]\d+)?)\s*(${UNIT})?\s+(.+)$`, "u");
const TRAILING = new RegExp(String.raw`^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(${UNIT})?$`, "u");

function numberOf(value: string) {
  const quantity = Number(value.replace(",", "."));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function parseLine(raw: string): ParsedShopItem | null {
  const text = raw.trim().replace(/^[-•*]\s*/, "");
  if (!text) return null;

  const leading = text.match(LEADING);
  if (leading?.[3]?.trim()) {
    return {
      quantity: numberOf(leading[1]),
      unit: leading[2] ?? null,
      name: leading[3].trim(),
    };
  }

  const trailing = text.match(TRAILING);
  if (trailing?.[1]?.trim()) {
    return {
      name: trailing[1].trim(),
      quantity: numberOf(trailing[2]),
      unit: trailing[3] ?? null,
    };
  }

  return { name: text, quantity: 1, unit: null };
}

export function parseShoppingText(text: string): ParsedShopItem[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/[,;،]/))
    .map(parseLine)
    .filter((item): item is ParsedShopItem => item !== null);
}

export function formatParsedAmount(item: Pick<ParsedShopItem, "quantity" | "unit">) {
  if (item.unit) return `${item.quantity} ${item.unit}`;
  return String(item.quantity);
}
