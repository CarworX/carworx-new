import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => {
  return [{ title: "CarworX" }];
};

// Placeholder page for the scaffold. T4 replaces it with Studio components.
export default function Home() {
  return (
    <main>
      <h1>CarworX</h1>
      <p>Scaffold running on Cloudflare Workers.</p>
    </main>
  );
}
