import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: 1,
        },
    },
});

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
                <StatusBar style="auto" />
                <Stack>
                    <Stack.Screen name="index" options={{ title: "Agile" }} />
                    <Stack.Screen name="measurement-result" options={{ title: "Measurement" }} />
                </Stack>
            </QueryClientProvider>
        </SafeAreaProvider>
    );
}
