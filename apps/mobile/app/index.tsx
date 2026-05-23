import { Redirect } from "expo-router";

// Root — routes to auth or app based on session.
// Placeholder until AuthGuard is wired up.
export default function Index() {
    return <Redirect href="/(auth)/sign-in" />;
}
