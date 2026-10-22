import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { api, ApiError, Entry, Gift, Member, Reward, session } from "./src/api";
import {
  Art,
  Button,
  C,
  date,
  Empty,
  Icon,
  IconName,
  number,
  s,
  Sample,
  Txt,
} from "./src/ui";

type Tab = "home" | "rewards" | "points" | "wallet" | "account";
type Sheet = "auth" | "profile" | "password" | "delete" | "about" | null;
const tabs: { id: Tab; name: string; icon: IconName }[] = [
  { id: "home", name: "Trang chủ", icon: "home" },
  { id: "rewards", name: "Đổi quà", icon: "gift" },
  { id: "points", name: "Điểm", icon: "award" },
  { id: "wallet", name: "Quà của tôi", icon: "shopping-bag" },
  { id: "account", name: "Tài khoản", icon: "user" },
];
const categories = [
  ["all", "Tất cả"],
  ["food", "Ăn uống"],
  ["lifestyle", "Sống xanh"],
  ["shopping", "Mua sắm"],
];
const normalize = (x: string) =>
  x
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RewardsApp />
    </SafeAreaProvider>
  );
}
function RewardsApp() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab: Tab = tabs.find((t) => t.id === params.tab)?.id || "home";
  const setTab = useCallback(
    (next: Tab) => router.setParams({ tab: next }),
    [],
  );
  const [sheet, setSheet] = useState<Sheet>(null),
    [selected, setSelected] = useState<Reward | null>(null),
    [voucher, setVoucher] = useState<Gift | null>(null),
    [success, setSuccess] = useState<Gift | null>(null);
  const [token, setToken] = useState(""),
    [member, setMember] = useState<Member | null>(null),
    [catalog, setCatalog] = useState<Reward[]>([]),
    [ledger, setLedger] = useState<Entry[]>([]),
    [wallet, setWallet] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [signup, setSignup] = useState(false),
    [sample, setSample] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [newPassword, setNewPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [brand, setBrand] = useState("all"),
    [walletFilter, setWalletFilter] = useState("available"),
    [pointFilter, setPointFilter] = useState("all");
  const active = useRef(""),
    pending = useRef<Record<string, string>>({}),
    scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const loadCatalog = useCallback(async () => {
    const r = await api<{ items: Reward[]; sample: boolean }>("/catalog");
    setCatalog(r.items);
    setSample(r.sample);
  }, []);
  const loadMember = useCallback(async (t: string) => {
    const [me, points, gifts] = await Promise.all([
      api<Member>("/me", t),
      api<Entry[]>("/ledger", t),
      api<Gift[]>("/wallet", t),
    ]);
    if (active.current === t) {
      setMember(me);
      setLedger(points);
      setWallet(gifts);
    }
  }, []);
  const clear = useCallback(async () => {
    active.current = "";
    setToken("");
    setMember(null);
    setLedger([]);
    setWallet([]);
    pending.current = {};
    setVoucher(null);
    setSuccess(null);
    await session.clear();
  }, []);
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 401 && active.current) {
        await clear();
        setSheet("auth");
      }
    } finally {
      setBusy(false);
    }
  };
  const close = useCallback(() => {
    if (busy) return;
    setSheet(null);
    setSelected(null);
    setVoucher(null);
    setSuccess(null);
    setPassword("");
    setNewPassword("");
    setShowPassword(false);
    setError("");
  }, [busy]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = await session.get();
        if (!alive) return;
        if (t) {
          active.current = t;
          setToken(t);
          try {
            await loadMember(t);
          } catch (e) {
            if (e instanceof ApiError && e.status === 401) await clear();
            else throw e;
          }
        }
        await loadCatalog();
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [clear, loadCatalog, loadMember]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (busy) return true;
      if (success || voucher || selected || sheet) {
        close();
        return true;
      }
      if (tab !== "home") {
        setTab("home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [sheet, selected, voucher, success, tab, busy, close, setTab]);
  const refresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      await Promise.all([
        loadCatalog(),
        token ? loadMember(token) : Promise.resolve(),
      ]);
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 401) await clear();
    } finally {
      setRefreshing(false);
    }
  };
  const navigate = (next: Tab) => {
    setTab(next);
    setError("");
  };
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [tab]);
  const openSheet = (next: Sheet) => {
    setError("");
    setPassword("");
    setNewPassword("");
    setName(member?.name || "");
    setPhone(member?.phone || "");
    setSheet(next);
  };
  const login = () =>
    run(async () => {
      if (
        !email.trim() ||
        password.length < 12 ||
        (signup && name.trim().length < 2)
      )
        throw new Error(
          "Nhập email, mật khẩu từ 12 ký tự và họ tên nếu đăng ký.",
        );
      const r = await api<{ token: string }>(
        signup ? "/auth/register" : "/auth/login",
        "",
        "POST",
        {
          email: email.trim(),
          password,
          ...(signup ? { name: name.trim() } : {}),
        },
      );
      await session.save(r.token);
      active.current = r.token;
      setToken(r.token);
      await loadMember(r.token);
      setSheet(null);
      setPassword("");
      setSignup(false);
    });
  const redeem = () =>
    run(async () => {
      if (!selected) return;
      if (!token) {
        setSelected(null);
        openSheet("auth");
        return;
      }
      const id = selected.id;
      const request_id =
        pending.current[id] || (pending.current[id] = Crypto.randomUUID());
      const gift = await api<Gift>("/redeem", token, "POST", {
        reward_id: id,
        request_id,
      });
      delete pending.current[id];
      setSelected(null);
      setSuccess(gift);
      await Promise.all([loadMember(token), loadCatalog()]);
    });
  const filtered = catalog.filter(
    (r) =>
      (category === "all" || r.category === category) &&
      (brand === "all" || r.brand === brand) &&
      normalize(r.title + " " + r.brand).includes(normalize(query)),
  );
  const renderError = () =>
    error ? (
      <View accessibilityRole="alert" style={s.error}>
        <Txt style={{ color: C.red, fontSize: 13 }}>{error}</Txt>
      </View>
    ) : null;
  const section = (title: string, action?: string, onPress?: () => void) => (
    <View style={[s.between, { marginTop: 26, marginBottom: 14 }]}>
      <Txt style={s.section}>{title}</Txt>
      {action && (
        <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10}>
          <Txt style={s.link}>{action} →</Txt>
        </Pressable>
      )}
    </View>
  );
  const chip = (label: string, current: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected: current }}
      onPress={onPress}
      style={[st.chip, current && st.chipActive]}
    >
      <Txt
        style={{
          fontSize: 13,
          fontWeight: current ? "700" : "500",
          color: current ? C.white : C.muted,
        }}
      >
        {label}
      </Txt>
    </Pressable>
  );
  const rewardCard = (r: Reward) => (
    <Pressable
      key={r.id}
      accessibilityRole="button"
      accessibilityLabel={`${r.title}, ${number(r.points)} điểm`}
      onPress={() => {
        setError("");
        setSelected(r);
      }}
      style={[s.card, { width: "48%", marginBottom: 14 }]}
    >
      <Art kind={r.art} color={r.color} />
      <View style={{ padding: 12, gap: 5 }}>
        <Txt style={[s.caption, { color: C.green, fontWeight: "700" }]}>
          {r.brand}
        </Txt>
        <Txt
          numberOfLines={2}
          style={{
            fontSize: 14,
            lineHeight: 21,
            fontWeight: "600",
            minHeight: 42,
          }}
        >
          {r.title}
        </Txt>
        <View style={[s.between, { marginTop: 7 }]}>
          <View style={[s.row, { gap: 5 }]}>
            <Icon name="star" size={14} />
            <Txt style={{ fontWeight: "800", fontSize: 15 }}>
              {number(r.points)}
            </Txt>
          </View>
          <View style={st.arrow}>
            <Icon name="arrow-up-right" size={15} />
          </View>
        </View>
        {!r.stock && (
          <Txt style={{ fontSize: 11, color: C.red }}>Tạm hết quà</Txt>
        )}
      </View>
    </Pressable>
  );
  const requireLogin = (title: string) => (
    <View style={{ gap: 14 }}>
      <Empty
        icon="user"
        title={title}
        body="Đăng nhập để tích điểm, đổi quà và lưu ưu đãi yêu thích của bạn."
      />
      <Button title="Đăng nhập / Đăng ký" onPress={() => openSheet("auth")} />
    </View>
  );
  const entries = ledger.filter(
    (e) =>
      pointFilter === "all" ||
      (pointFilter === "earned" ? e.delta > 0 : e.delta < 0),
  );
  const modalOpen = !!(sheet || selected || voucher || success);
  return (
    <View style={st.canvas}>
      <SafeAreaView style={st.phone} edges={["top", "bottom"]}>
        <View style={st.header}>
          <View style={s.row}>
            <View style={st.logo}>
              <Icon name="refresh-cw" color={C.white} size={19} />
            </View>
            <Txt
              style={{ fontSize: 21, fontWeight: "800", letterSpacing: -0.8 }}
            >
              RE<Txt style={{ fontSize: 18, fontWeight: "500" }}>wards</Txt>
            </Txt>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={member ? "Mở tài khoản" : "Đăng nhập"}
            onPress={() => (member ? navigate("account") : openSheet("auth"))}
            style={st.avatar}
          >
            {member ? (
              <Txt style={{ fontWeight: "700", color: C.green }}>
                {member.name.slice(0, 1).toUpperCase()}
              </Txt>
            ) : (
              <Icon name="user" size={20} />
            )}
          </Pressable>
        </View>
        <ScrollView
          ref={scroll}
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 20,
            paddingTop: 12,
            paddingBottom: 32,
          }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={C.green}
            />
          }
        >
          {renderError()}
          {loading ? (
            <View style={{ padding: 60 }}>
              <ActivityIndicator color={C.green} />
              <Txt style={{ textAlign: "center", marginTop: 12 }}>
                Đang tải ưu đãi…
              </Txt>
            </View>
          ) : (
            <>
              {tab === "home" && (
                <>
                  <Txt style={{ color: C.muted, marginBottom: 6 }}>
                    Xin chào
                    {member
                      ? `, ${member.name.split(" ").slice(-1)[0]}`
                      : " bạn"}{" "}
                    <Txt>☀</Txt>
                  </Txt>
                  <Txt style={s.title}>
                    Việc nhỏ mỗi ngày.{"\n"}Niềm vui được nhân lên.
                  </Txt>
                  <View style={st.memberCard}>
                    <View style={s.between}>
                      <Txt style={{ color: "#D8E8D6", fontSize: 13 }}>
                        ĐIỂM RE CỦA BẠN
                      </Txt>
                      <Icon name="feather" color={C.lime} size={24} />
                    </View>
                    <View
                      style={[s.row, { alignItems: "baseline", marginTop: 6 }]}
                    >
                      <Txt
                        style={{
                          fontSize: 42,
                          lineHeight: 52,
                          fontWeight: "800",
                          color: C.white,
                          letterSpacing: -1.5,
                        }}
                      >
                        {member ? number(member.points) : "—"}
                      </Txt>
                      <Txt style={{ color: "#D8E8D6" }}>điểm</Txt>
                    </View>
                    <View style={[s.between, { marginTop: 18 }]}>
                      <Txt style={{ color: "#D8E8D6", fontSize: 12 }}>
                        {member
                          ? "Tích thêm xanh, nhận thêm quà."
                          : "Đăng nhập để bắt đầu tích điểm."}
                      </Txt>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          member ? navigate("points") : openSheet("auth")
                        }
                        style={st.heroLink}
                      >
                        <Txt
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: C.deep,
                          }}
                        >
                          {member ? "Xem điểm" : "Bắt đầu"} ↗
                        </Txt>
                      </Pressable>
                    </View>
                  </View>
                  <View style={st.quickRow}>
                    {(
                      [
                        { icon: "gift", label: "Đổi quà", to: "rewards" },
                        { icon: "clock", label: "Lịch sử điểm", to: "points" },
                        {
                          icon: "shopping-bag",
                          label: "Quà của tôi",
                          to: "wallet",
                        },
                      ] as const
                    ).map((q) => (
                      <Pressable
                        key={q.to}
                        accessibilityRole="button"
                        onPress={() => navigate(q.to)}
                        style={st.quick}
                      >
                        <View style={st.quickIcon}>
                          <Icon name={q.icon} size={23} />
                        </View>
                        <Txt style={{ fontSize: 12, fontWeight: "600" }}>
                          {q.label}
                        </Txt>
                      </Pressable>
                    ))}
                  </View>
                  {section("Quà nhỏ, vui thật", "Xem tất cả", () =>
                    navigate("rewards"),
                  )}
                  <View style={st.grid}>
                    {catalog.slice(0, 4).map(rewardCard)}
                  </View>
                  {!catalog.length && (
                    <Empty
                      title="Ưu đãi đang được cập nhật"
                      body="Các phần quà mới sẽ sớm xuất hiện tại đây."
                    />
                  )}
                  <View style={[st.story, { marginTop: 8 }]}>
                    <View style={{ flex: 1, gap: 7 }}>
                      <Txt style={[s.section, { fontSize: 18 }]}>
                        Một chai được trả lại.{"\n"}Một vòng đời mới.
                      </Txt>
                      <Txt
                        style={{ fontSize: 13, lineHeight: 20, color: C.muted }}
                      >
                        Điểm được cộng khi giao dịch thu gom của bạn được xác
                        nhận.
                      </Txt>
                    </View>
                    <View style={st.storyIcon}>
                      <Icon name="refresh-cw" size={30} />
                    </View>
                  </View>
                  {section("Đồng hành cùng RE")}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10 }}
                  >
                    {[...new Set(catalog.map((r) => r.brand))].map((b, i) => (
                      <Pressable
                        accessibilityRole="button"
                        key={b}
                        onPress={() => {
                          setBrand(b);
                          navigate("rewards");
                        }}
                        style={st.brand}
                      >
                        <View
                          style={[
                            st.brandMark,
                            { backgroundColor: catalog[i]?.color || C.mint },
                          ]}
                        >
                          <Txt style={{ fontSize: 20, fontWeight: "700" }}>
                            {b.slice(0, 1)}
                          </Txt>
                        </View>
                        <Txt style={{ fontSize: 11, fontWeight: "600" }}>
                          {b}
                        </Txt>
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}
              {tab === "rewards" && (
                <>
                  <Txt style={s.title}>Đổi điểm.{"\n"}Chọn điều bạn thích.</Txt>
                  <Txt
                    style={{ color: C.muted, marginTop: 8, marginBottom: 18 }}
                  >
                    Một chút xanh, nhiều niềm vui.
                  </Txt>
                  <View style={st.search}>
                    <Icon name="search" size={19} color={C.muted} />
                    <TextInput
                      accessibilityLabel="Tìm quà hoặc nhãn hàng"
                      placeholder="Tìm quà hoặc nhãn hàng"
                      placeholderTextColor={C.muted}
                      value={query}
                      onChangeText={setQuery}
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: C.ink,
                        minHeight: 48,
                      }}
                    />
                    {!!query && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Xóa tìm kiếm"
                        hitSlop={12}
                        onPress={() => setQuery("")}
                      >
                        <Icon name="x" size={18} />
                      </Pressable>
                    )}
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 16 }}
                  >
                    {categories.map(([id, label]) =>
                      chip(label, category === id, () => setCategory(id)),
                    )}
                  </ScrollView>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
                  >
                    {chip("Mọi nhãn hàng", brand === "all", () =>
                      setBrand("all"),
                    )}
                    {[...new Set(catalog.map((r) => r.brand))].map((b) =>
                      chip(b, brand === b, () => setBrand(b)),
                    )}
                  </ScrollView>
                  <View style={[s.between, { marginBottom: 14 }]}>
                    <Txt style={s.caption}>
                      {filtered.length} phần quà dành cho bạn
                    </Txt>
                    {member && (
                      <Txt style={s.link}>{number(member.points)} điểm</Txt>
                    )}
                  </View>
                  <View style={st.grid}>{filtered.map(rewardCard)}</View>
                  {!filtered.length && (
                    <Empty
                      icon="search"
                      title="Chưa tìm thấy quà phù hợp"
                      body="Thử từ khóa khác hoặc chọn lại danh mục, nhãn hàng."
                    />
                  )}
                </>
              )}
              {tab === "points" &&
                (member ? (
                  <>
                    <Txt style={s.title}>Điểm của bạn</Txt>
                    <Txt style={{ color: C.muted, marginTop: 8 }}>
                      Mỗi điểm là một hành động có ý nghĩa.
                    </Txt>
                    <View style={[st.memberCard, { marginTop: 22 }]}>
                      <Txt style={{ color: "#D8E8D6" }}>Số điểm hiện có</Txt>
                      <Txt
                        style={{
                          fontSize: 44,
                          lineHeight: 58,
                          color: C.white,
                          fontWeight: "800",
                        }}
                      >
                        {number(member.points)}
                      </Txt>
                      <View
                        style={[
                          s.between,
                          {
                            borderTopWidth: 1,
                            borderTopColor: "#47836C",
                            paddingTop: 16,
                            marginTop: 12,
                          },
                        ]}
                      >
                        <Txt style={{ fontSize: 13, color: "#D8E8D6" }}>
                          Tổng điểm đã nhận
                        </Txt>
                        <Txt style={{ fontWeight: "700", color: C.white }}>
                          {number(member.earned)}
                        </Txt>
                      </View>
                    </View>
                    <Button
                      title="Dùng điểm đổi quà"
                      icon="gift"
                      secondary
                      onPress={() => navigate("rewards")}
                      style={{ marginTop: 12 }}
                    />
                    {section("Lịch sử điểm")}
                    <View style={[s.row, { marginBottom: 14 }]}>
                      {[
                        ["all", "Tất cả"],
                        ["earned", "Đã nhận"],
                        ["spent", "Đã dùng"],
                      ].map(([id, l]) =>
                        chip(l, pointFilter === id, () => setPointFilter(id)),
                      )}
                    </View>
                    {entries.map((e) => (
                      <View key={e.id} style={st.ledgerRow}>
                        <View
                          style={[
                            st.quickIcon,
                            {
                              width: 42,
                              height: 42,
                              backgroundColor: e.delta > 0 ? C.mint : "#F5EBDC",
                            },
                          ]}
                        >
                          <Icon
                            name={e.delta > 0 ? "plus" : "gift"}
                            size={18}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Txt style={{ fontSize: 14, fontWeight: "600" }}>
                            {e.description}
                          </Txt>
                          <Txt style={s.caption}>{date(e.created)}</Txt>
                        </View>
                        <Txt
                          style={{
                            fontWeight: "800",
                            color: e.delta > 0 ? C.green : C.ink,
                          }}
                        >
                          {e.delta > 0 ? "+" : ""}
                          {number(e.delta)}
                        </Txt>
                      </View>
                    ))}
                    {!entries.length && (
                      <Empty
                        icon="clock"
                        title="Chưa có giao dịch"
                        body="Các lượt tích và sử dụng điểm sẽ được lưu tại đây."
                      />
                    )}
                    <Txt style={[s.caption, { marginTop: 16 }]}>
                      Hiển thị tối đa 200 giao dịch gần nhất.
                    </Txt>
                  </>
                ) : (
                  requireLogin("Điểm xanh chờ bạn")
                ))}
              {tab === "wallet" &&
                (member ? (
                  <>
                    <Txt style={s.title}>Quà của tôi</Txt>
                    <Txt
                      style={{ color: C.muted, marginTop: 8, marginBottom: 20 }}
                    >
                      Những niềm vui bạn đã tích góp.
                    </Txt>
                    <View style={[s.row, { gap: 7, marginBottom: 20 }]}>
                      {[
                        ["available", "Chưa dùng"],
                        ["used", "Đã dùng"],
                        ["expired", "Hết hạn"],
                      ].map(([id, l]) =>
                        chip(l, walletFilter === id, () => setWalletFilter(id)),
                      )}
                    </View>
                    {wallet
                      .filter((g) => g.status === walletFilter)
                      .map((g) => (
                        <Pressable
                          key={g.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Xem mã quà ${g.title}`}
                          onPress={() => setVoucher(g)}
                          style={[s.card, st.walletCard]}
                        >
                          <View style={{ width: 94 }}>
                            <Art kind={g.art} color={g.color} size={110} />
                          </View>
                          <View style={{ flex: 1, padding: 13, gap: 5 }}>
                            <Txt
                              style={[
                                s.caption,
                                { color: C.green, fontWeight: "700" },
                              ]}
                            >
                              {g.brand}
                            </Txt>
                            <Txt
                              numberOfLines={2}
                              style={{ fontWeight: "600", fontSize: 14 }}
                            >
                              {g.title}
                            </Txt>
                            <Txt style={s.caption}>
                              Hạn dùng: {date(g.expires)}
                            </Txt>
                            <Txt style={s.link}>Xem mã quà →</Txt>
                          </View>
                        </Pressable>
                      ))}
                    {!wallet.some((g) => g.status === walletFilter) && (
                      <>
                        <Empty
                          title="Chưa có quà trong mục này"
                          body="Khám phá những ưu đãi và đổi phần quà đầu tiên bằng điểm RE."
                        />
                        <Button
                          title="Khám phá quà"
                          secondary
                          onPress={() => navigate("rewards")}
                        />
                      </>
                    )}
                  </>
                ) : (
                  requireLogin("Ví quà của riêng bạn")
                ))}
              {tab === "account" &&
                (member ? (
                  <>
                    <Txt style={s.title}>Tài khoản</Txt>
                    <View style={[s.card, { padding: 20, marginTop: 22 }]}>
                      <View style={s.row}>
                        <View
                          style={[
                            st.avatar,
                            { width: 58, height: 58, borderRadius: 22 },
                          ]}
                        >
                          <Txt
                            style={{
                              fontSize: 25,
                              fontWeight: "700",
                              color: C.green,
                            }}
                          >
                            {member.name[0]}
                          </Txt>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Txt style={s.section}>{member.name}</Txt>
                          <Txt style={s.caption}>{member.email}</Txt>
                        </View>
                      </View>
                      <View
                        style={{
                          marginTop: 20,
                          paddingTop: 14,
                          borderTopWidth: 1,
                          borderTopColor: C.line,
                        }}
                      >
                        <Txt style={s.caption}>
                          Mã thành viên · dùng khi xác nhận giao dịch
                        </Txt>
                        <Txt
                          selectable
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            marginTop: 4,
                          }}
                        >
                          {member.id}
                        </Txt>
                      </View>
                    </View>
                    <View style={{ marginTop: 24 }}>
                      {(
                        [
                          {
                            label: "Thông tin cá nhân",
                            icon: "user",
                            action: "profile",
                          },
                          {
                            label: "Đổi mật khẩu",
                            icon: "lock",
                            action: "password",
                          },
                          {
                            label: "Về RE & quyền riêng tư",
                            icon: "shield",
                            action: "about",
                          },
                          {
                            label: "Đăng xuất",
                            icon: "log-out",
                            action: "logout",
                          },
                          {
                            label: "Xóa tài khoản",
                            icon: "trash-2",
                            action: "delete",
                          },
                        ] as {
                          label: string;
                          icon: IconName;
                          action: Sheet | "logout";
                        }[]
                      ).map((row) => (
                        <Pressable
                          key={row.label}
                          accessibilityLabel={row.label}
                          accessibilityRole="button"
                          onPress={() => {
                            if (row.action === "logout") {
                              void run(async () => {
                                await api("/auth/logout", token, "POST");
                                await clear();
                                navigate("home");
                              });
                            } else openSheet(row.action);
                          }}
                          disabled={busy}
                          style={st.settingRow}
                        >
                          <Icon
                            name={row.icon}
                            color={row.icon === "trash-2" ? C.red : C.green}
                          />
                          <Txt
                            style={{
                              flex: 1,
                              color: row.icon === "trash-2" ? C.red : C.ink,
                            }}
                          >
                            {row.label}
                          </Txt>
                          <Icon
                            name="chevron-right"
                            size={18}
                            color={C.muted}
                          />
                        </Pressable>
                      ))}
                    </View>
                    <Txt
                      style={[
                        s.caption,
                        { textAlign: "center", marginTop: 24 },
                      ]}
                    >
                      REwards · Sống xanh, nhận điều hay.
                    </Txt>
                  </>
                ) : (
                  requireLogin("Chào mừng bạn đến với RE")
                ))}
              {sample && (
                <View style={{ marginTop: 25, gap: 8 }}>
                  <Sample text="Danh mục & điểm khởi tạo sử dụng dữ liệu mẫu" />
                  <Txt style={{ fontSize: 11, lineHeight: 17, color: C.muted }}>
                    Các tên nhãn hàng và ưu đãi hiện tại là mẫu, chưa đại diện
                    cho đối tác đã ký kết.
                  </Txt>
                </View>
              )}
              {!catalog.length && (
                <Button
                  title="Tải lại dữ liệu"
                  secondary
                  onPress={refresh}
                  busy={refreshing}
                  style={{ marginTop: 16 }}
                />
              )}
            </>
          )}
        </ScrollView>
        <View style={st.tabbar}>
          {tabs.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="tab"
              accessibilityLabel={t.name}
              accessibilityState={{ selected: tab === t.id }}
              onPress={() => navigate(t.id)}
              style={st.tab}
            >
              <View
                style={[
                  st.tabIcon,
                  tab === t.id && { backgroundColor: C.mint },
                ]}
              >
                <Icon
                  name={t.icon}
                  size={21}
                  color={tab === t.id ? C.green : C.muted}
                />
              </View>
              <Txt
                style={{
                  fontSize: 10,
                  lineHeight: 15,
                  fontWeight: tab === t.id ? "700" : "500",
                  color: tab === t.id ? C.green : C.muted,
                }}
              >
                {t.name}
              </Txt>
            </Pressable>
          ))}
        </View>
        <Modal
          visible={modalOpen}
          transparent
          animationType="slide"
          onRequestClose={close}
        >
          <View style={st.backdrop}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={st.sheet}
            >
              <View style={st.sheetHandle} />
              <View
                style={[
                  s.between,
                  { paddingHorizontal: 22, paddingBottom: 12 },
                ]}
              >
                <Txt style={s.section}>
                  {success
                    ? "Đổi quà thành công"
                    : voucher
                      ? "Mã quà của bạn"
                      : selected
                        ? "Chi tiết quà"
                        : sheet === "auth"
                          ? signup
                            ? "Tạo tài khoản RE"
                            : "Chào bạn trở lại"
                          : sheet === "profile"
                            ? "Thông tin cá nhân"
                            : sheet === "password"
                              ? "Đổi mật khẩu"
                              : sheet === "delete"
                                ? "Xóa tài khoản"
                                : "Về REwards"}
                </Txt>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đóng"
                  onPress={close}
                  disabled={busy}
                  hitSlop={10}
                  style={{ padding: 6 }}
                >
                  <Icon name="x" size={23} />
                </Pressable>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  padding: 22,
                  paddingTop: 4,
                  paddingBottom: 32,
                }}
              >
                {renderError()}
                {selected && (
                  <>
                    <View style={{ borderRadius: 22, overflow: "hidden" }}>
                      <Art
                        kind={selected.art}
                        color={selected.color}
                        size={210}
                      />
                    </View>
                    <Txt style={[s.link, { marginTop: 18 }]}>
                      {selected.brand}
                    </Txt>
                    <Txt
                      style={[
                        s.title,
                        { fontSize: 25, lineHeight: 33, marginVertical: 8 },
                      ]}
                    >
                      {selected.title}
                    </Txt>
                    <Txt style={{ color: C.muted }}>{selected.description}</Txt>
                    <View style={[s.between, { paddingVertical: 20 }]}>
                      <View style={s.row}>
                        <Icon name="star" />
                        <Txt style={{ fontSize: 24, fontWeight: "800" }}>
                          {number(selected.points)} điểm
                        </Txt>
                      </View>
                      <Txt style={s.caption}>Còn {selected.stock} quà</Txt>
                    </View>
                    <View style={st.terms}>
                      <Txt style={{ fontWeight: "700", marginBottom: 6 }}>
                        Điều kiện sử dụng
                      </Txt>
                      <Txt
                        style={{ fontSize: 13, lineHeight: 21, color: C.muted }}
                      >
                        {selected.terms}
                      </Txt>
                    </View>
                    {member && (
                      <Txt
                        style={{
                          fontSize: 13,
                          marginVertical: 14,
                          color: C.muted,
                        }}
                      >
                        Bạn có {number(member.points)} điểm
                        {member.points >= selected.points
                          ? ` · Còn ${number(member.points - selected.points)} điểm sau khi đổi`
                          : ` · Cần thêm ${number(selected.points - member.points)} điểm`}
                      </Txt>
                    )}
                    <Button
                      title={
                        !token
                          ? "Đăng nhập để đổi quà"
                          : !selected.stock
                            ? "Quà tạm hết"
                            : member && member.points < selected.points
                              ? "Chưa đủ điểm"
                              : `Đổi quà · ${number(selected.points)} điểm`
                      }
                      onPress={redeem}
                      busy={busy}
                      disabled={
                        !!token &&
                        (!selected.stock ||
                          !member ||
                          member.points < selected.points)
                      }
                      style={{ marginTop: 12 }}
                    />
                    {token && (
                      <Txt
                        style={[
                          s.caption,
                          { textAlign: "center", marginTop: 10 },
                        ]}
                      >
                        Xác nhận sẽ trừ điểm và lưu mã quà vào ví của bạn.
                      </Txt>
                    )}
                  </>
                )}
                {(success || voucher) &&
                  (() => {
                    const g = (success || voucher)!;
                    return (
                      <>
                        <View
                          style={{ alignItems: "center", paddingVertical: 14 }}
                        >
                          <View
                            style={[
                              st.quickIcon,
                              { width: 64, height: 64, borderRadius: 24 },
                            ]}
                          >
                            <Icon name={success ? "check" : "gift"} size={30} />
                          </View>
                          <Txt
                            style={[
                              s.section,
                              { textAlign: "center", marginTop: 16 },
                            ]}
                          >
                            {g.title}
                          </Txt>
                          <Txt style={{ color: C.muted, marginTop: 6 }}>
                            {g.brand}
                          </Txt>
                        </View>
                        <View style={st.code}>
                          <Txt style={s.caption}>
                            MÃ QUÀ ·{" "}
                            {g.status === "available"
                              ? "CHƯA SỬ DỤNG"
                              : g.status === "used"
                                ? "ĐÃ SỬ DỤNG"
                                : "ĐÃ HẾT HẠN"}
                          </Txt>
                          <Txt
                            selectable
                            accessibilityLabel="Mã đổi quà"
                            style={{
                              fontSize: 22,
                              fontWeight: "800",
                              letterSpacing: 1,
                              marginVertical: 12,
                            }}
                          >
                            {g.code}
                          </Txt>
                          <Txt style={s.caption}>
                            Hạn dùng {date(g.expires)}
                          </Txt>
                        </View>
                        <Txt
                          style={{
                            color: C.muted,
                            fontSize: 13,
                            lineHeight: 22,
                            marginVertical: 18,
                          }}
                        >
                          {g.sample
                            ? "Đây là mã từ danh mục mẫu, không có giá trị thanh toán."
                            : "Xuất trình mã tại đối tác. Mã chỉ được xác nhận sử dụng một lần bởi đơn vị vận hành."}
                          {"\n"}
                          {g.terms}
                        </Txt>
                        <Button
                          title="Về Quà của tôi"
                          onPress={() => {
                            close();
                            setWalletFilter("available");
                            navigate("wallet");
                          }}
                        />
                      </>
                    );
                  })()}
                {sheet === "auth" && (
                  <>
                    <Txt style={{ color: C.muted, marginBottom: 22 }}>
                      {signup
                        ? "Tạo tài khoản để bắt đầu hành trình tích điểm và nhận quà."
                        : "Đăng nhập để tiếp tục tích điểm và khám phá ưu đãi của bạn."}
                    </Txt>
                    {signup && (
                      <Field
                        label="Họ và tên"
                        value={name}
                        change={setName}
                        autoComplete="name"
                      />
                    )}
                    <Field
                      label="Email"
                      value={email}
                      change={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                    <View>
                      <Txt style={s.label}>Mật khẩu</Txt>
                      <View style={[s.input, s.row]}>
                        <TextInput
                          accessibilityLabel="Mật khẩu"
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoComplete={
                            signup ? "new-password" : "current-password"
                          }
                          style={{
                            flex: 1,
                            minHeight: 50,
                            fontSize: 16,
                            color: C.ink,
                          }}
                          onSubmitEditing={login}
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                          }
                          onPress={() => setShowPassword(!showPassword)}
                        >
                          <Icon
                            name={showPassword ? "eye-off" : "eye"}
                            size={20}
                          />
                        </Pressable>
                      </View>
                    </View>
                    <Txt
                      style={[s.caption, { marginTop: 7, marginBottom: 20 }]}
                    >
                      Mật khẩu có ít nhất 12 ký tự.
                    </Txt>
                    <Button
                      title={signup ? "Tạo tài khoản" : "Đăng nhập"}
                      busy={busy}
                      onPress={login}
                    />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setSignup(!signup);
                        setError("");
                        setPassword("");
                      }}
                      style={{ padding: 20, alignItems: "center" }}
                    >
                      <Txt style={s.link}>
                        {signup
                          ? "Đã có tài khoản? Đăng nhập"
                          : "Chưa có tài khoản? Đăng ký"}
                      </Txt>
                    </Pressable>
                    <Txt style={[s.caption, { textAlign: "center" }]}>
                      Email dùng để đăng nhập. Mật khẩu được mã hóa một chiều
                      trên máy chủ.
                    </Txt>
                  </>
                )}
                {sheet === "profile" && (
                  <>
                    <Field label="Họ và tên" value={name} change={setName} />
                    <Field
                      label="Số điện thoại (không bắt buộc)"
                      value={phone}
                      change={setPhone}
                      keyboardType="phone-pad"
                    />
                    <Txt style={[s.caption, { marginBottom: 20 }]}>
                      Email đăng nhập: {member?.email}
                    </Txt>
                    <Button
                      title="Lưu thông tin"
                      busy={busy}
                      onPress={() =>
                        run(async () => {
                          await api("/me", token, "PATCH", { name, phone });
                          await loadMember(token);
                          setSheet(null);
                        })
                      }
                    />
                  </>
                )}
                {sheet === "password" && (
                  <>
                    <Field
                      label="Mật khẩu hiện tại"
                      value={password}
                      change={setPassword}
                      secureTextEntry
                    />
                    <Field
                      label="Mật khẩu mới (từ 12 ký tự)"
                      value={newPassword}
                      change={setNewPassword}
                      secureTextEntry
                    />
                    <Txt style={[s.caption, { marginBottom: 18 }]}>
                      Sau khi đổi mật khẩu, bạn sẽ đăng nhập lại trên các thiết
                      bị.
                    </Txt>
                    <Button
                      title="Cập nhật mật khẩu"
                      busy={busy}
                      onPress={() =>
                        run(async () => {
                          await api("/me/password", token, "POST", {
                            password,
                            new_password: newPassword,
                          });
                          await clear();
                          setPassword("");
                          setNewPassword("");
                          setSignup(false);
                          setSheet("auth");
                        })
                      }
                    />
                  </>
                )}
                {sheet === "delete" && (
                  <>
                    <Txt style={{ marginBottom: 20 }}>
                      Tài khoản, số điểm, lịch sử và quà chưa sử dụng sẽ bị xóa
                      vĩnh viễn. Nhập mật khẩu để xác nhận.
                    </Txt>
                    <Field
                      label="Mật khẩu xác nhận"
                      value={password}
                      change={setPassword}
                      secureTextEntry
                    />
                    <Button
                      title="Xóa vĩnh viễn tài khoản"
                      busy={busy}
                      style={{ backgroundColor: C.red }}
                      onPress={() =>
                        run(async () => {
                          await api("/me", token, "DELETE", { password });
                          await clear();
                          setSheet(null);
                          setPassword("");
                          navigate("home");
                        })
                      }
                    />
                  </>
                )}
                {sheet === "about" && (
                  <View style={{ gap: 16 }}>
                    <Txt style={s.title}>Sống xanh.{"\n"}Nhận điều hay.</Txt>
                    <Txt>
                      REwards kết nối việc thu gom chai với điểm thưởng và ưu
                      đãi từ các nhãn hàng.
                    </Txt>
                    <Txt style={s.section}>Dữ liệu của bạn</Txt>
                    <Txt>
                      Họ tên, email, số điện thoại tùy chọn, lịch sử điểm và quà
                      được lưu tại máy chủ của đơn vị vận hành. Mật khẩu được
                      băm; phiên đăng nhập lưu trong vùng bảo mật của điện thoại
                      (trên web dùng bộ nhớ phiên).
                    </Txt>
                    <Txt>
                      Bạn có thể sửa thông tin, đổi mật khẩu hoặc xóa tài khoản
                      trong mục Tài khoản. Ứng dụng không yêu cầu vị trí, camera
                      hay danh bạ.
                    </Txt>
                    <Txt style={s.section}>Điểm & quà</Txt>
                    <Txt>
                      Điểm chỉ được cộng bởi hệ thống vận hành sau khi xác nhận
                      giao dịch. Khi đổi quà, số dư và tồn kho được kiểm tra lại
                      trên máy chủ. Quà thật cần danh mục và điều kiện từ đối
                      tác đã xác nhận.
                    </Txt>
                    {sample && (
                      <Sample text="Danh mục hiện tại sử dụng nhãn hàng và quà mẫu" />
                    )}
                  </View>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
function Field({
  label,
  value,
  change,
  ...props
}: { label: string; value: string; change: (v: string) => void } & Omit<
  React.ComponentProps<typeof TextInput>,
  "value" | "onChangeText"
>) {
  return (
    <View style={{ marginBottom: 17 }}>
      <Txt style={s.label}>{label}</Txt>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={change}
        style={s.input}
        placeholderTextColor={C.muted}
        {...props}
      />
    </View>
  );
}
const st = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: "#DDE7DF", alignItems: "center" },
  phone: { flex: 1, width: "100%", maxWidth: 480, backgroundColor: C.paper },
  header: {
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    backgroundColor: C.paper,
  },
  logo: {
    height: 32,
    width: 32,
    borderRadius: 12,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 15,
    backgroundColor: C.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  memberCard: {
    backgroundColor: C.green,
    borderRadius: 24,
    padding: 23,
    marginTop: 24,
  },
  heroLink: {
    backgroundColor: C.lime,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  quickRow: { flexDirection: "row", marginTop: 24, gap: 12 },
  quick: { flex: 1, alignItems: "center", gap: 9 },
  quickIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: C.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  arrow: {
    width: 27,
    height: 27,
    borderRadius: 10,
    backgroundColor: C.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  story: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: "#EDF1E2",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  storyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#D9E6B5",
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { alignItems: "center", gap: 8, width: 86 },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    backgroundColor: C.white,
  },
  chip: {
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 13,
    backgroundColor: "#EDF1EB",
  },
  chipActive: { backgroundColor: C.green },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  walletCard: { flexDirection: "row", marginBottom: 14 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 58,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  tabbar: {
    flexDirection: "row",
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.white,
  },
  tab: { flex: 1, alignItems: "center", gap: 4, minHeight: 53 },
  tabIcon: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 13 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10,32,23,.45)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "94%",
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#CCD7CF",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 16,
  },
  terms: { padding: 16, borderRadius: 16, backgroundColor: C.paper },
  code: {
    padding: 23,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#A6C5AB",
    borderRadius: 18,
    alignItems: "center",
    marginTop: 16,
    backgroundColor: C.paper,
  },
});
