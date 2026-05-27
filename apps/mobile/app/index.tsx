import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { WoundMeasurement } from "../modules/wound-measurement";
import { isSupabaseConfigured } from "../src/lib/supabase";

export default function HomeScreen() {
    const router = useRouter();
    const [depthSupported, setDepthSupported] = useState<boolean | null>(null);
    const [hasLidar, setHasLidar] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setDepthSupported(WoundMeasurement.isDepthSupported());
        setHasLidar(WoundMeasurement.hasDedicatedDepthSensor());
    }, []);

    const canMeasure = depthSupported === true;

    async function startMeasurement() {
        setBusy(true);
        try {
            const result = await WoundMeasurement.measureWound();
            setBusy(false);
            router.push({
                pathname: "/measurement-result",
                params: { payload: JSON.stringify(result) },
            });
        } catch (err) {
            setBusy(false);
            const msg = err instanceof Error ? err.message : String(err);
            if (!/cancelled/i.test(msg)) {
                Alert.alert("Measurement failed", msg);
            }
        }
    }

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Agile</Text>
                <Text style={styles.subtitle}>Wound documentation dev build</Text>

                <View style={styles.statusCard}>
                    <Row label="Platform" value={Platform.OS} />
                    <Row label="Depth supported" value={fmtBool(depthSupported)} />
                    <Row
                        label={Platform.OS === "ios" ? "LiDAR" : "ToF sensor"}
                        value={fmtBool(hasLidar)}
                    />
                    <Row label="Backend configured" value={fmtBool(isSupabaseConfigured())} />
                </View>

                <Pressable
                    onPress={startMeasurement}
                    disabled={!canMeasure || busy}
                    style={[styles.button, (!canMeasure || busy) && styles.buttonDisabled]}
                >
                    <Text style={styles.buttonText}>
                        {busy ? "Opening AR…" : "Measure wound"}
                    </Text>
                </Pressable>

                {!canMeasure && depthSupported === false && (
                    <Text style={styles.warn}>
                        {Platform.OS === "ios"
                            ? "This device does not have LiDAR. Measurement is disabled. Use an iPhone 12 Pro / 14 Pro / 15 Pro / 16 Pro or iPad Pro 2020+."
                            : "ARCore Depth API not available on this device."}
                    </Text>
                )}
                {!canMeasure && depthSupported === null && (
                    <Text style={styles.dim}>Checking depth support…</Text>
                )}

                <Text style={styles.footer}>
                    No clinical data yet — this is a developer build. PHI handling is gated on
                    the Supabase BAA + final brand approval. See /docs.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
        </View>
    );
}

function fmtBool(v: boolean | null | undefined): string {
    if (v === true) return "yes";
    if (v === false) return "no";
    return "—";
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fafafa" },
    content: { padding: 24, gap: 24 },
    title: { fontSize: 32, fontWeight: "700" },
    subtitle: { fontSize: 14, color: "#666", marginTop: -16 },
    statusCard: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: "#eee",
    },
    row: { flexDirection: "row", justifyContent: "space-between" },
    rowLabel: { fontSize: 14, color: "#555" },
    rowValue: { fontSize: 14, fontWeight: "600" },
    button: {
        backgroundColor: "#0a84ff",
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
    },
    buttonDisabled: { backgroundColor: "#bbb" },
    buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
    warn: {
        color: "#a05a00",
        backgroundColor: "#fff6dd",
        padding: 12,
        borderRadius: 8,
        fontSize: 13,
    },
    dim: { color: "#888", fontSize: 13 },
    footer: { fontSize: 12, color: "#888", marginTop: 24 },
});
