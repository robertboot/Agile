import { redirect } from "next/navigation";

// There is no public face to this site. Anyone arriving at the root either
// belongs in the console or belongs at the sign-in screen, and middleware
// decides which.
export default function Home() {
  redirect("/console");
}
