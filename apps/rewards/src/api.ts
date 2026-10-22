import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export type Reward = {
  id: string;
  brand: string;
  title: string;
  category: string;
  points: number;
  stock: number;
  description: string;
  terms: string;
  art: string;
  color: string;
  sample: boolean;
  active: boolean;
};
export type Member = {
  id: string;
  name: string;
  email: string;
  phone: string;
  points: number;
  earned: number;
  sample: boolean;
};
export type Entry = {
  id: string;
  delta: number;
  description: string;
  created: number;
};
export type Gift = Omit<
  Reward,
  "id" | "stock" | "description" | "active" | "category"
> & {
  id: string;
  reward_id: string;
  code: string;
  created: number;
  expires: number;
  status: "available" | "used" | "expired";
};
const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
export const API_URL =
  configured ||
  (Platform.OS === "web"
    ? /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) &&
      ["8081", "19006"].includes(window.location.port)
      ? "http://127.0.0.1:8002/api/rewards"
      : `${window.location.origin}/api/rewards`
    : "");
const KEY = "re-rewards-session";
export const session = {
  get: async () =>
    Platform.OS === "web"
      ? sessionStorage.getItem(KEY)
      : SecureStore.getItemAsync(KEY),
  save: async (token: string) => {
    if (Platform.OS === "web") sessionStorage.setItem(KEY, token);
    else await SecureStore.setItemAsync(KEY, token);
  },
  clear: async () => {
    if (Platform.OS === "web") sessionStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  },
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  token = "",
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (!API_URL)
    throw new ApiError(
      "Chưa kết nối được dịch vụ RE. Vui lòng liên hệ đơn vị vận hành.",
      0,
    );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(API_URL + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await r.json().catch(() => null);
    if (!r.ok)
      throw new ApiError(
        typeof data?.detail === "string"
          ? data.detail
          : "Thông tin chưa hợp lệ. Vui lòng kiểm tra và thử lại.",
        r.status,
      );
    if (data === null)
      throw new ApiError(
        "Dịch vụ tạm thời chưa phản hồi. Vui lòng thử lại.",
        0,
      );
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      "Không kết nối được dịch vụ RE. Kiểm tra mạng và thử lại.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}
