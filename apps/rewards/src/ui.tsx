import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Svg, { Circle, Path, Rect, Ellipse } from "react-native-svg";

export const C = {
  green: "#175C44",
  deep: "#133F33",
  mint: "#E8F2EA",
  lime: "#D9ED99",
  ink: "#1F342D",
  muted: "#708078",
  line: "#E4EBE5",
  paper: "#F7F9F5",
  white: "#FFFFFF",
  red: "#B03A35",
};
export type IconName = React.ComponentProps<typeof Feather>["name"];
export function Icon({
  name,
  size = 20,
  color = C.green,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Feather
      name={name}
      size={size}
      color={color}
      accessible={false}
      aria-hidden={true}
    />
  );
}
export function Txt({ style, ...props }: TextProps) {
  return <Text {...props} style={[s.text, style]} />;
}
export function Button({
  title,
  onPress,
  disabled = false,
  busy = false,
  secondary = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (disabled || busy) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? C.green : C.white} />
      ) : (
        icon && <Icon name={icon} color={secondary ? C.green : C.white} />
      )}
      <Txt style={{ fontWeight: "700", color: secondary ? C.green : C.white }}>
        {title}
      </Txt>
    </Pressable>
  );
}
export function Sample({ text = "Dữ liệu mẫu" }: { text?: string }) {
  return (
    <View style={s.sample}>
      <Txt style={{ fontSize: 11, color: C.muted }}>{text}</Txt>
    </View>
  );
}
export function Empty({
  title,
  body,
  icon = "gift",
}: {
  title: string;
  body: string;
  icon?: IconName;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Icon name={icon} size={28} />
      </View>
      <Txt style={s.section}>{title}</Txt>
      <Txt style={{ textAlign: "center", color: C.muted, lineHeight: 23 }}>
        {body}
      </Txt>
    </View>
  );
}
export const number = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
export const date = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString("vi-VN");

export function Art({
  kind,
  color,
  size = 140,
}: {
  kind: string;
  color: string;
  size?: number;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
        height: size,
        overflow: "hidden",
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 180 180">
        <Circle cx="144" cy="33" r="37" fill="white" opacity=".28" />
        <Circle cx="30" cy="135" r="43" fill="white" opacity=".16" />
        <Ellipse cx="92" cy="151" rx="48" ry="7" fill={C.deep} opacity=".09" />
        {kind === "coffee" ? (
          <>
            <Path
              d="M119 64h12c26 0 24 42-2 42h-10"
              stroke="#8B543C"
              strokeWidth="9"
              fill="none"
            />
            <Path d="M49 61h73l-6 67q-29 21-60 0z" fill="#FFF9EC" />
            <Ellipse cx="85" cy="62" rx="36" ry="10" fill="#9A5B3B" />
            <Ellipse cx="85" cy="62" rx="27" ry="6" fill="#D9A77B" />
            <Path
              d="M70 30q-10 10 0 20M93 24q-10 10 0 20"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            <Path d="M76 90q18-18 24 1-8 20-24-1" fill={C.green} />
            <Path d="M85 99l9-10" stroke="white" strokeWidth="2" />
          </>
        ) : kind === "bag" ? (
          <>
            <Path d="M57 61h68l9 82q-41 11-88 0z" fill="#FFFCED" />
            <Path
              d="M70 66V49q20-33 42 0v17"
              stroke="#A78C59"
              strokeWidth="7"
              fill="none"
            />
            <Circle cx="90" cy="107" r="19" fill={C.green} />
            <Path
              d="M82 109l8-15 8 15M85 113h10"
              stroke="#D9ED99"
              strokeWidth="3"
              fill="none"
            />
          </>
        ) : kind === "bottle" ? (
          <>
            <Rect x="70" y="24" width="40" height="22" rx="6" fill={C.deep} />
            <Path
              d="M68 45h44q10 7 10 22v70q0 16-32 16t-32-16V67q0-15 10-22"
              fill="#63958F"
            />
            <Path
              d="M68 67v64"
              stroke="#AFD3CB"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <Circle cx="90" cy="98" r="14" fill="#E8F2EA" />
            <Path d="M83 100q8-19 15-2-6 13-15 2" fill={C.green} />
          </>
        ) : kind === "meal" ? (
          <>
            <Circle cx="89" cy="94" r="56" fill="#FFFEF7" />
            <Circle cx="89" cy="94" r="43" fill="#EEE9D8" />
            <Circle cx="77" cy="86" r="26" fill="#77A568" />
            <Circle cx="99" cy="80" r="19" fill="#A8C785" />
            <Circle cx="106" cy="108" r="22" fill="#E7AF61" />
            <Circle cx="77" cy="113" r="13" fill="#D87953" />
            <Circle cx="66" cy="92" r="8" fill="#D87953" />
            <Path
              d="M150 49v90M30 50v90M23 50v23h14V50"
              stroke="#AD9060"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : kind === "book" ? (
          <>
            <Path d="M47 44l76-10 13 107-77 11z" fill="#7D74A6" />
            <Path d="M56 47l67-9 12 99-67 10q-17 1-16-12" fill="#B2A4CF" />
            <Path d="M57 140l74-10 1 8-73 10q-9-1-9-6" fill="#FFFCED" />
            <Path
              d="M75 70l35-4M77 79l32-4"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <Path d="M82 106q-9-27 14-20 22 6 2 25" fill="#E3EDB3" />
          </>
        ) : (
          <>
            <Path d="M62 103h56l-8 45H71z" fill="#C98E67" />
            <Ellipse cx="90" cy="103" rx="28" ry="7" fill="#936347" />
            <Path d="M90 107V53" stroke={C.green} strokeWidth="5" />
            <Path
              d="M89 80q-48 0-36-34 35-1 36 34M91 65q0-42 36-34 6 30-36 34M91 95q38 1 39-25-30-9-39 25"
              fill="#6F9C58"
            />
          </>
        )}
      </Svg>
    </View>
  );
}
export const s = StyleSheet.create({
  text: { fontSize: 15, lineHeight: 22, color: C.ink },
  title: {
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: C.ink,
  },
  section: {
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  caption: { fontSize: 12, lineHeight: 18, color: C.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  button: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 18,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
  },
  secondary: { backgroundColor: C.mint },
  input: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: "#CFDAD0",
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 15,
    fontSize: 16,
    color: C.ink,
  },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 7, color: C.ink },
  sample: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 7,
    backgroundColor: "#EEF1EA",
  },
  empty: { padding: 24, alignItems: "center", gap: 12 },
  emptyIcon: {
    height: 64,
    width: 64,
    borderRadius: 24,
    backgroundColor: C.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
  },
  error: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FBE9E6",
    marginBottom: 12,
  },
  link: { fontSize: 14, fontWeight: "700", color: C.green },
});
