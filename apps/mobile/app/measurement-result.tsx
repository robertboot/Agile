import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MeasurementResult } from "@agile/shared";

export default function MeasurementResultScreen() {
    const router = useRouter();
    const { payload } = useLocalSearchParams<{ payload?: string }>();

    let parsed: ReturnType<typeof MeasurementResult.safeParse> | null = null;
    try {
        parsed = payload ? MeasurementResult.safeParse(JSON.parse(payload)) : null;
    } catch {
        parsed = null;
    }

    if (!parsed || !parsed.success) {
        return (
            <SafeAreaView style={styles.container} edges={["bottom"]}>
                <View style={styles.content}>
                    <Text style={styles.title}>Bad payload</Text>
                    <Text style={styles.dim}>
                        {parsed && !parsed.success ? parsed.error.message : "No measurement received."}
                    </Text>
                    <Pressable style={styles.button} onPress={() => router.back()}>
                        <Text style={styles.buttonText}>Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const m = parsed.data;
    const areaCm2 = (m.areaMm2 / 100).toFixed(2);

    return (
        <SafeAreaView style={styles.container} edges={["bottom"]}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Measurement</Text>

                <View style={styles.card}>
                    <Row label="Area" value={`${areaCm2} cm² (${m.areaMm2.toFixed(0)} mm²)`} />
                    <Row label="Length" value={`${m.lengthMm.toFixed(1)} mm`} />
                    <Row label="Width" value={`${m.widthMm.toFixed(1)} mm`} />
                    <Row label="Perimeter" value={`${m.perimeterMm.toFixed(1)} mm`} />
                    <Row
                        label="Confidence"
                        value={`${(m.confidenceScore * 100).toFixed(0)}%`}
                        valueColor={confidenceColor(m.confidenceScore)}
                    />
                    <Row label="Method" value={m.measurementMethod} />
                    <Row label="Trace points" value={String(m.polygonPoints.length)} />
                    <Row label="Tracking state" value={m.arTrackingState} />
                    <Row label="Device" value={`${m.deviceModel} (${m.osVersion})`} />
                    <Row label="Photos captured" value={String(m.photoUris.length)} />
                </View>

                <Text style={styles.note}>
                    Data is not persisted yet — sync engine + Supabase wiring lands in the next sprint.
                </Text>

                <Pressable style={styles.button} onPress={() => router.back()}>
                    <Text style={styles.buttonText}>Done</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

function Row({
    label,
    value,
    valueColor,
}: {
    label: string;
    value: string;
    valueColor?: string;
}) {
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={[styles.rowValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
        </View>
    );
}

function confidenceColor(score: number): string {
    if (score >= 0.8) return "#0a8a0a";
    if (score >= 0.5) return "#a05a00";
    return "#b00020";
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fafafa" },
    content: { padding: 24, gap: 20 },
    title: { fontSize: 28, fontWeight: "700" },
    card: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        gap: 10,
        borderWidth: 1,
        borderColor: "#eee",
    },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    rowLabel: { fontSize: 14, color: "#555" },
    rowValue: { fontSize: 14, fontWeight: "600" },
    note: { fontSize: 12, color: "#888" },
    dim: { color: "#888", fontSize: 14 },
    button: {
        backgroundColor: "#0a84ff",
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
    },
    buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
});
